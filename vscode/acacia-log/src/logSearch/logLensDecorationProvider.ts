import * as vscode from 'vscode';
import * as path from 'path';
import { readLogPatterns, LogPatternEntry, LensCategory } from '../utils/readLogPatterns';

const ALLOWED_SCHEMES = new Set(['file', 'acacia-log']);

export class LogLensDecorationProvider {
  private readonly context: vscode.ExtensionContext;
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private patterns: LogPatternEntry[] = [];
  private _enabled: boolean = true;
  private _perLensVisible: Map<string, boolean> = new Map();
  private _visibleCounts: Map<string, number> = new Map();
  private readonly _onDidUpdateCounts =
    new vscode.EventEmitter<ReadonlyMap<string, number>>();

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

  /** Fired after every decoration pass with visible-range match counts per key. */
  readonly onDidUpdateCounts: vscode.Event<ReadonlyMap<string, number>> =
    this._onDidUpdateCounts.event;

  /**
   * Set per-lens runtime visibility.
   * Persists in memory only; does not modify logPatterns.json.
   * Pass `undefined` to remove the override (reverts to lensEnabled from JSON).
   */
  setLensVisible(key: string, visible: boolean | undefined): void {
    if (visible === undefined) {
      this._perLensVisible.delete(key);
    } else {
      this._perLensVisible.set(key, visible);
    }
    this.applyToActiveEditor();
  }

  /**
   * Return the effective runtime visibility for a lens key.
   * Returns the _perLensVisible override if set, otherwise the pattern's
   * lensEnabled value from logPatterns.json, or true if the key is unknown.
   */
  getLensVisible(key: string): boolean {
    if (this._perLensVisible.has(key)) {
      return this._perLensVisible.get(key)!;
    }
    const pattern = this.patterns.find(p => p.key === key);
    return pattern ? pattern.lensEnabled : true;
  }

  /**
   * Return a snapshot of visible-range match counts from the last decoration
   * pass. Keys are lens keys; values are the count of matched ranges.
   * Only lenses that were active (not hidden) in the last pass are included.
   */
  getVisibleCounts(): ReadonlyMap<string, number> {
    return this._visibleCounts;
  }

  dispose(): void {
    this.clearDecorationTypes();
    this._onDidUpdateCounts.dispose();
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
      // Clear stale per-lens overrides for keys no longer present in patterns
      for (const key of this._perLensVisible.keys()) {
        if (!this.patterns.find(p => p.key === key)) {
          this._perLensVisible.delete(key);
        }
      }
      this._visibleCounts.clear();
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
        overviewRulerColor: pattern.lensColor,
        overviewRulerLane: this.rulerLaneForCategory(pattern.lensCategory),
      });
      this.decorationTypes.set(pattern.key, decorationType);
    }
  }

  private rulerLaneForCategory(category: LensCategory): vscode.OverviewRulerLane {
    switch (category) {
      case 'stack':  return vscode.OverviewRulerLane.Left;
      case 'sql':    return vscode.OverviewRulerLane.Center;
      case 'config': return vscode.OverviewRulerLane.Center;
      default:       return vscode.OverviewRulerLane.Right;
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

    // Reset counts for this pass
    this._visibleCounts.clear();

    // Apply decorations for each lens pattern (already sorted by lensPriority desc)
    for (const pattern of this.patterns) {
      const decorationType = this.decorationTypes.get(pattern.key);
      if (!decorationType) {
        continue;
      }

      // Check per-lens runtime visibility override
      const isVisible = this._perLensVisible.has(pattern.key)
        ? this._perLensVisible.get(pattern.key)!
        : pattern.lensEnabled;

      if (!isVisible) {
        // Clear any stale decorations and skip this lens
        editor.setDecorations(decorationType, []);
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

      // Store the visible-range count as a by-product (no extra iterations)
      this._visibleCounts.set(pattern.key, ranges.length);

      // Always call setDecorations (even with an empty array) to clear stale decorations
      editor.setDecorations(decorationType, ranges);
    }

    // Notify subscribers with a snapshot of visible counts
    this._onDidUpdateCounts.fire(this._visibleCounts);
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
