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
import { EditorToolsViewProvider } from './logSearch/editorToolsViewProvider';
import { ResultDocumentProvider } from './utils/resultDocumentProvider';
import { readLineRange } from './utils/log-file-reader';
import { LogGapReportProvider } from './logSearch/logGapReportProvider';
import { LogChunkStatsProvider } from './logSearch/logChunkStatsProvider';
import { LogChunkStatsComparisonProvider } from './logSearch/logChunkStatsComparisonProvider';
import { convertJsonlToLog } from './utils/jsonl-to-log';
import { convertToJsonl } from './utils/log-to-jsonl-command';
import { LogLensDecorationProvider } from './logSearch/logLensDecorationProvider';

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

	// ── Load more context above current chunk ──────────────────────────
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.loadMoreAbove', async () => {
			const resultProvider = ResultDocumentProvider.getInstance();
			const state = resultProvider.getChunkState();
			if (!state) {
				vscode.window.showWarningMessage('[Acacia Log] No chunk loaded yet.');
				return;
			}

			const STEP = 100;
			const newCtxStart = Math.max(0, state.ctxStart - STEP);
			if (newCtxStart === state.ctxStart) {
				vscode.window.showInformationMessage('[Acacia Log] Already at the start of file.');
				return;
			}

			const { lines } = await readLineRange(
				state.filePath, newCtxStart, state.ctxEnd, state.lineIndex
			);

			const padWidth = String(state.ctxEnd + 1).length;
			const header =
				`// File: ${state.filePath}\n` +
				`// Matched line: ${state.matchedLine + 1}\n` +
				`// Showing lines ${newCtxStart + 1}\u2013${state.ctxEnd + 1} of ${state.totalLines}\n`;
			const body = lines
				.map((line, i) => {
					const realLineNum = newCtxStart + i + 1;
					return `${String(realLineNum).padStart(padWidth, ' ')}: ${line}`;
				})
				.join('\n');

			const resultEditor = await resultProvider.openLogChunkResult(header + body);

			// Keep matched line visible
			const lineInChunk = state.matchedLine - newCtxStart;
			const virtualLine = 3 + lineInChunk;
			const pos = new vscode.Position(virtualLine, 0);
			resultEditor.selection = new vscode.Selection(pos, pos);
			resultEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

			resultProvider.setChunkState({ ...state, ctxStart: newCtxStart });
		})
	);

	// ── Load more context below current chunk ──────────────────────────
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.loadMoreBelow', async () => {
			const resultProvider = ResultDocumentProvider.getInstance();
			const state = resultProvider.getChunkState();
			if (!state) {
				vscode.window.showWarningMessage('[Acacia Log] No chunk loaded yet.');
				return;
			}

			const STEP = 100;
			const newCtxEnd = Math.min(state.totalLines - 1, state.ctxEnd + STEP);
			if (newCtxEnd === state.ctxEnd) {
				vscode.window.showInformationMessage('[Acacia Log] Already at the end of file.');
				return;
			}

			const { lines } = await readLineRange(
				state.filePath, state.ctxStart, newCtxEnd, state.lineIndex
			);

			const padWidth = String(newCtxEnd + 1).length;
			const header =
				`// File: ${state.filePath}\n` +
				`// Matched line: ${state.matchedLine + 1}\n` +
				`// Showing lines ${state.ctxStart + 1}\u2013${newCtxEnd + 1} of ${state.totalLines}\n`;
			const body = lines
				.map((line, i) => {
					const realLineNum = state.ctxStart + i + 1;
					return `${String(realLineNum).padStart(padWidth, ' ')}: ${line}`;
				})
				.join('\n');

			const resultEditor = await resultProvider.openLogChunkResult(header + body);

			// Keep matched line visible
			const lineInChunk = state.matchedLine - state.ctxStart;
			const virtualLine = 3 + lineInChunk;
			const pos = new vscode.Position(virtualLine, 0);
			resultEditor.selection = new vscode.Selection(pos, pos);
			resultEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

			resultProvider.setChunkState({ ...state, ctxEnd: newCtxEnd });
		})
	);

	// Register the Log Tree Provider
	const logTreeProvider = new LogTreeProvider(context);
	// Ensure filter context key has a defined initial value
	vscode.commands.executeCommand('setContext', 'acacia-log.filterActive', false);
	const treeView = vscode.window.createTreeView('acacia-log.logExplorer', {
		treeDataProvider: logTreeProvider,
		showCollapseAll: true,
		canSelectMany: true
	});
	context.subscriptions.push(treeView);

	// Register the Editor Tools webview provider (Log Search, Similar Lines, Timeline tabs)
	const editorToolsViewProvider = new EditorToolsViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			EditorToolsViewProvider.viewType,
			editorToolsViewProvider
		)
	);

	// Register the Log Gap Report Provider
	const logGapReportProvider = new LogGapReportProvider(context.extensionPath);

	// Register the Log Chunk Statistics Provider
	const logChunkStatsProvider = new LogChunkStatsProvider(context.extensionPath);

	// Register the Log Chunk Statistics Comparison Provider
	const logChunkStatsComparisonProvider = new LogChunkStatsComparisonProvider(context.extensionPath);

	const logLensDecorationProvider = new LogLensDecorationProvider(context);
	logLensDecorationProvider.activate();
	context.subscriptions.push({ dispose: () => logLensDecorationProvider.dispose() });
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.toggleLensDecorations', () => {
			logLensDecorationProvider.toggle();
		})
	);

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

			// Keep the Editor Tools webview in sync so it can operate on this
			// file even without an open text editor.
			editorToolsViewProvider.setSelectedLogFile(currentPath);
			
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

	// Register chunk statistics comparison command (multi-file)
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.compareChunkStats',
			async (_item?: LogTreeItem, allItems?: LogTreeItem[]) => {
				// When invoked from context menu, allItems holds all selected items.
				// When invoked from toolbar, fall back to treeView.selection.
				const selected: LogTreeItem[] =
					(allItems && allItems.length > 0)
						? allItems
						: (treeView.selection as LogTreeItem[]);

				const filePaths = selected
					.filter(i => !i.isFolder && i.resourceUri)
					.map(i => i.resourceUri!.fsPath);

				if (filePaths.length < 2) {
					vscode.window.showWarningMessage(
						'Select at least 2 log files in the Log Files tree (hold Ctrl/Cmd to multi-select), then run this command.'
					);
					return;
				}

				await logChunkStatsComparisonProvider.generateComparison(filePaths);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.generateChunkStatsReport', async () => {
			// Resolve the target log file (same resolution order as gap report)
			let filePath: string | undefined = currentLogFile;

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

			await logChunkStatsProvider.generateReport(filePath);
		})
	);

	// Register Log → JSONL converter command (active editor)
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.convertToJsonl', convertToJsonl)
	);

	// Register Log → JSONL converter command (tree context menu)
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.convertToJsonl',
			async (_item?: LogTreeItem) => {
				// Resolve target file: tree selection → tracked log file → active editor
				let filePath: string | undefined;
				const selection = treeView.selection[0];
				if (selection && selection.resourceUri && !selection.isFolder) {
					filePath = selection.resourceUri.fsPath;
				} else if (currentLogFile) {
					filePath = currentLogFile;
				} else {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) { filePath = activeEditor.document.uri.fsPath; }
				}
				if (!filePath) {
					vscode.window.showErrorMessage('Acacia Log: Please select a log file first.');
					return;
				}
				const doc = await vscode.workspace.openTextDocument(filePath);
				await convertToJsonl(doc);
			}
		)
	);

	// Register JSONL → Log converter command
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.logExplorer.convertJsonlToLog',
			async (_item?: LogTreeItem, _allItems?: LogTreeItem[]) => {
				// Resolve target file: tree selection → active editor
				let filePath: string | undefined;
				const selection = treeView.selection[0];
				if (selection && selection.resourceUri && !selection.isFolder) {
					filePath = selection.resourceUri.fsPath;
				} else if (currentLogFile) {
					filePath = currentLogFile;
				} else {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) { filePath = activeEditor.document.uri.fsPath; }
				}
				if (!filePath) {
					vscode.window.showErrorMessage('Please select a JSONL file first.');
					return;
				}
				await convertJsonlToLog(filePath);
			}
		)
	);

	// Register unified view tab switching commands
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.unifiedView.switchToLogAnalysis', () => {
			vscode.commands.executeCommand('acacia-log.editorTools.focus');
			editorToolsViewProvider.switchTab('logSearch');
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
		vscode.commands.registerCommand('acacia-log.editorTools.switchToSimilarLines', () => {
			vscode.commands.executeCommand('acacia-log.editorTools.focus');
			editorToolsViewProvider.switchTab('similarLines');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.editorTools.switchToTimeline', () => {
			vscode.commands.executeCommand('acacia-log.editorTools.focus');
			editorToolsViewProvider.switchTab('timeline');
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
		const allTypes = ['.log', '.txt', '.out', '.err', '.trace', '.jsonl', '.ndjson'];
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
