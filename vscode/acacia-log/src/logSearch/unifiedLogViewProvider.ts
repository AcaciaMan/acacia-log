import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { navigateToDateTime } from '../utils/navigateToDateTime';
import { calculateSimilarLineCounts } from '../utils/calculateSimilarLineCounts';
import { drawLogTimeline } from '../utils/drawLogTimeline';
import { readLogPatterns } from '../utils/readLogPatterns';

/**
 * Unified Log View Provider with tabbed interface
 * Combines log search, pattern search, and timeline functionality
 */
export class UnifiedLogViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.unifiedView';

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

    // Load configuration values
    const config = vscode.workspace.getConfiguration('acacia-log');
    let logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
    let logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
    let searchDate = config.get<string>('logSearchDate') || '';
    let searchTime = config.get<string>('logSearchTime') || '';
    let logFilePath = config.get<string>('logFilePath') || '';
    let searchPatternsFilePath = config.get<string>('patternsFilePath') || '';

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async message => {
        let editor = vscode.window.activeTextEditor;
        console.log('Received command:', message.command);
        
        try {
          switch (message.command) {
            // ==== Log Search Tab Commands ====
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
              
            case 'testRegex':
              // Test regex pattern against the current file
              if (editor) {
                const document = editor.document;
                const regex = new RegExp(message.logTimeRegex);
                let matchCount = 0;
                let firstMatch = '';
                let lastMatch = '';
                
                try {
                  for (let i = 0; i < document.lineCount && i < 1000; i++) {
                    const lineText = document.lineAt(i).text;
                    const match = lineText.match(regex);
                    if (match) {
                      matchCount++;
                      if (matchCount === 1) {
                        firstMatch = match[0];
                      }
                      lastMatch = match[0];
                    }
                  }
                  
                  const totalLines = document.lineCount;
                  const scannedLines = Math.min(totalLines, 1000);
                  
                  if (matchCount > 0) {
                    let resultMessage = `✓ Found ${matchCount} match(es) in first ${scannedLines} lines`;
                    if (totalLines > 1000) {
                      resultMessage += ` (file has ${totalLines} lines total)`;
                    }
                    resultMessage += `\nFirst: "${firstMatch}"`;
                    if (matchCount > 1) {
                      resultMessage += `\nLast: "${lastMatch}"`;
                    }
                    
                    webviewView.webview.postMessage({
                      command: 'testRegexResult',
                      success: true,
                      message: resultMessage
                    });
                  } else {
                    webviewView.webview.postMessage({
                      command: 'testRegexResult',
                      success: false,
                      message: `✗ No matches found in first ${scannedLines} lines. Check your regex pattern.`
                    });
                  }
                } catch (error) {
                  const errorMsg = error instanceof Error ? error.message : 'Invalid regex';
                  webviewView.webview.postMessage({
                    command: 'testRegexResult',
                    success: false,
                    message: `✗ Regex error: ${errorMsg}`
                  });
                }
              } else {
                webviewView.webview.postMessage({
                  command: 'testRegexResult',
                  success: false,
                  message: '✗ No active editor found. Please open a log file.'
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

            // ==== Pattern Search Tab Commands ====
            case 'searchPatterns':
              const searchLogFilePath = message.logFilePath;
              const patternFilePath = message.searchPatternsFilePath;

              if (!fs.existsSync(searchLogFilePath)) {
                vscode.window.showErrorMessage(`Log file not found: ${searchLogFilePath}`);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: `Log file not found: ${searchLogFilePath}`
                });
                return;
              }

              if (!fs.existsSync(patternFilePath)) {
                vscode.window.showErrorMessage(`Search patterns file not found: ${patternFilePath}`);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: `Search patterns file not found: ${patternFilePath}`
                });
                return;
              }

              // Store the log file and search patterns file paths in the configuration
              await vscode.workspace.getConfiguration('acacia-log').update('logFilePath', searchLogFilePath, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('patternsFilePath', patternFilePath, vscode.ConfigurationTarget.Workspace);

              const searchPatterns = readLogPatterns(patternFilePath);

              vscode.window.showInformationMessage('Searching patterns...');

              const results = await this.searchLogFile(searchLogFilePath, searchPatterns);

              // Send results to the webview for visualization
              webviewView.webview.postMessage({
                command: 'displayResults',
                results
              });

              interface SearchResult {
                count: number;
                line_match: string[];
              }

              const editorResults: { [pattern: string]: SearchResult } = {};
              for (const pattern in results) {
                editorResults[pattern] = {
                  count: results[pattern].count,
                  line_match: results[pattern].lines.map((line, index) => `${line}: ${results[pattern].matches[index]}`)
                };
              }

              // Show the results in the new editor
              const resultEditor = await vscode.window.showTextDocument(vscode.Uri.parse('untitled:results.json'));
              await resultEditor.edit(editBuilder => {
                // Clear the editor first
                editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(resultEditor.document.lineCount + 1, 0)));
                editBuilder.insert(new vscode.Position(0, 0), JSON.stringify(editorResults, null, 2));
              });

              vscode.window.showInformationMessage('Search completed successfully!');
              return;

            case 'browseFile':
              // Handle file browsing request
              const fileType = message.fileType;
              const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Select',
                filters: fileType === 'patterns' 
                  ? { 'JSON files': ['json'], 'All files': ['*'] }
                  : { 'Log files': ['log', 'txt'], 'All files': ['*'] }
              };

              const fileUri = await vscode.window.showOpenDialog(options);
              if (fileUri && fileUri[0]) {
                webviewView.webview.postMessage({
                  command: 'setFilePath',
                  fileType: fileType,
                  path: fileUri[0].fsPath
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

    // Send initial values to the webview
    webviewView.webview.postMessage({
      command: 'setValues',
      logTimeRegex,
      logTimeFormat,
      searchDate,
      searchTime,
      logFilePath,
      searchPatternsFilePath
    });

    // Handle visibility changes to refresh values
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // Re-read the values from the configuration
        const config = vscode.workspace.getConfiguration('acacia-log');
        logTimeRegex = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
        logTimeFormat = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
        searchDate = config.get<string>('logSearchDate') || '';
        searchTime = config.get<string>('logSearchTime') || '';
        logFilePath = config.get<string>('logFilePath') || '';
        searchPatternsFilePath = config.get<string>('patternsFilePath') || '';

        webviewView.webview.postMessage({
          command: 'setValues',
          logTimeRegex,
          logTimeFormat,
          searchDate,
          searchTime,
          logFilePath,
          searchPatternsFilePath
        });
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'unifiedLogView.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent;
  }

  private async searchLogFile(logFilePath: string, searchPatterns: { key: string, regexp: string, regexpoptions: string }[]): Promise<{ [pattern: string]: { count: number, positions: number[], lines: number[], matches: string[] } }> {
    const results: { [pattern: string]: { count: number, positions: number[], lines: number[], matches: string[] } } = {};
  
    const searchPromises = searchPatterns.map(pattern => this.searchPatternInLogFile(logFilePath, pattern));
    const searchResults = await Promise.all(searchPromises);

    searchResults.forEach((result, index) => {
      results[searchPatterns[index].key] = result;
    });

    return results;
  }

  private async searchPatternInLogFile(logFilePath: string, pattern: { key: string, regexp: string, regexpoptions: string }): Promise<{ count: number, positions: number[], lines: number[], matches: string[] }> {
    const result = { count: 0, positions: [] as number[], lines: [] as number[], matches: [] as string[] };
  
    const regex = new RegExp(pattern.regexp, pattern.regexpoptions);
    const fileStream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
    let buffer = '';
    let position = 0;
    let lineNumber = 1;
  
    for await (const chunk of fileStream) {
      buffer += chunk;
      let match;
      let lastIndex = -1;
  
      // Process the buffer line by line
      let lineStart = 0;
      let lineEnd = buffer.indexOf('\n');
      while (lineEnd !== -1) {
        const line = buffer.substring(lineStart, lineEnd + 1);
        while ((match = regex.exec(line)) !== null) {
          const matchPosition = position + match.index;
          if (matchPosition >= 0 && Number.isSafeInteger(matchPosition)) {
            result.count++;
            result.positions.push(matchPosition);
            result.lines.push(lineNumber);
            result.matches.push(line.trim());
          } else {
            console.error(`Invalid match position: ${matchPosition}`);
          }
  
          // Safeguard to prevent infinite loop
          if (regex.lastIndex === lastIndex) {
            console.error('Infinite loop detected, breaking out of the loop');
            break;
          }
          lastIndex = regex.lastIndex;
        }
        position += line.length;
        lineNumber++;
        lineStart = lineEnd + 1;
        lineEnd = buffer.indexOf('\n', lineStart);
      }
  
      // Keep the remaining part of the buffer that didn't end with a newline
      buffer = buffer.substring(lineStart);
    }
  
    // Process any remaining buffer content
    if (buffer.length > 0) {
      let match;
      while ((match = regex.exec(buffer)) !== null) {
        const matchPosition = position + match.index;
        if (matchPosition >= 0 && Number.isSafeInteger(matchPosition)) {
          result.count++;
          result.positions.push(matchPosition);
          result.lines.push(lineNumber);
          result.matches.push(buffer.trim());
        } else {
          console.error(`Invalid match position: ${matchPosition}`);
        }
      }
    }
  
    return result;
  }
}
