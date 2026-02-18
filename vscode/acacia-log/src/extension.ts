// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { navigateToDateTime } from './utils/navigateToDateTime';
import { calculateSimilarLineCounts } from './utils/calculateSimilarLineCounts';
import { drawLogTimeline } from './utils/drawLogTimeline';
import { DateTime } from 'luxon';
import { create } from 'domain';
import { createLogPatterns } from './utils/createLogPatterns';
import { LogTreeProvider, LogTreeItem } from './logManagement/logTreeProvider';
import { UnifiedLogViewProvider } from './logSearch/unifiedLogViewProvider';
import { ResultDocumentProvider } from './utils/resultDocumentProvider';
import { LogGapReportProvider } from './logSearch/logGapReportProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "acacia-log" is now active!');

	// Create logPatterns.json file
	createLogPatterns();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('acacia-log.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from acacia-log!');
	});

	context.subscriptions.push(disposable);


	    // Register commands to set configuration settings
  context.subscriptions.push(vscode.commands.registerCommand('extension.setLogDateFormat', async () => {
    const config = vscode.workspace.getConfiguration('acacia-log');
    const logDateFormat = config.get<string>('logDateFormat');
	const input = await vscode.window.showInputBox({
      prompt: 'Enter the log date format',
      placeHolder: logDateFormat || 'yyyy-MM-dd HH:mm:ss'
    });
    if (input) {
      await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', input, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`Log date format set to ${input}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.setLogDateRegex', async () => {
    const config = vscode.workspace.getConfiguration('acacia-log');
	const logDateRegex = config.get<string>('logDateRegex');

	const input = await vscode.window.showInputBox({
      prompt: 'Enter the log date regular expression',
      placeHolder: logDateRegex ||  '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}'
    });
    if (input) {
      await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', input, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`Log date regular expression set to ${input}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.setLogSearchDate', async () => {
    const config = vscode.workspace.getConfiguration('acacia-log');
	const logSearchDate = config.get<string>('logSearchDate');

	const input = await vscode.window.showInputBox({
      prompt: 'Enter the log search date (YYYY-MM-DD)',
      placeHolder: logSearchDate || '2023-01-01'
    });
    if (input) {
      await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', input, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`Log search date set to ${input}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('extension.setLogSearchTime', async () => {
    const config = vscode.workspace.getConfiguration('acacia-log');
	const logSearchTime = config.get<string>('logSearchTime');

	const input = await vscode.window.showInputBox({
      prompt: 'Enter the log search time (HH:mm:ss)',
      placeHolder: logSearchTime || '12:00:00'
    });
    if (input) {
      await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', input, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`Log search time set to ${input}`);
    };
	navigateToDateTime();
  }));

    // Register the calculateSimilarLineCounts command
	context.subscriptions.push(vscode.commands.registerCommand('extension.calculateSimilarLineCounts', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
		  vscode.window.showErrorMessage('No active editor found');
		  return;
		}
	
		await calculateSimilarLineCounts(editor);
	  }));

	    // Register the drawLogTimeline command
  context.subscriptions.push(vscode.commands.registerCommand('extension.drawLogTimeline', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    drawLogTimeline(editor);
  }));

  // Register the Unified Log View Provider (tabbed interface)
	const unifiedLogViewProvider = new UnifiedLogViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
		  UnifiedLogViewProvider.viewType,
		  unifiedLogViewProvider
		)
	);

	// Register the Result Document Provider for editor tabs
	const resultProvider = ResultDocumentProvider.getInstance(context.extensionPath);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('acacia-log', resultProvider)
	);

	// Register the Log Tree Provider
	const logTreeProvider = new LogTreeProvider(context);
	const treeView = vscode.window.createTreeView('acacia-log.logExplorer', {
		treeDataProvider: logTreeProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(treeView);

	// Register the Log Gap Report Provider
	const logGapReportProvider = new LogGapReportProvider(context.extensionPath);

	// Track the currently selected/active log file
	let currentLogFile: string | undefined;

	// Double-click detection for tree view clicks
	let clickCount = 0;
	let clickTimer: NodeJS.Timeout | undefined;
	let lastClickedPath: string | undefined;
	const DOUBLE_CLICK_TIME = 300; // milliseconds

	// Register command that fires on every tree item click (even if already selected)
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.onFileClick', async (item: LogTreeItem) => {
			if (item.isFolder || !item.resourceUri) {
				return;
			}
			
			const currentPath = item.resourceUri.fsPath;
			
			// Update the current log file
			currentLogFile = currentPath;
			
			// If this is a different item, reset
			if (lastClickedPath !== currentPath) {
				clickCount = 0;
				lastClickedPath = currentPath;
				// Clear any existing timer
				if (clickTimer) {
					clearTimeout(clickTimer);
					clickTimer = undefined;
				}
			}
			
			// Increment click count
			clickCount++;
			
			console.log('[Extension] Click #' + clickCount + ' on:', currentPath);
			
			// Clear any existing timer
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = undefined;
			}
			
			if (clickCount === 1) {
				// First click - wait to see if there's a second click
				console.log('[Extension] First click detected, waiting for potential double-click');
				clickTimer = setTimeout(async () => {
					// Single click confirmed
					console.log('[Extension] Single-click confirmed - showing file info');
					await unifiedLogViewProvider.showFileInfo(item.resourceUri!, item.metadata);
					clickCount = 0;
					lastClickedPath = undefined;
				}, DOUBLE_CLICK_TIME);
			} else if (clickCount >= 2) {
				// Double click detected
				console.log('[Extension] Double-click detected - opening file in editor');
				await vscode.commands.executeCommand('vscode.open', item.resourceUri);
				clickCount = 0;
				lastClickedPath = undefined;
			}
		})
	);

	// Register tree view commands
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.refresh', () => {
			logTreeProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.addFolder', () => {
			logTreeProvider.addFolder();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.removeFolder', (item: LogTreeItem) => {
			logTreeProvider.removeFolder(item);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.openFile', (item: LogTreeItem) => {
			logTreeProvider.openFile(item);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.showFileInfo', async (item: LogTreeItem) => {
			if (item.resourceUri) {
				await unifiedLogViewProvider.showFileInfo(item.resourceUri, item.metadata);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.revealInExplorer', (item: LogTreeItem) => {
			logTreeProvider.revealInExplorer(item);
		})
	);

	// Register gap report generation command
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.generateGapReport', async () => {
			// Get the currently selected file from tree view or active editor
			let filePath: string | undefined = currentLogFile;

			// If no file selected in tree, try to get from active editor
			if (!filePath) {
				const selection = treeView.selection[0];
				if (selection && selection.resourceUri && !selection.isFolder) {
					filePath = selection.resourceUri.fsPath;
				} else {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						filePath = activeEditor.document.uri.fsPath;
					}
				}
			}

			if (!filePath) {
				vscode.window.showErrorMessage('Please select a log file first');
				return;
			}

			// Generate the gap report
			await logGapReportProvider.generateReport(filePath);
		})
	);

	// Register unified view tab switching commands
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToLogAnalysis', () => {
			unifiedLogViewProvider.switchTab('logAnalysis');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToSimilarLines', () => {
			unifiedLogViewProvider.switchTab('similarLines');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToTimeline', () => {
			unifiedLogViewProvider.switchTab('timeline');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToPatternSearch', () => {
			unifiedLogViewProvider.switchTab('patternSearch');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToFileInfo', () => {
			unifiedLogViewProvider.switchTab('fileInfo');
		})
	);

	// Dispose tree provider on deactivation
	context.subscriptions.push({
		dispose: () => logTreeProvider.dispose()
	});

}

// This method is called when your extension is deactivated
export function deactivate() {}
