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
            await vscode.workspace.getConfiguration('acacia-log').update('logFilePath', logFilePath, vscode.ConfigurationTarget.Workspace);
            await vscode.workspace.getConfiguration('acacia-log').update('patternsFilePath', searchPatternsFilePath, vscode.ConfigurationTarget.Workspace);

            const searchPatterns = readLogPatterns(searchPatternsFilePath);

            // Perform search using searchPatterns in logFilePath
            // For each pattern in searchPatterns, search the log file asynchronously in parallel
            // Show the results in the new editor
            // For each pattern, show the number of occurrences and the lines where the pattern is found in json format

            vscode.window.showInformationMessage('Searching...');

            const results = await this.searchLogFile(logFilePath, searchPatterns);

            // Show the results in the new editor
            const resultEditor = await vscode.window.showTextDocument(vscode.Uri.parse('untitled:results.json'));
            resultEditor.edit(editBuilder => {
              editBuilder.insert(new vscode.Position(0, 0), JSON.stringify(results, null, 2));
            });

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

  private async searchLogFile(logFilePath: string, searchPatterns: { key: string, regexp: string, regexpoptions: string }[]): Promise<{ [pattern: string]: { count: number, positions: number[], lines: number[] } }> {
    const results: { [pattern: string]: { count: number, positions: number[], lines: number[] } } = {};
  
    for (const pattern of searchPatterns) {
      results[pattern.key] = { count: 0, positions: [], lines: [] };
    }
  
    const fileStream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
    let buffer = '';
    let position = 0;
    let lineNumber = 1;
    let lineStart = 0;
  
    for await (const chunk of fileStream) {
      buffer += chunk;
      let match;
      let lastIndex = -1;
  
      // Iterate over all search patterns and count the number of occurrences and their positions
      for (const pattern of searchPatterns) {
        const regex = new RegExp(pattern.regexp, pattern.regexpoptions); 
  
        while ((match = regex.exec(buffer)) !== null) {
          const matchPosition = position + match.index;
          if (matchPosition >= 0 && Number.isSafeInteger(matchPosition)) {
            results[pattern.key].count++;
            results[pattern.key].positions.push(matchPosition);
  
            // Calculate line number
            while (lineStart < matchPosition) {
              const nextLineBreak = buffer.indexOf('\n', lineStart);
              if (nextLineBreak === -1 || nextLineBreak >= matchPosition) {
                break;
              }
              lineNumber++;
              lineStart = nextLineBreak + 1;
            }
            results[pattern.key].lines.push(lineNumber);
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
      }
      position += chunk.length;
      buffer = buffer.slice(-1024); // Keep the last 1024 characters to handle patterns spanning chunks
    }
  
    return results;
  }

}