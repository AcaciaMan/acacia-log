import * as vscode from 'vscode';
import { LogTreeItem } from '../logManagement/logTreeProvider';
import { ILogContext } from '../utils/log-context';

export function registerConversionCommands(
    context: vscode.ExtensionContext,
    treeView: vscode.TreeView<LogTreeItem>,
    logContext: ILogContext
): void {
    // Register Log → JSONL converter command (active editor)
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.convertToJsonl', async (...args: any[]) => {
            const { convertToJsonl } = require('../utils/log-to-jsonl-command');
            return convertToJsonl(...args);
        })
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
                } else if (logContext.activeFilePath) {
                    filePath = logContext.activeFilePath;
                } else {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) { filePath = activeEditor.document.uri.fsPath; }
                }
                if (!filePath) {
                    vscode.window.showErrorMessage('Acacia Log: Please select a log file first.');
                    return;
                }
                const doc = await vscode.workspace.openTextDocument(filePath);
                const { convertToJsonl } = require('../utils/log-to-jsonl-command');
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
                } else if (logContext.activeFilePath) {
                    filePath = logContext.activeFilePath;
                } else {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) { filePath = activeEditor.document.uri.fsPath; }
                }
                if (!filePath) {
                    vscode.window.showErrorMessage('Please select a JSONL file first.');
                    return;
                }
                const { convertJsonlToLog } = require('../utils/jsonl-to-log');
                await convertJsonlToLog(filePath);
            }
        )
    );
}
