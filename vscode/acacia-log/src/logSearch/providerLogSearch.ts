import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class LogSearchProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'acacia-log.logSearch';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'resources', 'logSearch.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        return htmlContent
            .replace(/{{scriptUri}}/g, scriptUri.toString())
            .replace(/{{styleUri}}/g, styleUri.toString());
    }
}