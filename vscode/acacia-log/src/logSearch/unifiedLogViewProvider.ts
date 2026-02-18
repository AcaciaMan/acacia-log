import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { navigateToDateTime } from '../utils/navigateToDateTime';
import { calculateSimilarLineCounts } from '../utils/calculateSimilarLineCounts';
import { drawLogTimeline } from '../utils/drawLogTimeline';
import { readLogPatterns } from '../utils/readLogPatterns';
import { ResultDocumentProvider } from '../utils/resultDocumentProvider';
import { getOrDetectFormat, getRegexPatternString } from '../utils/format-cache';

/**
 * Unified Log View Provider with tabbed interface
 * Combines log search, pattern search, and timeline functionality
 */
export class UnifiedLogViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'acacia-log.unifiedView';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
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
        console.log('[UnifiedLogView] Message received:', message.command);
        let editor = vscode.window.activeTextEditor;
        
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

            case 'autoDetectTimestampFormat':
              // Auto-detect timestamp format from current file
              if (editor) {
                try {
                  const detection = await getOrDetectFormat(editor.document);
                  
                  if (detection.detected && detection.format) {
                    const regexPattern = getRegexPatternString(detection.format);
                    const formatMap: Record<string, string> = {
                      'yyyy-MM-ddTHH:mm:ss.SSS': 'yyyy-MM-dd\'T\'HH:mm:ss.SSS',
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
                    const format = formatMap[detection.format.pattern] || detection.format.pattern;
                    
                    webviewView.webview.postMessage({
                      command: 'timestampFormatDetected',
                      success: true,
                      detected: true,
                      regex: regexPattern,
                      format: format,
                      pattern: detection.format.pattern,
                      totalLines: detection.totalLines,
                      message: `✓ Detected: ${detection.format.pattern}`,
                      tab: message.tab
                    });
                  } else {
                    webviewView.webview.postMessage({
                      command: 'timestampFormatDetected',
                      success: false,
                      detected: false,
                      message: '✗ Could not detect timestamp format in this file',
                      tab: message.tab
                    });
                  }
                } catch (error) {
                  webviewView.webview.postMessage({
                    command: 'timestampFormatDetected',
                    success: false,
                    detected: false,
                    message: `✗ Error detecting format: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    tab: message.tab
                  });
                }
              } else {
                webviewView.webview.postMessage({
                  command: 'timestampFormatDetected',
                  success: false,
                  detected: false,
                  message: '✗ No active editor found',
                  tab: message.tab
                });
              }
              return;

            // ==== Pattern Search Tab Commands ====
            case 'searchPatterns':
              console.log('[UnifiedLogView] searchPatterns case reached');
              const searchLogFilePath = message.logFilePath;
              const patternFilePath = message.searchPatternsFilePath;
              console.log('[UnifiedLogView] Log file:', searchLogFilePath);
              console.log('[UnifiedLogView] Pattern file:', patternFilePath);

              if (!fs.existsSync(searchLogFilePath)) {
                console.log('[UnifiedLogView] Log file not found');
                vscode.window.showErrorMessage(`Log file not found: ${searchLogFilePath}`);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: `Log file not found: ${searchLogFilePath}`
                });
                return;
              }

              if (!fs.existsSync(patternFilePath)) {
                console.log('[UnifiedLogView] Pattern file not found');
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
              console.log('[UnifiedLogView] Patterns loaded:', searchPatterns.length);

              vscode.window.showInformationMessage('Searching patterns...');

              const results = await this.searchLogFile(searchLogFilePath, searchPatterns);
              console.log('[UnifiedLogView] Search completed, preparing results...');

              // Prepare results for HTML visualization
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

              // Open results in editor tab with HTML visualization
              const resultProvider = ResultDocumentProvider.getInstance(this.context.extensionPath);
              console.log('[UnifiedLogView] Opening pattern search results...');
              try {
                await resultProvider.openPatternSearchResult(editorResults);
                console.log('[UnifiedLogView] Results opened successfully');
              } catch (error) {
                console.error('[UnifiedLogView] Failed to open results:', error);
                vscode.window.showErrorMessage(`Failed to open results: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }

              webviewView.webview.postMessage({
                command: 'operationComplete',
                success: true,
                message: 'Search completed! Results opened in editor with charts and statistics.'
              });

              vscode.window.showInformationMessage('Search completed! Results opened in editor with charts and statistics.');
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

            // ==== File Info Tab Commands ====
            case 'openFile':
              // Open file in editor
              if (message.fileUri) {
                const uri = vscode.Uri.parse(message.fileUri);
                await vscode.commands.executeCommand('vscode.open', uri);
              }
              return;

            case 'revealInExplorer':
              // Reveal file in system explorer
              if (message.fileUri) {
                const uri = vscode.Uri.parse(message.fileUri);
                await vscode.commands.executeCommand('revealFileInOS', uri);
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

  /**
   * Show file information in the File Info tab
   */
  public async showFileInfo(fileUri: vscode.Uri, metadata?: {
    size?: number;
    lastModified?: Date;
    created?: Date;
    totalLines?: number;
    timestampPattern?: string;
    timestampDetected?: boolean;
    formatDisplay?: string;
  }): Promise<void> {
    if (!this._view) {
      console.log('[UnifiedLogView] View not initialized yet');
      return;
    }

    // Reveal the view in the sidebar by focusing it
    // This ensures the user sees the file info tab
    try {
      await vscode.commands.executeCommand('acacia-log.unifiedView.focus');
    } catch (e) {
      console.log('[UnifiedLogView] Could not focus view:', e);
    }

    try {
      // Get file stats
      const stats = await fs.promises.stat(fileUri.fsPath);
      const fileName = path.basename(fileUri.fsPath);
      
      console.log('[UnifiedLogView] Showing file info for:', fileName);
      console.log('[UnifiedLogView] Metadata:', metadata);
      console.log('[UnifiedLogView] View visible:', this._view.visible);
    
    // Format file size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) {
        return `${bytes} B`;
      } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
      } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      }
    };

    // Format date
    const formatDate = (date: Date): string => {
      return date.toLocaleString();
    };

    // Send file info to webview
    const messageData = {
      command: 'showFileInfo',
      fileUri: fileUri.toString(),
      fileName: fileName,
      filePath: fileUri.fsPath,
      fileSize: formatSize(metadata?.size || stats.size),
      createdDate: formatDate(stats.birthtime),
      modifiedDate: formatDate(stats.mtime),
      accessedDate: formatDate(stats.atime),
      totalLines: metadata?.totalLines,
      timestampPattern: metadata?.timestampPattern,
      timestampDetected: metadata?.timestampDetected,
      formatDisplay: metadata?.formatDisplay
    };
    
    console.log('[UnifiedLogView] Sending message to webview:', messageData);
    
    // Small delay to ensure view is ready
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this._view.webview.postMessage(messageData);
    
    console.log('[UnifiedLogView] File info message sent to webview');
    } catch (error) {
      console.error('[UnifiedLogView] Error showing file info:', error);
      vscode.window.showErrorMessage(`Failed to show file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch to a specific tab in the webview
   */
  public switchTab(tabName: 'logAnalysis' | 'patternSearch' | 'similarLines' | 'timeline' | 'fileInfo'): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'switchTab',
        tabName: tabName
      });
    }
  }
}
