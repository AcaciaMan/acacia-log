// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { navigateToDateTime } from './utils/navigateToDateTime';
import { calculateSimilarLineCounts } from './utils/calculateSimilarLineCounts';
import { drawLogTimeline } from './utils/drawLogTimeline';
import { DateTime } from 'luxon';
import { create } from 'domain';
import { createLogPatterns } from './utils/createLogPatterns';
import { LogTreeProvider, LogTreeItem, FilterOptions } from './logManagement/logTreeProvider';
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
	// Ensure filter context key has a defined initial value
	vscode.commands.executeCommand('setContext', 'acacia-log.filterActive', false);
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
					// Single click confirmed - ensure full metadata is loaded first
					console.log('[Extension] Single-click confirmed - showing file info');
					await logTreeProvider.loadMetadata(item);
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
		vscode.commands.registerCommand('acacia-log.logExplorer.filter', () => {
			showFilterDialog(logTreeProvider);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.clearFilter', () => {
			showFilterDialog(logTreeProvider);
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

// ── Filter dialog ────────────────────────────────────────────────────────────

interface ValuedQuickPickItem extends vscode.QuickPickItem {
	value?: string;
}

async function showFilterDialog(provider: LogTreeProvider): Promise<void> {
	const current = provider.getFilter();

	// Build summary of currently active filters for display
	const parts: string[] = [];
	if (current.dateFilter) {
		const rangeLabel: Record<string, string> = {
			today: 'Today', yesterday: 'Yesterday',
			last7days: 'Last 7 days', last30days: 'Last 30 days', custom: 'Custom'
		};
		parts.push(`Date: ${rangeLabel[current.dateFilter.range]}`);
	}
	if (current.fileTypes && current.fileTypes.length > 0) {
		parts.push(`Types: ${current.fileTypes.join(', ')}`);
	}
	const activeSummary = parts.length > 0 ? parts.join('  |  ') : '';

	// ── Step 1: action selection ──────────────────────────────────────────────
	const actionItems: ValuedQuickPickItem[] = [];
	if (provider.hasActiveFilter()) {
		actionItems.push({
			label: '$(close) Clear All Filters',
			description: activeSummary,
			value: 'clear'
		});
		actionItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
	}
	actionItems.push({ label: '$(calendar) Filter by Date…', value: 'date' });
	actionItems.push({ label: '$(file-text) Filter by File Type…', value: 'type' });

	const action = await vscode.window.showQuickPick(actionItems, {
		title: 'Filter Log Files',
		placeHolder: activeSummary || 'Select a filter type…'
	}) as ValuedQuickPickItem | undefined;
	if (!action) { return; }

	if (action.value === 'clear') {
		provider.setFilter({});
		return;
	}

	// ── Date filter ───────────────────────────────────────────────────────────
	if (action.value === 'date') {
		const rangeItems: ValuedQuickPickItem[] = [
			{ label: 'Today', description: 'Files modified or created today', value: 'today' },
			{ label: 'Yesterday', description: 'Files modified or created yesterday', value: 'yesterday' },
			{ label: 'Last 7 days', value: 'last7days' },
			{ label: 'Last 30 days', value: 'last30days' },
			{ label: '$(calendar) Custom date…', description: 'Enter a specific start date', value: 'custom' }
		];
		// Mark currently active range
		if (current.dateFilter) {
			const cur = rangeItems.find(i => i.value === current.dateFilter!.range);
			if (cur) { cur.description = (cur.description ? cur.description + '  ' : '') + '[active]'; }
		}
		const rangePick = await vscode.window.showQuickPick(rangeItems, {
			title: 'Filter by date (modified or created)',
			placeHolder: 'Show files whose modified or created date falls in this range'
		}) as ValuedQuickPickItem | undefined;
		if (!rangePick) { return; }
		type DateRange = NonNullable<FilterOptions['dateFilter']>['range'];
		const range = rangePick.value as DateRange;

		if (range === 'custom') {
			const defaultDate = current.dateFilter?.customDate
				? current.dateFilter.customDate.toISOString().split('T')[0]
				: new Date().toISOString().split('T')[0];
			const input = await vscode.window.showInputBox({
				title: 'Custom start date',
				prompt: 'Show files modified or created on or after this date (YYYY-MM-DD)',
				value: defaultDate,
				validateInput: v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Use YYYY-MM-DD format'
			});
			if (!input) { return; }
			const [y, m, d] = input.split('-').map(Number);
			provider.setFilter({ ...current, dateFilter: { range: 'custom', customDate: new Date(y, m - 1, d) } });
		} else {
			provider.setFilter({ ...current, dateFilter: { range } });
		}
		return;
	}

	// ── File-type filter ──────────────────────────────────────────────────────
	if (action.value === 'type') {
		const allTypes = ['.log', '.txt', '.out', '.err', '.trace'];
		const activeTypes = current.fileTypes ?? [];
		const typeItems: ValuedQuickPickItem[] = allTypes.map(ext => ({
			label: `*${ext}`,
			value: ext,
			picked: activeTypes.length === 0 || activeTypes.includes(ext)
		}));
		const selected = await vscode.window.showQuickPick(typeItems, {
			title: 'Filter by file type',
			placeHolder: 'Deselect types to hide them',
			canPickMany: true
		}) as ValuedQuickPickItem[] | undefined;
		if (!selected) { return; }
		const chosen = selected.map(i => i.value as string);
		// All selected == no filter; subset == filter
		if (chosen.length === 0 || chosen.length === allTypes.length) {
			const { fileTypes: _removed, ...rest } = current;
			provider.setFilter(rest);
		} else {
			provider.setFilter({ ...current, fileTypes: chosen });
		}
	}
}
