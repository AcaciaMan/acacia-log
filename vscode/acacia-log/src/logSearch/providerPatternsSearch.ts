import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class providerPatternsSearch implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.patternsSearch';

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
    const logFilePath = config.get<string>('logFilePath') || '';
    const searchPatternsFilePath = config.get<string>('patternsFilePath') || '';    

    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'search':
            const logFilePath = message.logFilePath;
            const searchPatternsFilePath = message.searchPatternsFilePath;

            if (!fs.existsSync(logFilePath)) {
              vscode.window.showErrorMessage(`Log file not found: ${logFilePath}`);
              return;
            }

            if (!fs.existsSync(searchPatternsFilePath)) {
              vscode.window.showErrorMessage(`Search patterns file not found: ${searchPatternsFilePath}`);
              return;
            }

            // store the log file and search patterns file paths in the configuration
            vscode.workspace.getConfiguration('acacia-log').update('logFilePath', logFilePath, vscode.ConfigurationTarget.Workspace);
            vscode.workspace.getConfiguration('acacia-log').update('patternsFilePath', searchPatternsFilePath, vscode.ConfigurationTarget.Workspace);

            const logText = fs.readFileSync(logFilePath, 'utf8');
            const searchPatterns = JSON.parse(fs.readFileSync(searchPatternsFilePath, 'utf8'));

            // Perform search using logText and searchPatterns
            // ...

            vscode.window.showInformationMessage('Search completed');
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    webviewView.webview.postMessage({
        command: 'setValues',
        logFilePath,
        searchPatternsFilePath
      });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logPatternsSearch.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent;
  }
}