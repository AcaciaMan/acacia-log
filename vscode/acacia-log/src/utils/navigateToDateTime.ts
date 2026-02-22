// navigate to a date time in the currently open log file in the editor

import * as vscode from 'vscode';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import { getOrDetectFormat, getRegexAndFormat } from './format-cache';
import { buildLineIndex, getFileDates, jumpToTimestamp, readLineRange } from './log-file-reader';
import { DetectedFormat } from './timestamp-detect';
import { ResultDocumentProvider } from './resultDocumentProvider';

/** Files larger than this are navigated without loading them into the editor */
const LARGE_FILE_THRESHOLD_BYTES = 50 * 1_024 * 1_024; // 50 MB

/** Files larger than this threshold trigger an upfront warning and progress notification */
const LARGE_FILE_WARN_BYTES = 200 * 1_024 * 1_024; // 200 MB

/** Lines of context to show on each side of the matched line */
const CONTEXT_LINES = 50;

export async function navigateToDateTime() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;

  // Determine file size to choose navigation strategy
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(filePath).size;
  } catch {
    // Virtual / untitled document — fall back to in-memory path
  }

  // Warn the user upfront if the file is very large
  if (fileSizeBytes > LARGE_FILE_WARN_BYTES) {
    const mb = Math.round(fileSizeBytes / (1_024 * 1_024));
    vscode.window.showInformationMessage(
      `This file is large (${mb} MB). Analysis may take a moment.`
    );
  }

  // Try to auto-detect format first, fallback to config
  const detection = await getOrDetectFormat(document);
  const { regex: dateRegexCompiled, format: logDateFormat, useDetected } = getRegexAndFormat(detection.format);

  if (useDetected) {
    console.log('[NavigateToDateTime] Using auto-detected timestamp pattern:', detection.format?.pattern);
  } else {
    console.log('[NavigateToDateTime] Using configured timestamp pattern');
  }

  const config = vscode.workspace.getConfiguration('acacia-log');
  const logSearchDate = config.get<string>('logSearchDate');
  const logSearchTime = config.get<string>('logSearchTime');
  const dateTimeInput = `${logSearchDate}T${logSearchTime}`;

  const dateTime = DateTime.fromISO(dateTimeInput);
  if (!dateTime.isValid) {
    vscode.window.showErrorMessage('Invalid date and time format');
    return;
  }

  if (fileSizeBytes > LARGE_FILE_THRESHOLD_BYTES && detection.format) {
    // Large file with known format — stream + virtual document (already uses withProgress)
    await navigateLargeFile(filePath, dateTime, detection.format);
  } else if (fileSizeBytes > LARGE_FILE_WARN_BYTES) {
    // Large file but format not detected — editor path with a progress spinner
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '[Acacia Log] Navigating to date/time…',
        cancellable: false,
      },
      async () => navigateInEditor(editor, document, dateTime, dateRegexCompiled, logDateFormat)
    );
  } else {
    await navigateInEditor(editor, document, dateTime, dateRegexCompiled, logDateFormat);
  }
}

// ── Large-file path: index → jump → read chunk → virtual document ──────

/**
 * For files > 50 MB: builds a sparse byte-offset index by streaming the
 * file once, does a binary search to locate the target timestamp, reads
 * 100 lines of context around the match, then opens the excerpt as a
 * read-only virtual document via ResultDocumentProvider.
 */
async function navigateLargeFile(
  filePath: string,
  dateTime: DateTime,
  format: DetectedFormat
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '[Acacia Log] Indexing large file…',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Building line index…' });

      const fileDates = getFileDates(filePath);

      // Stream the whole file once to build a sparse line-to-byte-offset index
      const lineIndex = await buildLineIndex(filePath, format, fileDates);

      progress.report({ message: 'Searching for timestamp…' });

      // Binary-search the sparse index, then refine within the nearest chunk
      const jumpResult = await jumpToTimestamp(
        filePath,
        dateTime.toJSDate(),
        format,
        fileDates,
        lineIndex
      );

      if (!jumpResult) {
        vscode.window.showWarningMessage(
          '[Acacia Log] No timestamps found in file — cannot navigate.'
        );
        return;
      }

      const targetLine = jumpResult.line; // 0-based

      // Compute the context window, clamped to file boundaries
      const ctxStart = Math.max(0, targetLine - CONTEXT_LINES);
      const ctxEnd   = Math.min(lineIndex.totalLines - 1, targetLine + CONTEXT_LINES);

      progress.report({ message: 'Reading context lines…' });

      const { lines } = await readLineRange(filePath, ctxStart, ctxEnd, lineIndex);

      // Width for line-number prefix (based on the largest line number shown)
      const padWidth = String(ctxEnd + 1).length;

      // Build virtual document: 3-line header + numbered body lines
      const header =
        `// File: ${filePath}\n` +
        `// Matched line: ${targetLine + 1}  Timestamp: ${jumpResult.timestamp.toISOString()}\n` +
        `// Showing lines ${ctxStart + 1}–${ctxEnd + 1} of ${lineIndex.totalLines}\n`;

      const body = lines
        .map((line, i) => {
          const realLineNum = ctxStart + i + 1; // 1-based
          return `${String(realLineNum).padStart(padWidth, ' ')}: ${line}`;
        })
        .join('\n');

      const content = header + body;

      // Open the excerpt in a virtual read-only document
      const resultProvider = ResultDocumentProvider.getInstance();
      const resultEditor = await resultProvider.openLogChunkResult(content);

      // Reveal the matched line inside the virtual document.
      // Header occupies lines 0–2 (3 lines); body starts at line 3.
      const lineInChunk = targetLine - ctxStart; // 0-based offset within body
      const virtualLine = 3 + lineInChunk;

      const pos = new vscode.Position(virtualLine, 0);
      resultEditor.selection = new vscode.Selection(pos, pos);
      resultEditor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenter
      );

      vscode.window.showInformationMessage(
        `[Acacia Log] Large file: showing ${CONTEXT_LINES} lines of context around line ${targetLine + 1}`
      );
    }
  );
}

// ── Small-file path: original in-editor binary search ──────────────────

/**
 * For files ≤ 50 MB, navigate by binary-searching lines already loaded
 * in the VS Code editor — the original behaviour.
 */
async function navigateInEditor(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  dateTime: DateTime,
  dateRegexCompiled: RegExp,
  logDateFormat: string
): Promise<void> {
  const totalLines = document.lineCount;

  let low = 0;
  let high = totalLines - 1;
  let foundExactMatch = false;
  let exactMatchLine = -1;
  let closestLine = 0;

  // Binary search for the target date/time
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineText = document.lineAt(mid).text;
    const match = lineText.match(dateRegexCompiled);

    if (match) {
      const matchDateTime = DateTime.fromFormat(match[0], logDateFormat);

      // Skip invalid dates in the log
      if (!matchDateTime.isValid) {
        high = mid - 1;
        continue;
      }

      const comparison = matchDateTime.valueOf() - dateTime.valueOf();

      if (comparison === 0) {
        // Found exact match — continue searching for first occurrence
        exactMatchLine = mid;
        foundExactMatch = true;
        high = mid - 1;
      } else if (comparison < 0) {
        // Match is before target, search upper half
        closestLine = mid;
        low = mid + 1;
      } else {
        // Match is after target, search lower half
        high = mid - 1;
      }
    } else {
      // No date on this line, try lower half
      high = mid - 1;
    }
  }

  // Navigate to the result
  if (foundExactMatch) {
    vscode.window.showInformationMessage(`Date and time found at line ${exactMatchLine + 1}`);
    const position = new vscode.Position(exactMatchLine, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  } else {
    // Navigate to closest line (the last line before the target time, or beginning)
    const targetLine = Math.min(Math.max(low, 0), totalLines - 1);
    vscode.window.showInformationMessage(
      `Exact date/time not found. Navigating to closest line ${targetLine + 1}`
    );
    const position = new vscode.Position(targetLine, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  // Suppress "unused variable" warning — closestLine is the last seen line
  void closestLine;
}
