// navigate to a date time in the currently open log file in the editor

import * as vscode from 'vscode';
import { DateTime } from 'luxon';



export async function navigateToDateTime() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration('acacia-log');
  const logDateFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
  const logDateRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
  const logSearchDate = config.get<string>('logSearchDate');
  const logSearchTime = config.get<string>('logSearchTime');
  const dateTimeInput = `${logSearchDate}T${logSearchTime}`;
          const dateTime = DateTime.fromISO(dateTimeInput);
        if (!dateTime.isValid) {
          vscode.window.showErrorMessage('Invalid date and time format');
            return;
        }

  const document = editor.document;
  const text = document.getText();
  const lines = text.split('\n');

  let low = 0;
  let high = lines.length - 1;
  let found = false;
  let lineNumber = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const match = lines[mid].match(new RegExp(logDateRegex));
    if (match) {
      const matchDateTime = DateTime.fromFormat(match[0], logDateFormat);
      if (matchDateTime.equals(dateTime)) {
        lineNumber = mid;
        found = true;
        high = mid - 1; // Continue searching in the lower half
      } else if (matchDateTime < dateTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } else {
      high = high - 1;
    }
  }

  if (found) {
    vscode.window.showInformationMessage('Date and time found in the log file at line ' + (lineNumber + 1));
    const position = new vscode.Position(lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }  else {
    vscode.window.showInformationMessage('Date and time not found in the log file');
    // go to the lower bound
    const position = new vscode.Position(low, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }

  
} 