import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LineIndex } from './log-file-reader';
import { navigateToLine } from './navigateToLine';

/**
 * Virtual document provider for displaying results in editor tabs
 */
export class ResultDocumentProvider implements vscode.TextDocumentContentProvider {
  private static instance: ResultDocumentProvider;
  private static lineIndexCache = new Map<string, LineIndex>();
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private documents = new Map<string, string>();
  private documentCounter = 0;
  private chunkState = new Map<string, {
    filePath: string;
    lineIndex: LineIndex;
    ctxStart: number;
    ctxEnd: number;
    matchedLine: number;
    totalLines: number;
  }>();

  readonly onDidChange = this._onDidChange.event;

  constructor(private extensionPath?: string) {}

  static getInstance(extensionPath?: string): ResultDocumentProvider {
    if (!ResultDocumentProvider.instance) {
      ResultDocumentProvider.instance = new ResultDocumentProvider(extensionPath);
    } else if (extensionPath && !ResultDocumentProvider.instance.extensionPath) {
      ResultDocumentProvider.instance.extensionPath = extensionPath;
    }
    return ResultDocumentProvider.instance;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    console.log('[ResultDocumentProvider] Providing content for:', uri.toString());
    
    // Try to get content with the full path including fragment (#counter)
    const fullPath = uri.path + (uri.fragment ? `#${uri.fragment}` : '');
    let content = this.documents.get(fullPath);
    
    // Fallback: try just the path
    if (!content) {
      content = this.documents.get(uri.path);
    }
    
    // Fallback: try without fragment
    if (!content) {
      const basePath = uri.path.split('#')[0];
      content = this.documents.get(basePath);
    }
    
    if (!content) {
      console.log('[ResultDocumentProvider] No content found for:', uri.toString());
      console.log('[ResultDocumentProvider] Available documents:', Array.from(this.documents.keys()));
    } else {
      console.log('[ResultDocumentProvider] Content found, length:', content.length);
    }
    
    return content || '// No content available';
  }

  /**
   * Update document content and refresh
   */
  updateDocument(path: string, content: string): void {
    this.documents.set(path, content);
    this._onDidChange.fire(vscode.Uri.parse(`acacia-log:${path}`));
  }

  /**
   * Open a result document in an editor tab
   */
  async openResultDocument(
    path: string,
    content: string,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.One,
    languageId?: string
  ): Promise<vscode.TextEditor> {
    // Increment counter for each new document
    this.documentCounter++;
    const uniquePath = `${path}#${this.documentCounter}`;
    
    // Store content with unique path
    this.documents.set(uniquePath, content);
    
    const uri = vscode.Uri.parse(`acacia-log:${uniquePath}`);
    
    // Find and close any existing documents with the same base path
    const basePathPrefix = path.split('#')[0];
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === 'acacia-log' && doc.uri.path.startsWith(basePathPrefix)) {
        // Find all editors showing this document
        const editorsToClose = vscode.window.visibleTextEditors.filter(
          editor => editor.document === doc
        );
        
        // Close each editor
        for (const editor of editorsToClose) {
          await vscode.window.showTextDocument(editor.document, {
            preview: false,
            preserveFocus: true
          });
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
      }
    }
    
    // Small delay to ensure VS Code has cleaned up
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Clean up old documents from memory (keep only last 5)
    if (this.documents.size > 5) {
      const keysToDelete = Array.from(this.documents.keys()).slice(0, this.documents.size - 5);
      keysToDelete.forEach(key => this.documents.delete(key));
    }
    
    try {
      // Open the new document
      console.log('[ResultDocumentProvider] Opening document:', uniquePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      console.log('[ResultDocumentProvider] Document opened:', doc.uri.toString());

      // Attempt to apply a language ID (e.g. 'log' for Log File Highlighter).
      // setTextDocumentLanguage throws when the language is unknown (extension not
      // installed), so swallow any error and fall back to the original document.
      let docToShow = doc;
      if (languageId) {
        try {
          docToShow = await vscode.languages.setTextDocumentLanguage(doc, languageId);
        } catch {
          // Language ID unknown – extension not installed, silently continue.
        }
      }

      // Show the document in the editor
      const editor = await vscode.window.showTextDocument(docToShow, {
        viewColumn,
        preview: false,
        preserveFocus: false
      });
      
      console.log('[ResultDocumentProvider] Editor shown successfully');
      return editor;
    } catch (error) {
      console.error('[ResultDocumentProvider] Error opening document:', error);
      vscode.window.showErrorMessage(`Failed to open results: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Generate HTML content from template and data
   */
  private generateHtmlContent(templatePath: string, data: any): string {
    if (!this.extensionPath) {
      return '// Extension path not available';
    }

    const fullTemplatePath = path.join(this.extensionPath, 'resources', templatePath);
    
    if (!fs.existsSync(fullTemplatePath)) {
      return '// Template not found: ' + templatePath;
    }

    let htmlContent = fs.readFileSync(fullTemplatePath, 'utf8');
    
    // Inject data into HTML
    const dataScript = `
    <script>
      window.RESULTS_DATA = ${JSON.stringify(data)};
    </script>
  </head>`;
    
    htmlContent = htmlContent.replace('</head>', dataScript);
    
    return htmlContent;
  }

  /**
   * Open similar lines result in editor
   */
  async openSimilarLinesResult(content: string): Promise<vscode.TextEditor> {
    return this.openResultDocument(
      '/results/similar-lines.txt',
      content,
      vscode.ViewColumn.Two,
      'log'
    );
  }

  /**
   * Open a log file chunk (context around a navigated line) as a read-only
   * virtual document in column one.  The content should already contain a
   * header and numbered lines built by navigateToDateTime.
   */
  async openLogChunkResult(content: string): Promise<vscode.TextEditor> {
    return this.openResultDocument(
      '/results/navigate-chunk.log',
      content,
      vscode.ViewColumn.One,
      'log'
    );
  }

  /** Called by navigateLargeFile after building the index. */
  static cacheLineIndex(filePath: string, index: LineIndex): void {
    ResultDocumentProvider.lineIndexCache.set(filePath, index);
  }

  static getCachedLineIndex(filePath: string): LineIndex | undefined {
    return ResultDocumentProvider.lineIndexCache.get(filePath);
  }

  /** Store navigation state for the most-recently-opened chunk doc.
   *  Key is the base virtual path '/results/navigate-chunk.log'. */
  setChunkState(state: {
    filePath: string;
    lineIndex: LineIndex;
    ctxStart: number;
    ctxEnd: number;
    matchedLine: number;
    totalLines: number;
  }): void {
    this.chunkState.set('/results/navigate-chunk.log', state);
  }

  getChunkState(): { filePath: string; lineIndex: LineIndex; ctxStart: number; ctxEnd: number; matchedLine: number; totalLines: number } | undefined {
    return this.chunkState.get('/results/navigate-chunk.log');
  }

  /**
   * Open pattern search result in editor with HTML visualization
   */
  async openPatternSearchResult(
    results: { [pattern: string]: { count: number; line_match: string[] } },
    logFilePath: string
  ): Promise<void> {
    console.log('[ResultDocumentProvider] openPatternSearchResult called with', Object.keys(results).length, 'patterns');
    
    if (!this.extensionPath) {
      throw new Error('Extension path not available');
    }

    const templatePath = path.join(this.extensionPath, 'resources', 'patternSearchResults.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error('Template not found: patternSearchResults.html');
    }

    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    
    // Inject data into HTML
    const dataScript = `
    <script>
      window.RESULTS_DATA = ${JSON.stringify(results)};
      window.LOG_FILE_PATH = ${JSON.stringify(logFilePath)};
    </script>
  </head>`;
    
    htmlContent = htmlContent.replace('</head>', dataScript);
    
    console.log('[ResultDocumentProvider] HTML content generated, length:', htmlContent.length);
    
    // Create or reuse webview panel
    const panel = vscode.window.createWebviewPanel(
      'patternSearchResults',
      'Pattern Search Results',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    panel.webview.html = htmlContent;
    console.log('[ResultDocumentProvider] Webview panel created and content set');

    panel.webview.onDidReceiveMessage(async message => {
      if (message.command === 'navigateToLine') {
        try {
          await navigateToLine(message.filePath, message.line);
        } catch (err) {
          vscode.window.showErrorMessage(
            `Cannot open log file: ${err instanceof Error ? err.message : err}`);
        }
      }
    });
  }

  /**
   * Open pattern search result in editor (legacy JSON format)
   */
  async openPatternSearchResultJson(content: string): Promise<vscode.TextEditor> {
    return this.openResultDocument(
      '/results/pattern-search.json',
      content,
      vscode.ViewColumn.Two
    );
  }

  /**
   * Open timeline result in editor
   */
  async openTimelineResult(content: string): Promise<vscode.TextEditor> {
    return this.openResultDocument(
      '/results/timeline.txt',
      content,
      vscode.ViewColumn.Two,
      'log'
    );
  }
}
