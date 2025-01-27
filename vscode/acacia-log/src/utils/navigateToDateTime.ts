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
  const lineCount = lines.length;

  let lineNumber = 0;
  let found = false;
  for (let i = 0; i < lineCount; i++) {
    const match = lines[i].match(logDateRegex);
    if (match) {
          const matchDateTime = DateTime.fromFormat(match[0], logDateFormat);
          console.log(matchDateTime.toISO());
      if (matchDateTime.equals(dateTime)) {
        lineNumber = i;
        found = true;
        break;
      }
    }
}

  if (found) {
    vscode.window.showInformationMessage('Date and time found in the log file at line ' + (lineNumber + 1));
    const position = new vscode.Position(lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }  else {
    vscode.window.showInformationMessage('Date and time not found in the log file');
  }

  
} 