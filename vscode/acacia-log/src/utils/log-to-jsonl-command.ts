/**
 * VS Code command: acacia-log.convertToJsonl
 * Converts the active log document to JSONL, one JSON object per logical entry.
 */

import * as vscode from 'vscode';
import { getLuxonDateTime } from './lazy-luxon';
import { getOrDetectFormat, getRegexAndFormat } from './format-cache';
import { groupLinesToJsonEntries, LogToJsonOptions, MessageMode } from './log-to-jsonl';

export async function convertToJsonl(documentOverride?: vscode.TextDocument): Promise<void> {

  // ── 1. Resolve document ──────────────────────────────────────────────────────
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor | undefined;

  if (documentOverride) {
    document = documentOverride;
    // Show the document so the user can see progress and the result
    editor = await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });
  } else {
    editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Acacia Log: No active text editor. Open a log file first.');
      return;
    }
    document = editor.document;
  }

  // ── 2. Split document into lines ────────────────────────────────────────────
  const rawText = document.getText();
  const lines = rawText.split('\n').map(l => l.endsWith('\r') ? l.slice(0, -1) : l);

  // ── 3. Detect timestamp format ──────────────────────────────────────────────
  const detection = await getOrDetectFormat(document);
  const { regex, format, useDetected } = getRegexAndFormat(detection.format);

  if (!useDetected) {
    const proceed = await vscode.window.showWarningMessage(
      'Acacia Log: No timestamp format could be auto-detected in this file. ' +
      'The configured fallback regex will be used. Results may be a single entry.',
      { modal: false },
      'Continue', 'Cancel'
    );
    if (proceed !== 'Continue') {
      return;
    }
  } else {
    console.log('[ConvertToJsonl] Using auto-detected timestamp pattern:', detection.format?.pattern);
  }

  // ── 4. Read settings ────────────────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration('acacia-log');
  const messageMode    = config.get<MessageMode>('jsonl.messageMode',          'firstLineMinusTimestamp');
  const maxMultiline   = config.get<number>      ('jsonl.maxMultilineSize',     1000);
  const openInEditor   = config.get<boolean>     ('jsonl.openResultInNewEditor', true);

  // ── 5. Build options ────────────────────────────────────────────────────────
  const options: LogToJsonOptions = {
    timestampRegex: regex,

    extractTimestamp: (line: string) => {
      // Reset lastIndex for global regexes to avoid stale state
      regex.lastIndex = 0;
      const m = regex.exec(line);
      if (!m || m.index === undefined) { return null; }
      return { raw: m[0], start: m.index, end: m.index + m[0].length };
    },

    parseTimestamp: (raw: string): string | null => {
      // Try Luxon first (handles all detected format strings)
      const dt = getLuxonDateTime().fromFormat(raw, format);
      if (dt.isValid) { return dt.toISO(); }
      // Fallback: native Date (handles ISO-8601 strings)
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d.toISOString();
    },

    messageMode,
    maxMultilineSize: maxMultiline,
  };

  // ── 6. Group lines (wrapped in progress notification) ───────────────────────
  let entries: ReturnType<typeof groupLinesToJsonEntries> = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Acacia Log: Converting to JSONL…',
      cancellable: false,
    },
    async (progress) => {
      // groupLinesToJsonEntries is synchronous; do it in chunks to allow
      // the progress indicator to render and report milestones.
      const CHUNK = 5_000;
      const total = lines.length;
      let processed = 0;

      // Collect slices and merge at the end to preserve entry boundaries.
      // We cannot slice blindly (continuation lines at chunk boundaries would
      // break grouping), so we run the full grouping once and report progress
      // based on the entry index instead.
      entries = groupLinesToJsonEntries(lines, options);

      // Report progress across the resulting entries
      const entryCount = entries.length;
      for (let i = 0; i < entryCount; i += CHUNK) {
        processed = Math.min(i + CHUNK, entryCount);
        progress.report({
          increment: (CHUNK / Math.max(entryCount, 1)) * 100,
          message: `${processed.toLocaleString()} / ${entryCount.toLocaleString()} entries…`,
        });
        // Yield to the event loop briefly
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
  );

  // ── 7. Warn if nothing useful was produced ───────────────────────────────────
  if (entries.length === 0) {
    vscode.window.showInformationMessage(
      'Acacia Log: The document produced no entries. Is it empty?'
    );
    return;
  }

  const allNull = entries.every(e => e.timestamp === null);
  if (allNull) {
    vscode.window.showInformationMessage(
      'Acacia Log: No timestamps were detected. All entries have timestamp = null. ' +
      'Consider adjusting the log date regex in settings.'
    );
    // Continue anyway — the user may still want the output.
  }

  // ── 8. Build JSONL string ───────────────────────────────────────────────────
  const jsonl = entries.map(e => JSON.stringify(e)).join('\n');

  // ── 9. Output ────────────────────────────────────────────────────────────────
  if (openInEditor) {
    const newDoc = await vscode.workspace.openTextDocument({
      content: jsonl,
      language: 'json',
    });
    await vscode.window.showTextDocument(newDoc, { preview: false });
  } else {
    const targetEditor = editor ?? vscode.window.activeTextEditor;
    if (!targetEditor || targetEditor.document !== document) {
      vscode.window.showErrorMessage('Acacia Log: Could not find an editor for the document to replace.');
      return;
    }
    await targetEditor.edit(editBuilder => {
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(rawText.length)
      );
      editBuilder.replace(fullRange, jsonl);
    });
  }

  vscode.window.showInformationMessage(
    `Acacia Log: Converted ${entries.length.toLocaleString()} log entr${entries.length === 1 ? 'y' : 'ies'} to JSONL.`
  );
}
