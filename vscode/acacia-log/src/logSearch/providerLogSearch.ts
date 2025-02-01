import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { navigateToDateTime } from '../utils/navigateToDateTime';
import { calculateSimilarLineCounts } from '../utils/calculateSimilarLineCounts';
import { drawLogTimeline } from '../utils/drawLogTimeline';


export class LogSearchProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.logSearch';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    const config = vscode.workspace.getConfiguration('acacia-log');
    const logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
    const logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
    const searchDate = config.get<string>('logSearchDate') || '';
    const searchTime = config.get<string>('logSearchTime') || '';

    webviewView.webview.onDidReceiveMessage(
      async message => {
        let editor = vscode.window.activeTextEditor;
        console.log(message.command);
        switch (message.command) {
            
          case 'search':
            vscode.window.showInformationMessage(`Searching for logs with regex: ${message.logTimeRegex}, format: ${message.logTimeFormat}, date: ${message.searchDate}, time: ${message.searchTime}`);
            
            await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
            await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
            await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
            await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);

            navigateToDateTime();
            
            
            return;
          case 'calculateSimilarLineCounts':

          await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);


                if (editor) {
                  calculateSimilarLineCounts(editor);
                } else {
                  vscode.window.showErrorMessage('No active editor found');
                }
                return;
          case 'drawLogTimeline':

          await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
          await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);
                if (editor) {
                  drawLogTimeline(editor);
                } else {
                  vscode.window.showErrorMessage('No active editor found');
                }
                return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    webviewView.webview.postMessage({
        command: 'setValues',
        logTimeRegex,
        logTimeFormat,
        searchDate,
        searchTime
      });  
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logSearch.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent;
  }
}