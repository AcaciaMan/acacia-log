import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogContext } from '../utils/log-context';

/**
 * Log Manager View Provider
 * Provides a compact sidebar webview that acts as a dashboard and entry point
 * to the full Log Manager Panel.
 */
export class LogManagerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.logManager';
  private _view?: vscode.WebviewView;
  private _updateTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this._getHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'openLogManagerPanel':
              await vscode.commands.executeCommand('acacia-log.openLogManagerPanel');
              return;

            case 'quickPatternSearch':
              await vscode.commands.executeCommand('acacia-log.openLogManagerPanel', { tab: 'patternSearch' });
              return;

            case 'quickGapReport':
              await vscode.commands.executeCommand('acacia-log.logExplorer.generateGapReport');
              return;

            case 'quickChunkStats':
              await vscode.commands.executeCommand('acacia-log.logExplorer.generateChunkStatsReport');
              return;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
          vscode.window.showErrorMessage(`Log Manager: ${errorMessage}`);
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Subscribe to active file changes
    const disposable = LogContext.getInstance().onDidChangeActiveFile(() => {
      this._sendActiveFileInfoDebounced();
    });
    this.context.subscriptions.push(disposable);

    // Send initial active file info
    this._sendActiveFileInfo();

    // Re-send on visibility change
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendActiveFileInfo();
      }
    });
  }

  /**
   * Manually trigger an active file info update.
   * Can be called by external code.
   */
  public updateActiveFileInfo(): void {
    this._sendActiveFileInfo();
  }

  private _sendActiveFileInfoDebounced(): void {
    if (this._updateTimer) { clearTimeout(this._updateTimer); }
    this._updateTimer = setTimeout(() => this._sendActiveFileInfo(), 150);
  }

  private async _sendActiveFileInfo(): Promise<void> {
    if (!this._view) {
      return;
    }

    const filePath = LogContext.getInstance().activeFilePath;

    if (!filePath) {
      this._reply(this._view, { command: 'clearActiveFile' });
      return;
    }

    try {
      const fileName = path.basename(filePath);

      // Get file size
      let fileSize: number | undefined;
      try {
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
      } catch {
        // File stat failed — not critical
      }

      // Get line count and detect timestamp format
      let lineCount: number | undefined;
      let timestampDetected = false;
      let timestampFormat: string | undefined;

      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        lineCount = doc.lineCount;

        try {
          const detection = await LogContext.getInstance().getOrDetectFormat(doc);
          if (detection.detected && detection.format) {
            timestampDetected = true;
            timestampFormat = detection.format.pattern;
          }
        } catch {
          // Format detection failed — not critical
        }
      } catch {
        // Document open failed — not critical
      }

      this._reply(this._view, {
        command: 'updateActiveFile',
        fileName,
        filePath,
        fileSize,
        lineCount,
        timestampDetected,
        timestampFormat
      });
    } catch {
      this._reply(this._view, { command: 'clearActiveFile' });
    }
  }

  private _reply(view: vscode.WebviewView, message: object): void {
    view.webview.postMessage(message);
  }

  private _getHtml(): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logManagerView.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const codiconsUri = this._view!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
    html = html.replace(/\{\{CODICONS_URI\}\}/g, codiconsUri.toString());
    html = html.replace(/\{\{CSP_SOURCE\}\}/g, this._view!.webview.cspSource);

    return html;
  }
}
