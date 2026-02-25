/**
 * LogContext — single source of truth for shared extension state.
 *
 * Centralises:
 *   • Active log file path (tree selection or editor focus).
 *   • Resolved text editor (active editor → tree-selected fallback).
 *   • Timestamp format cache (per-document, 5-min TTL).
 */
import * as vscode from 'vscode';
import { LogFileHandler } from './log-file-reader';
import { DetectedFormat } from './timestamp-detect';

// ── Public result type ────────────────────────────────────────────────────────

export interface FormatDetectionResult {
  format: DetectedFormat | null;
  detected: boolean;
  totalLines: number;
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ILogContext {
  /** The file path currently selected via tree view or active editor */
  readonly activeFilePath: string | undefined;

  /** Set the active log file path (called on tree click, editor change, etc.) */
  setActiveFile(filePath: string | undefined): void;

  /**
   * Resolve and return a TextEditor for the current log file.
   *
   * Priority:
   *   1. Active VS Code editor (non-virtual, i.e. scheme !== 'acacia-log').
   *   2. Tree-selected file opened on demand.
   *
   * Returns `undefined` when no source is available.
   */
  resolveEditor(): Promise<vscode.TextEditor | undefined>;

  /** Get or detect the timestamp format for the given document (cached). */
  getOrDetectFormat(document: vscode.TextDocument): Promise<FormatDetectionResult>;

  /** Get cached format without triggering detection */
  getCachedFormat(document: vscode.TextDocument): DetectedFormat | null;

  /** Clear format cache for one document */
  clearFormatCache(document: vscode.TextDocument): void;

  /** Clear all cached formats */
  clearAllFormatCache(): void;

  /** Event that fires when the active file path changes */
  readonly onDidChangeActiveFile: vscode.Event<string | undefined>;

  /** Dispose all resources */
  dispose(): void;
}

// ── Format cache entry ────────────────────────────────────────────────────────

interface FormatCacheEntry {
  format: DetectedFormat | null;
  detected: boolean;
  totalLines: number;
  timestamp: number;
}

// ── Implementation ────────────────────────────────────────────────────────────

const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Lightweight singleton that tracks shared extension state:
 * - The currently active log file (from tree selection or editor focus).
 * - Auto-detected timestamp format cache (per-document, 5-min TTL).
 * - Editor resolution logic (active editor → tree-selected fallback).
 *
 * Obtain via `LogContext.getInstance()`. Dispose via extension
 * subscription lifecycle.
 *
 * @example
 * const ctx = LogContext.getInstance();
 * ctx.setActiveFile('/path/to/logfile.log');
 * const editor = await ctx.resolveEditor();
 * const fmt = await ctx.getOrDetectFormat(editor.document);
 */
export class LogContext implements ILogContext {
  // ── Singleton plumbing ────────────────────────────────────────────────────

  private static _instance: LogContext | undefined;

  /** Return the singleton instance, creating it on first call. */
  static getInstance(): LogContext {
    if (!LogContext._instance) {
      LogContext._instance = new LogContext();
    }
    return LogContext._instance;
  }

  /** Reset the singleton — **for testing only**. */
  static resetInstance(): void {
    LogContext._instance?.dispose();
    LogContext._instance = undefined;
  }

  // ── Private state ─────────────────────────────────────────────────────────

  private _activeFilePath: string | undefined;
  private readonly _onDidChangeActiveFile = new vscode.EventEmitter<string | undefined>();
  private readonly _formatCache = new Map<string, FormatCacheEntry>();

  private constructor() {}

  // ── ILogContext implementation ─────────────────────────────────────────────

  get activeFilePath(): string | undefined {
    return this._activeFilePath;
  }

  get onDidChangeActiveFile(): vscode.Event<string | undefined> {
    return this._onDidChangeActiveFile.event;
  }

  setActiveFile(filePath: string | undefined): void {
    if (this._activeFilePath !== filePath) {
      this._activeFilePath = filePath;
      this._onDidChangeActiveFile.fire(filePath);
    }
  }

  async resolveEditor(): Promise<vscode.TextEditor | undefined> {
    // Prefer the active editor, but ignore virtual result documents
    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.scheme !== 'acacia-log') {
      return active;
    }

    // Fall back to the tree-selected file
    if (this._activeFilePath) {
      try {
        const uri = vscode.Uri.file(this._activeFilePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        return await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preview: true,
          preserveFocus: false,
        });
      } catch (err) {
        console.error('[LogContext] Failed to open selected log file:', err);
      }
    }

    return undefined;
  }

  // ── Format cache ──────────────────────────────────────────────────────────

  async getOrDetectFormat(document: vscode.TextDocument): Promise<FormatDetectionResult> {
    const uri = document.uri.toString();

    // Check cache first
    const cached = this._formatCache.get(uri);
    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_MS)) {
      return {
        format: cached.format,
        detected: cached.detected,
        totalLines: cached.totalLines,
      };
    }

    try {
      // Detect format using LogFileHandler
      const filePath = document.uri.fsPath;
      const handler = new LogFileHandler(filePath);
      const result = await handler.initialize();

      const detectionResult: FormatDetectionResult = {
        format: result.detected ? result.format : null,
        detected: result.detected,
        totalLines: handler.totalLines,
      };

      // Cache the result
      this._formatCache.set(uri, {
        ...detectionResult,
        timestamp: Date.now(),
      });

      console.log(
        `[LogContext] Detected format for ${document.fileName}:`,
        result.detected ? result.format?.pattern : 'None',
      );

      return detectionResult;
    } catch (error) {
      console.error('[LogContext] Error detecting format:', error);
      return {
        format: null,
        detected: false,
        totalLines: 0,
      };
    }
  }

  getCachedFormat(document: vscode.TextDocument): DetectedFormat | null {
    const uri = document.uri.toString();
    const cached = this._formatCache.get(uri);

    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_MS)) {
      return cached.format;
    }

    return null;
  }

  clearFormatCache(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    this._formatCache.delete(uri);
  }

  clearAllFormatCache(): void {
    this._formatCache.clear();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  dispose(): void {
    this._onDidChangeActiveFile.dispose();
    this._formatCache.clear();
    this._activeFilePath = undefined;
  }
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export { DetectedFormat, getFormatDisplayString } from './timestamp-detect';

/**
 * Get regex and format from detected format or fallback to VS Code config.
 * Pure function — no cache interaction.
 */
export function getRegexAndFormat(
  detectedFormat: DetectedFormat | null,
): {
  regex: RegExp;
  format: string;
  useDetected: boolean;
} {
  if (detectedFormat) {
    // Convert luxon format patterns to match what the timeline expects
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
      'dd-MMM-yyyy HH:mm:ss': 'dd-MMM-yyyy HH:mm:ss',
      'MMM dd, yyyy HH:mm:ss': 'MMM dd, yyyy HH:mm:ss',
      'MMM dd HH:mm:ss': 'MMM dd HH:mm:ss',
      'HH:mm:ss.SSS': 'HH:mm:ss.SSS',
      'HH:mm:ss': 'HH:mm:ss',
    };

    const format = formatMap[detectedFormat.pattern] || detectedFormat.pattern;

    return {
      regex: detectedFormat.regex,
      format,
      useDetected: true,
    };
  }

  // Fallback to configuration
  const config = vscode.workspace.getConfiguration('acacia-log');
  const regexStr =
    config.get<string>('logDateRegex') ||
    '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
  const format =
    config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';

  return {
    regex: new RegExp(regexStr),
    format,
    useDetected: false,
  };
}

/**
 * Get regex pattern string from detected format for webview display.
 * Pure function — no cache interaction.
 */
export function getRegexPatternString(detectedFormat: DetectedFormat | null): string {
  if (detectedFormat) {
    return detectedFormat.regex.source;
  }
  const config = vscode.workspace.getConfiguration('acacia-log');
  return (
    config.get<string>('logDateRegex') ||
    '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}'
  );
}
