// navigate to a date time in the currently open log file in the editor

import * as vscode from 'vscode';
import { DateTime } from 'luxon';

const dateTimeRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

export async function navigateToDateTime(dateTime: DateTime) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const lines = text.split('\n');
  const lineCount = lines.length;

  let lineNumber = 0;
  let found = false;
  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    const match = line.match(dateTimeRegex);
    if (match) {
        const matchDateTime = DateTime.fromFormat(match[0], 'yyyy-MM-dd HH:mm:ss');
    console.log(`Found date time: ${matchDateTime.toISO()}`);
      if (matchDateTime.equals(dateTime)) {
        lineNumber = i;
        found = true;
        break;
      }
    }
  }

  if (found) {
    const position = new vscode.Position(lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }  else {
    vscode.window.showInformationMessage('Date and time not found in the log file');
  }
}
 
 