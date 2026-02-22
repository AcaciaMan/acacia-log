import * as vscode from 'vscode';
import * as path from 'path';
import { readLogPatterns, LogPatternEntry } from '../utils/readLogPatterns';

const ALLOWED_SCHEMES = new Set(['file', 'acacia-log']);

export class LogLensDecorationProvider {
  private readonly context: vscode.ExtensionContext;
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private patterns: LogPatternEntry[] = [];
  private _enabled: boolean = true;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  activate(): void {
    this._enabled = this.readEnabledSetting();
    this.loadPatterns();
    this.applyToActiveEditor();

    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.applyToActiveEditor();
      }),

      vscode.window.onDidChangeTextEditorVisibleRanges(event => {
        this.applyToEditor(event.textEditor);
      }),

      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('acacia-log')) {
          this._enabled = this.readEnabledSetting();
          this.loadPatterns();
          this.applyToActiveEditor();
        }
      }),
    );
  }

  toggle(): void {
    this._enabled = !this._enabled;
    if (this._enabled) {
      this.applyToActiveEditor();
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        for (const decorationType of this.decorationTypes.values()) {
          editor.setDecorations(decorationType, []);
        }
      }
    }
  }

  dispose(): void {
    this.clearDecorationTypes();
  }

  private readEnabledSetting(): boolean {
    return vscode.workspace.getConfiguration('acacia-log').get<boolean>('lensDecorationsEnabled', true);
  }

  // -------------------------------------------------------------------------
  // Pattern loading
  // -------------------------------------------------------------------------

  private loadPatterns(): void {
    const filePath = this.resolvePatternsFilePath();
    if (!filePath) {
      this.patterns = [];
      this.clearDecorationTypes();
      return;
    }

    try {
      const allPatterns = readLogPatterns(filePath);
      this.patterns = allPatterns.filter(p => p.lensEnabled && p.lensColor);
      this.rebuildDecorationTypes();
    } catch (err) {
      console.error('[LogLensDecorationProvider] Failed to load patterns:', err);
      this.patterns = [];
      this.clearDecorationTypes();
    }
  }

  private resolvePatternsFilePath(): string | undefined {
    const config = vscode.workspace.getConfiguration('acacia-log');
    const configured: string | undefined = config.get<string>('patternsFilePath');

    if (configured && configured.trim() !== '') {
      return configured.trim();
    }

    // Fall back to .vscode/logPatterns.json in the first workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'logPatterns.json');
    }

    return undefined;
  }

  // -------------------------------------------------------------------------
  // Decoration type management
  // -------------------------------------------------------------------------

  private rebuildDecorationTypes(): void {
    this.clearDecorationTypes();

    for (const pattern of this.patterns) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        color: pattern.lensColor,
        fontWeight: 'bold',
        isWholeLine: false,
      });
      this.decorationTypes.set(pattern.key, decorationType);
    }
  }

  private clearDecorationTypes(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }

  // -------------------------------------------------------------------------
  // Decoration application
  // -------------------------------------------------------------------------

  private applyToActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.applyToEditor(editor);
    }
  }

  private applyToEditor(editor: vscode.TextEditor): void {
    if (!ALLOWED_SCHEMES.has(editor.document.uri.scheme)) {
      return;
    }

    // When decorations are disabled, clear all and bail out
    if (!this._enabled) {
      for (const decorationType of this.decorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
      return;
    }

    // Collect all visible line numbers across all visible ranges
    const visibleLineNumbers = this.getVisibleLineNumbers(editor);

    // Apply decorations for each lens pattern (already sorted by lensPriority desc)
    for (const pattern of this.patterns) {
      const decorationType = this.decorationTypes.get(pattern.key);
      if (!decorationType) {
        continue;
      }

      const ranges: vscode.Range[] = [];

      if (visibleLineNumbers.length > 0) {
        let regex: RegExp;
        try {
          regex = new RegExp(pattern.regexp, pattern.regexpoptions);
        } catch (err) {
          console.error(
            `[LogLensDecorationProvider] Invalid regexp for pattern "${pattern.key}":`,
            err,
          );
          editor.setDecorations(decorationType, []);
          continue;
        }

        for (const lineNumber of visibleLineNumbers) {
          const lineText = editor.document.lineAt(lineNumber).text;

          // Reset lastIndex so repeated exec calls work correctly with the 'g' flag
          regex.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = regex.exec(lineText)) !== null) {
            const start = new vscode.Position(lineNumber, match.index);
            const end = new vscode.Position(lineNumber, match.index + match[0].length);
            ranges.push(new vscode.Range(start, end));

            // Guard against zero-width matches causing infinite loops
            if (match[0].length === 0) {
              regex.lastIndex++;
            }
          }
        }
      }

      // Always call setDecorations (even with an empty array) to clear stale decorations
      editor.setDecorations(decorationType, ranges);
    }
  }

  private getVisibleLineNumbers(editor: vscode.TextEditor): number[] {
    const lineNumbers: number[] = [];
    const docLineCount = editor.document.lineCount;

    for (const visibleRange of editor.visibleRanges) {
      const start = visibleRange.start.line;
      const end = Math.min(visibleRange.end.line, docLineCount - 1);
      for (let i = start; i <= end; i++) {
        lineNumbers.push(i);
      }
    }

    return lineNumbers;
  }
}
