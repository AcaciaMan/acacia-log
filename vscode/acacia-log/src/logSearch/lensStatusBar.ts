import * as vscode from 'vscode';
import * as path from 'path';
import { readLogPatterns, LogPatternEntry } from '../utils/readLogPatterns';
import { LogLensDecorationProvider } from './logLensDecorationProvider';

/**
 * LensStatusBar
 *
 * Manages two kinds of status bar items:
 *
 *   1. A permanent "$(lens) Lenses" item that opens the manageLenses QuickPick.
 *   2. One compact "$(circle-filled) N" item per lens pattern that has
 *      lensShowInStatusBar=true, coloured with the lens's lensColor, showing
 *      the visible-range match count from the last decoration pass.
 *
 * All items are hidden when no recognised log file is active in the editor.
 * They reappear when a file:// or acacia-log:// document is focused.
 */
export class LensStatusBar {
  private readonly _managerItem: vscode.StatusBarItem;
  private readonly _lensItems: Map<string, vscode.StatusBarItem> = new Map();
  private _patterns: LogPatternEntry[] = [];
  private _visible: boolean = false;

  private static readonly ALLOWED_SCHEMES = new Set(['file', 'acacia-log']);

  constructor(
    private readonly decorationProvider: LogLensDecorationProvider,
    private readonly context: vscode.ExtensionContext,
  ) {
    // ── Manager item (always leftmost of our items) ────────────────────────
    this._managerItem = vscode.window.createStatusBarItem(
      'acacia-log.lensManager',
      vscode.StatusBarAlignment.Right,
      200,          // priority — sits to the left of the per-lens items
    );
    this._managerItem.text = '$(telescope) Lenses';
    this._managerItem.tooltip = 'Acacia Log — manage lens visibility';
    this._managerItem.command = 'acacia-log.manageLenses';
    context.subscriptions.push(this._managerItem);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load patterns, create per-lens items, and start listening for events.
   * Must be called once after construction (deferred so patterns file exists).
   */
  activate(): void {
    this._loadPatterns();
    this._updateVisibility();

    // Re-apply when counts update after each decoration pass
    this.context.subscriptions.push(
      this.decorationProvider.onDidUpdateCounts(counts => {
        this._updateCounts(counts);
      }),
    );

    // Show/hide based on active editor
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this._updateVisibility();
      }),
    );

    // Reload if patterns file or settings change
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('acacia-log')) {
          this._loadPatterns();
          this._updateVisibility();
        }
      }),
    );
  }

  /**
   * Rebuild lens items from a fresh patterns load.
   * Called by the manageLenses command after visibility changes.
   */
  refresh(): void {
    this._loadPatterns();
    this._updateVisibility();
  }

  dispose(): void {
    this._managerItem.dispose();
    for (const item of this._lensItems.values()) {
      item.dispose();
    }
    this._lensItems.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _resolvePatternsFilePath(): string | undefined {
    const config = vscode.workspace.getConfiguration('acacia-log');
    const configured = config.get<string>('patternsFilePath');
    if (configured && configured.trim() !== '') {
      return configured.trim();
    }
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return path.join(folders[0].uri.fsPath, '.vscode', 'logPatterns.json');
    }
    return undefined;
  }

  private _loadPatterns(): void {
    const filePath = this._resolvePatternsFilePath();
    if (!filePath) {
      this._patterns = [];
      this._rebuildLensItems();
      return;
    }
    try {
      const all = readLogPatterns(filePath);
      this._patterns = all.filter(p => p.lensEnabled && p.lensShowInStatusBar);
      this._rebuildLensItems();
    } catch (err) {
      console.error('[LensStatusBar] Failed to load patterns:', err);
      this._patterns = [];
      this._rebuildLensItems();
    }
  }

  /**
   * Dispose existing per-lens items and create fresh ones from this._patterns.
   * Priority decrements from 199 so items appear left-to-right in lensPriority
   * order, immediately to the right of the manager item.
   */
  private _rebuildLensItems(): void {
    for (const item of this._lensItems.values()) {
      item.dispose();
    }
    this._lensItems.clear();

    let priority = 199;
    for (const pattern of this._patterns) {
      const item = vscode.window.createStatusBarItem(
        `acacia-log.lens.${pattern.key}`,
        vscode.StatusBarAlignment.Right,
        priority--,
      );
      item.color = pattern.lensColor;
      item.text = `$(circle-filled) 0`;
      item.tooltip = this._buildTooltip(pattern, 0);
      item.command = {
        command: 'acacia-log.findLens',
        title: 'Find in file',
        arguments: [{ key: pattern.key }],
      };
      this._lensItems.set(pattern.key, item);
      // Do NOT push to subscriptions here — managed by dispose()
    }

    // Apply current visibility to newly created items
    if (this._visible) {
      for (const item of this._lensItems.values()) { item.show(); }
    } else {
      for (const item of this._lensItems.values()) { item.hide(); }
    }
  }

  /**
   * Build a rich MarkdownString tooltip for a lens status bar item.
   * Includes: label, category, pattern, count, and command links.
   */
  private _buildTooltip(pattern: LogPatternEntry, count: number): vscode.MarkdownString {
    const findArgs = encodeURIComponent(JSON.stringify({ key: pattern.key }));
    const toggleArgs = encodeURIComponent(JSON.stringify({ key: pattern.key }));
    const isVisible = this.decorationProvider.getLensVisible(pattern.key);

    const md = new vscode.MarkdownString(
      [
        `**${pattern.lensLabel}** _(${pattern.lensCategory})_`,
        ``,
        `Pattern: \`${pattern.regexp}\``,
        ``,
        `Visible range: **${count}** match${count === 1 ? '' : 'es'}`,
        ``,
        `[$(search) Find in file](command:acacia-log.findLens?${findArgs})` +
        `\u00a0\u00a0` +
        `[${isVisible ? '$(eye-closed) Hide' : '$(eye) Show'} decorations](command:acacia-log.toggleLensKey?${toggleArgs})`,
      ].join('\n'),
      true,   // isTrusted — required for command: URIs
    );
    md.isTrusted = true;
    md.supportThemeIcons = true;
    return md;
  }

  /**
   * Called after each decoration pass with the latest visible counts.
   * Updates text and tooltip for each lens item.
   */
  private _updateCounts(counts: ReadonlyMap<string, number>): void {
    for (const pattern of this._patterns) {
      const item = this._lensItems.get(pattern.key);
      if (!item) { continue; }

      const count = counts.get(pattern.key) ?? 0;
      const isVisible = this.decorationProvider.getLensVisible(pattern.key);

      item.text = `$(circle-filled) ${count}`;
      item.color = isVisible ? pattern.lensColor : undefined;  // grey out when hidden
      item.tooltip = this._buildTooltip(pattern, count);
    }
  }

  /**
   * Show or hide all status bar items based on whether the active editor
   * is a recognised log document (scheme: file or acacia-log).
   */
  private _updateVisibility(): void {
    const editor = vscode.window.activeTextEditor;
    const shouldShow =
      editor !== undefined &&
      LensStatusBar.ALLOWED_SCHEMES.has(editor.document.uri.scheme);

    if (shouldShow === this._visible) { return; }
    this._visible = shouldShow;

    if (shouldShow) {
      this._managerItem.show();
      for (const item of this._lensItems.values()) { item.show(); }
    } else {
      this._managerItem.hide();
      for (const item of this._lensItems.values()) { item.hide(); }
    }
  }
}
