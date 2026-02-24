import * as vscode from 'vscode';

export function registerConfigCommands(context: vscode.ExtensionContext): void {
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
            placeHolder: logDateRegex || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}'
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
        const { navigateToDateTime } = require('../utils/navigateToDateTime');
        navigateToDateTime();
    }));
}
