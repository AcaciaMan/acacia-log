import * as vscode from 'vscode';
import * as fs from 'fs';
import * as readline from 'readline';
import { ResultDocumentProvider } from './resultDocumentProvider';
import { getOrDetectFormat, getRegexAndFormat } from './format-cache';

/** Files larger than this threshold trigger an upfront warning and progress notification */
const LARGE_FILE_WARN_BYTES = 200 * 1_024 * 1_024; // 200 MB

export async function calculateSimilarLineCounts(editor: vscode.TextEditor) {
  const document = editor.document;

  // Resolve file path — for open documents this gives the path on disk
  const filePath = document.uri.fsPath;

  // Check file size — warn the user if the file is large
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(filePath).size;
  } catch { /* virtual / untitled document */ }

  const isLarge = fileSizeBytes > LARGE_FILE_WARN_BYTES;
  if (isLarge) {
    const mb = Math.round(fileSizeBytes / (1_024 * 1_024));
    vscode.window.showInformationMessage(
      `This file is large (${mb} MB). Analysis may take a moment.`
    );
  }

  const runAnalysis = async () => {
    // Try to auto-detect format first, fallback to config
    const detection = await getOrDetectFormat(document);
    const { regex: logDateRegex, useDetected } = getRegexAndFormat(detection.format);

    if (useDetected) {
      console.log('[SimilarLines] Using auto-detected timestamp pattern:', detection.format?.pattern);
    } else {
      console.log('[SimilarLines] Using configured timestamp pattern');
    }

    console.log(`[SimilarLines] Streaming ${filePath}`);

    const lineCounts: { [key: string]: number } = {};

    // Stream the file line-by-line to avoid loading the whole file into memory
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        if (logDateRegex.test(line)) {
          const lineWithoutNumbers = line.replace(/\d+/g, '');
          lineCounts[lineWithoutNumbers] = (lineCounts[lineWithoutNumbers] ?? 0) + 1;
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    console.log(`[SimilarLines] Found ${Object.keys(lineCounts).length} unique patterns`);

    const sortedLineCounts = Object.entries(lineCounts).sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    });

    const result = sortedLineCounts.map(([line, count]) => `${count}: ${line}`).join('\n');

    // Use ResultDocumentProvider to open in an editor result tab
    const resultProvider = ResultDocumentProvider.getInstance();
    await resultProvider.openSimilarLinesResult(result);
  };

  if (isLarge) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '[Acacia Log] Analyzing similar lines…',
        cancellable: false,
      },
      runAnalysis
    );
  } else {
    await runAnalysis();
  }
}