import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'search':
            vscode.window.showInformationMessage(`Searching for logs with regex: ${message.logTimeRegex}, format: ${message.logTimeFormat}, date: ${message.searchDate}, time: ${message.searchTime}`);
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logSearch.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent;
  }
}