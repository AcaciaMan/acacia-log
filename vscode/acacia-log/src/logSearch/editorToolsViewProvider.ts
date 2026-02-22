import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { navigateToDateTime } from '../utils/navigateToDateTime';
import { calculateSimilarLineCounts } from '../utils/calculateSimilarLineCounts';
import { drawLogTimeline } from '../utils/drawLogTimeline';
import { getOrDetectFormat, getRegexPatternString } from '../utils/format-cache';

/**
 * Editor Tools View Provider
 * Provides a tabbed webview with Log Search, Similar Lines, and Timeline tabs.
 */
export class EditorToolsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.editorTools';
  private _view?: vscode.WebviewView;

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

    const config = vscode.workspace.getConfiguration('acacia-log');
    let logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
    let logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
    let searchDate = config.get<string>('logSearchDate') || '';
    let searchTime = config.get<string>('logSearchTime') || '';

    const sendValues = () => {
      webviewView.webview.postMessage({ command: 'setValues', logTimeRegex, logTimeFormat, searchDate, searchTime });
    };

    webviewView.webview.onDidReceiveMessage(
      async message => {
        const editor = vscode.window.activeTextEditor;
        try {
          switch (message.command) {

            case 'search':
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);
              await navigateToDateTime();
              this._reply(webviewView, { command: 'operationComplete', success: true, message: 'Navigation completed successfully' });
              return;

            case 'calculateSimilarLineCounts':
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              if (editor) {
                await calculateSimilarLineCounts(editor);
                this._reply(webviewView, { command: 'operationComplete', success: true, message: 'Similar line counts calculated successfully' });
              } else {
                vscode.window.showErrorMessage('No active editor found');
                this._reply(webviewView, { command: 'operationComplete', success: false, message: 'No active editor found' });
              }
              return;

            case 'drawLogTimeline':
              await vscode.workspace.getConfiguration('acacia-log').update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
              if (editor) {
                await drawLogTimeline(editor);
                this._reply(webviewView, { command: 'operationComplete', success: true, message: 'Timeline drawn successfully' });
              } else {
                vscode.window.showErrorMessage('No active editor found');
                this._reply(webviewView, { command: 'operationComplete', success: false, message: 'No active editor found' });
              }
              return;

            case 'testRegex': {
              const regex = message.logTimeRegex;
              if (!editor) {
                this._reply(webviewView, { command: 'testRegexResult', success: false, message: '✗ No active editor found.' });
                return;
              }
              try {
                const pat = new RegExp(regex);
                const doc = editor.document;
                let count = 0, first = '', last = '';
                const limit = Math.min(doc.lineCount, 1000);
                for (let i = 0; i < limit; i++) {
                  const m = doc.lineAt(i).text.match(pat);
                  if (m) { count++; if (count === 1) { first = m[0]; } last = m[0]; }
                }
                if (count > 0) {
                  let msg = `✓ Found ${count} match(es) in first ${limit} lines\nFirst: "${first}"`;
                  if (count > 1) { msg += `\nLast: "${last}"`; }
                  this._reply(webviewView, { command: 'testRegexResult', success: true, message: msg });
                } else {
                  this._reply(webviewView, { command: 'testRegexResult', success: false, message: `✗ No matches found in first ${limit} lines.` });
                }
              } catch (e) {
                this._reply(webviewView, { command: 'testRegexResult', success: false, message: `✗ Regex error: ${e instanceof Error ? e.message : e}` });
              }
              return;
            }

            case 'autoDetectTimestampFormat':
              if (editor) {
                try {
                  const detection = await getOrDetectFormat(editor.document);
                  if (detection.detected && detection.format) {
                    const regexPattern = getRegexPatternString(detection.format);
                    const formatMap: Record<string, string> = {
                      'yyyy-MM-ddTHH:mm:ss.SSS': "yyyy-MM-dd'T'HH:mm:ss.SSS",
                      'yyyy-MM-dd HH:mm:ss.SSS': 'yyyy-MM-dd HH:mm:ss.SSS',
                      'yyyy-MM-dd HH:mm:ss': 'yyyy-MM-dd HH:mm:ss',
                      'yyyy-MM-dd': 'yyyy-MM-dd',
                      'dd-MM-yyyy HH:mm': 'dd-MM-yyyy HH:mm',
                      'MM-dd-yyyy HH:mm': 'MM-dd-yyyy HH:mm',
                      'dd/MM/yyyy HH:mm:ss': 'dd/MM/yyyy HH:mm:ss',
                      'dd/MM/yyyy HH:mm': 'dd/MM/yyyy HH:mm',
                      'MM/dd/yyyy HH:mm:ss': 'MM/dd/yyyy HH:mm:ss',
                      'MM/dd/yyyy HH:mm': 'MM/dd/yyyy HH:mm',
                      'dd.MM.yyyy HH:mm:ss': 'dd.MM.yyyy HH:mm:ss',
                      'dd.MM.yyyy HH:mm': 'dd.MM.yyyy HH:mm',
                    };
                    const fmt = formatMap[detection.format.pattern] || detection.format.pattern;
                    this._reply(webviewView, {
                      command: 'timestampFormatDetected', success: true, detected: true,
                      regex: regexPattern, format: fmt, pattern: detection.format.pattern,
                      totalLines: detection.totalLines,
                      message: `✓ Detected: ${detection.format.pattern}`,
                      tab: message.tab
                    });
                  } else {
                    this._reply(webviewView, { command: 'timestampFormatDetected', success: false, detected: false, message: '✗ Could not detect timestamp format', tab: message.tab });
                  }
                } catch (e) {
                  this._reply(webviewView, { command: 'timestampFormatDetected', success: false, detected: false, message: `✗ Error: ${e instanceof Error ? e.message : e}`, tab: message.tab });
                }
              } else {
                this._reply(webviewView, { command: 'timestampFormatDetected', success: false, detected: false, message: '✗ No active editor found', tab: message.tab });
              }
              return;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
          vscode.window.showErrorMessage(`Error: ${errorMessage}`);
          this._reply(webviewView, { command: 'operationComplete', success: false, message: errorMessage });
        }
      },
      undefined,
      this.context.subscriptions
    );

    sendValues();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        const cfg = vscode.workspace.getConfiguration('acacia-log');
        logTimeRegex = cfg.get<string>('logDateRegex') || logTimeRegex;
        logTimeFormat = cfg.get<string>('logDateFormat') || logTimeFormat;
        searchDate = cfg.get<string>('logSearchDate') || searchDate;
        searchTime = cfg.get<string>('logSearchTime') || searchTime;
        sendValues();
      }
    });
  }

  public switchTab(tabName: 'logSearch' | 'similarLines' | 'timeline'): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'switchTab', tabName });
    }
  }

  private _reply(view: vscode.WebviewView, message: object): void {
    view.webview.postMessage(message);
  }

  private _getHtml(): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'editorToolsView.html');
    return fs.readFileSync(htmlPath, 'utf8');
  }
}
