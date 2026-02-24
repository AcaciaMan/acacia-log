import * as vscode from 'vscode';

export function registerAnalysisCommands(context: vscode.ExtensionContext): void {
    // Register the calculateSimilarLineCounts command
    context.subscriptions.push(vscode.commands.registerCommand('extension.calculateSimilarLineCounts', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const { calculateSimilarLineCounts } = require('../utils/calculateSimilarLineCounts');
        await calculateSimilarLineCounts(editor);
    }));

    // Register the drawLogTimeline command
    context.subscriptions.push(vscode.commands.registerCommand('extension.drawLogTimeline', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const { drawLogTimeline } = require('../utils/drawLogTimeline');
        drawLogTimeline(editor);
    }));
}
