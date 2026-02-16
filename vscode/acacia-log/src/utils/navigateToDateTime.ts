// navigate to a date time in the currently open log file in the editor

import * as vscode from 'vscode';
import { DateTime } from 'luxon';
import { getOrDetectFormat, getRegexAndFormat } from './format-cache';



export async function navigateToDateTime() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  
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
        // Try searching lower half first
        high = mid - 1;
        continue;
      }

      const comparison = matchDateTime.valueOf() - dateTime.valueOf();
      
      if (comparison === 0) {
        // Found exact match - continue searching for first occurrence
        exactMatchLine = mid;
        foundExactMatch = true;
        high = mid - 1; // Look for earlier occurrences
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
} 