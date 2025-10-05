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
    let logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
    let logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
    let searchDate = config.get<string>('logSearchDate') || '';
    let searchTime = config.get<string>('logSearchTime') || '';

    webviewView.webview.onDidReceiveMessage(
      async message => {
        let editor = vscode.window.activeTextEditor;
        console.log(message.command);
        
        try {
          switch (message.command) {
              
            case 'search':
              // Update configuration
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);

              // Execute navigation
              await navigateToDateTime();
              
              // Send success feedback
              webviewView.webview.postMessage({
                command: 'operationComplete',
                success: true,
                message: 'Navigation completed successfully'
              });
              
              return;
              
            case 'calculateSimilarLineCounts':
              // Update configuration
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);

              if (editor) {
                await calculateSimilarLineCounts(editor);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: true,
                  message: 'Similar line counts calculated successfully'
                });
              } else {
                vscode.window.showErrorMessage('No active editor found');
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: 'No active editor found'
                });
              }
              return;
              
            case 'drawLogTimeline':
              // Update configuration
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);
              
              if (editor) {
                await drawLogTimeline(editor);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: true,
                  message: 'Timeline drawn successfully'
                });
              } else {
                vscode.window.showErrorMessage('No active editor found');
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: 'No active editor found'
                });
              }
              return;
          }
        } catch (error) {
          // Handle any errors
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          vscode.window.showErrorMessage(`Error: ${errorMessage}`);
          webviewView.webview.postMessage({
            command: 'operationComplete',
            success: false,
            message: errorMessage
          });
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

          // Handle visibility changes to send the setValues message again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // reread the values from the configuration
        const config = vscode.workspace.getConfiguration('acacia-log');
        logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
        logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
        searchDate = config.get<string>('logSearchDate') || '';
        searchTime = config.get<string>('logSearchTime') || '';

        webviewView.webview.postMessage({
          command: 'setValues',
          logTimeRegex,
          logTimeFormat,
          searchDate,
          searchTime
        });
      }
    });

  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logSearch.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent;
  }
}