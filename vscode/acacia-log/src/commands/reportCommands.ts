import * as vscode from 'vscode';
import { LogTreeItem } from '../logManagement/logTreeProvider';

// Lazy-loaded provider instances
let _logGapReportProvider: import('../logSearch/logGapReportProvider').LogGapReportProvider | undefined;
let _logChunkStatsProvider: import('../logSearch/logChunkStatsProvider').LogChunkStatsProvider | undefined;
let _logChunkStatsComparisonProvider: import('../logSearch/logChunkStatsComparisonProvider').LogChunkStatsComparisonProvider | undefined;

function getLogGapReportProvider(extensionPath: string) {
    if (!_logGapReportProvider) {
        const { LogGapReportProvider } = require('../logSearch/logGapReportProvider');
        _logGapReportProvider = new LogGapReportProvider(extensionPath);
    }
    return _logGapReportProvider!;
}

function getLogChunkStatsProvider(extensionPath: string) {
    if (!_logChunkStatsProvider) {
        const { LogChunkStatsProvider } = require('../logSearch/logChunkStatsProvider');
        _logChunkStatsProvider = new LogChunkStatsProvider(extensionPath);
    }
    return _logChunkStatsProvider!;
}

function getLogChunkStatsComparisonProvider(extensionPath: string) {
    if (!_logChunkStatsComparisonProvider) {
        const { LogChunkStatsComparisonProvider } = require('../logSearch/logChunkStatsComparisonProvider');
        _logChunkStatsComparisonProvider = new LogChunkStatsComparisonProvider(extensionPath);
    }
    return _logChunkStatsComparisonProvider!;
}

export function registerReportCommands(
    context: vscode.ExtensionContext,
    treeView: vscode.TreeView<LogTreeItem>,
    getCurrentLogFile: () => string | undefined
): void {
    // Register gap report generation command
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.generateGapReport', async () => {
            // Get the currently selected file from tree view or active editor
            let filePath: string | undefined = getCurrentLogFile();

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
            await getLogGapReportProvider(context.extensionPath).generateReport(filePath);
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

                await getLogChunkStatsComparisonProvider(context.extensionPath).generateComparison(filePaths);
            })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.generateChunkStatsReport', async () => {
            // Resolve the target log file (same resolution order as gap report)
            let filePath: string | undefined = getCurrentLogFile();

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

            await getLogChunkStatsProvider(context.extensionPath).generateReport(filePath);
        })
    );
}
