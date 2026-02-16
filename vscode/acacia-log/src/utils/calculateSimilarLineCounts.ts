import * as vscode from 'vscode';
import { ResultDocumentProvider } from './resultDocumentProvider';
import { getOrDetectFormat, getRegexAndFormat } from './format-cache';

export async function calculateSimilarLineCounts(editor: vscode.TextEditor) {
  const document = editor.document;
  const text = document.getText();
  const lines = text.split('\n');
  
  // Try to auto-detect format first, fallback to config
  const detection = await getOrDetectFormat(document);
  const { regex: logDateRegex, useDetected } = getRegexAndFormat(detection.format);
  
  if (useDetected) {
    console.log('[SimilarLines] Using auto-detected timestamp pattern:', detection.format?.pattern);
  } else {
    console.log('[SimilarLines] Using configured timestamp pattern');
  }
  
  const lineCounts: { [key: string]: number } = {};

  for (const line of lines) {
    if (logDateRegex.test(line)) {
      const lineWithoutNumbers = line.replace(/\d+/g, '');
      if (lineCounts[lineWithoutNumbers]) {
        lineCounts[lineWithoutNumbers]++;
      } else {
        lineCounts[lineWithoutNumbers] = 1;
      }
    }
  }

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
}