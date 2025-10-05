import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readLogPatterns } from '../utils/readLogPatterns';

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
      async message => {
        try {
          switch (message.command) {
            case 'search':
              const logFilePath = message.logFilePath;
              const searchPatternsFilePath = message.searchPatternsFilePath;

              if (!fs.existsSync(logFilePath)) {
                vscode.window.showErrorMessage(`Log file not found: ${logFilePath}`);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: `Log file not found: ${logFilePath}`
                });
                return;
              }

              if (!fs.existsSync(searchPatternsFilePath)) {
                vscode.window.showErrorMessage(`Search patterns file not found: ${searchPatternsFilePath}`);
                webviewView.webview.postMessage({
                  command: 'operationComplete',
                  success: false,
                  message: `Search patterns file not found: ${searchPatternsFilePath}`
                });
                return;
              }

              // Store the log file and search patterns file paths in the configuration
              await vscode.workspace.getConfiguration('acacia-log').update('logFilePath', logFilePath, vscode.ConfigurationTarget.Workspace);
              await vscode.workspace.getConfiguration('acacia-log').update('patternsFilePath', searchPatternsFilePath, vscode.ConfigurationTarget.Workspace);

              const searchPatterns = readLogPatterns(searchPatternsFilePath);

              vscode.window.showInformationMessage('Searching patterns...');

              const results = await this.searchLogFile(logFilePath, searchPatterns);

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
        logFilePath,
        searchPatternsFilePath
      });


    webviewView.onDidChangeVisibility(
        async () => {
            if (webviewView.visible) {
            // Webview is visible

        const config = vscode.workspace.getConfiguration('acacia-log');
        const logFilePath = config.get<string>('logFilePath') || '';
        const searchPatternsFilePath = config.get<string>('patternsFilePath') || '';

    webviewView.webview.postMessage({
        command: 'setValues',
        logFilePath,
        searchPatternsFilePath
      });

            }
        }
        );

      
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'resources', 'logPatternsSearch.html');
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
  
    const regex = new RegExp(pattern.regexp, pattern.regexpoptions); // Ensure global flag is set
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