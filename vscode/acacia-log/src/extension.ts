// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { navigateToDateTime } from './utils/navigateToDateTime';
import { DateTime } from 'luxon';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "acacia-log" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('acacia-log.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from acacia-log!');
	});

	context.subscriptions.push(disposable);

	// Register the navigateToDateTime command
	let disposable2 = vscode.commands.registerCommand('extension.navigateToDateTime', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
		  vscode.window.showErrorMessage('No active editor found');
		  return;
		}
	
		const dateInput = await vscode.window.showInputBox({
			prompt: 'Enter the date (YYYY-MM-DD)',
			placeHolder: '2023-01-01'
		  });
	  
		  if (!dateInput) {
			vscode.window.showErrorMessage('Invalid date input');
			return;
		  }
	  
		  const timeInput = await vscode.window.showInputBox({
			prompt: 'Enter the time (HH:mm:ss)',
			placeHolder: '12:00:00'
		  });
	  
		  if (!timeInput) {
			vscode.window.showErrorMessage('Invalid time input');
			return;
		  }
	  
		  const dateTimeInput = `${dateInput}T${timeInput}`;
	
		if (!dateTimeInput) {
		  vscode.window.showErrorMessage('Invalid date and time input');
		  return;
		}
	
		const dateTime = DateTime.fromISO(dateTimeInput);
		if (!dateTime.isValid) {
		  vscode.window.showErrorMessage('Invalid date and time format');
		  return;
		}
	
		navigateToDateTime(dateTime);
	  });
	
	  context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
