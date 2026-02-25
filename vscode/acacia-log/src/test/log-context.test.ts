/**
 * Unit tests for LogContext singleton (src/utils/log-context.ts)
 */

// Extend the vscode mock with EventEmitter, window, ViewColumn, and Uri.file
// before any module that depends on it is imported.
jest.mock('vscode', () => {
  // Simple EventEmitter implementation for tests
  class MockEventEmitter {
    private _listeners: Array<(...args: any[]) => void> = [];

    get event() {
      return (listener: (...args: any[]) => void) => {
        this._listeners.push(listener);
        return { dispose: () => { this._listeners = this._listeners.filter(l => l !== listener); } };
      };
    }

    fire(data: any) {
      for (const listener of this._listeners) {
        listener(data);
      }
    }

    dispose() {
      this._listeners = [];
    }
  }

  return {
    EventEmitter: MockEventEmitter,
    Uri: {
      parse: (s: string) => ({ toString: () => s, fsPath: s }),
      file: (s: string) => ({ toString: () => `file://${s}`, fsPath: s, scheme: 'file' }),
    },
    ViewColumn: { One: 1, Two: 2, Three: 3 },
    window: {
      activeTextEditor: undefined,
      showTextDocument: jest.fn(),
    },
    workspace: {
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn((key: string) => {
          const defaults: Record<string, string> = {
            'logDateRegex': '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}',
            'logDateFormat': 'yyyy-MM-dd HH:mm:ss',
          };
          return defaults[key];
        }),
      }),
      openTextDocument: jest.fn(),
    },
  };
});

// Mock log-file-reader to avoid filesystem access
jest.mock('../utils/log-file-reader', () => {
  return {
    LogFileHandler: jest.fn().mockImplementation((filePath: string) => {
      return {
        filePath,
        totalLines: 100,
        initialize: jest.fn().mockResolvedValue({
          detected: true,
          format: {
            pattern: 'yyyy-MM-dd HH:mm:ss',
            regex: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
            groupIndex: 0,
            parseFunc: (match: string) => new Date(match.replace(' ', 'T') + 'Z'),
            score: 10,
          },
        }),
      };
    }),
  };
});

import { LogContext } from '../utils/log-context';
import * as vscode from 'vscode';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockDocument(uri: string) {
  return {
    uri: { toString: () => uri, fsPath: uri },
    fileName: uri,
  } as unknown as vscode.TextDocument;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LogContext', () => {
  afterEach(() => {
    LogContext.resetInstance();
  });

  // ── Singleton behaviour ─────────────────────────────────────────────────

  test('getInstance() returns the same instance on repeated calls', () => {
    const a = LogContext.getInstance();
    const b = LogContext.getInstance();
    expect(a).toBe(b);
  });

  test('resetInstance() creates a fresh instance', () => {
    const first = LogContext.getInstance();
    LogContext.resetInstance();
    const second = LogContext.getInstance();
    expect(second).not.toBe(first);
  });

  // ── activeFilePath ──────────────────────────────────────────────────────

  test('activeFilePath is undefined initially', () => {
    const ctx = LogContext.getInstance();
    expect(ctx.activeFilePath).toBeUndefined();
  });

  test('setActiveFile + activeFilePath round-trip', () => {
    const ctx = LogContext.getInstance();
    ctx.setActiveFile('/logs/app.log');
    expect(ctx.activeFilePath).toBe('/logs/app.log');
  });

  test('setActiveFile(undefined) clears the path', () => {
    const ctx = LogContext.getInstance();
    ctx.setActiveFile('/logs/app.log');
    ctx.setActiveFile(undefined);
    expect(ctx.activeFilePath).toBeUndefined();
  });

  // ── onDidChangeActiveFile ───────────────────────────────────────────────

  test('onDidChangeActiveFile fires on value change', () => {
    const ctx = LogContext.getInstance();
    const listener = jest.fn();
    ctx.onDidChangeActiveFile(listener);

    ctx.setActiveFile('/logs/a.log');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('/logs/a.log');

    ctx.setActiveFile('/logs/b.log');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('/logs/b.log');
  });

  test('onDidChangeActiveFile does NOT fire when set to the same value', () => {
    const ctx = LogContext.getInstance();
    const listener = jest.fn();

    ctx.setActiveFile('/logs/same.log');
    ctx.onDidChangeActiveFile(listener);

    // Setting the same value again should not fire
    ctx.setActiveFile('/logs/same.log');
    expect(listener).not.toHaveBeenCalled();
  });

  test('onDidChangeActiveFile fires when set from value to undefined', () => {
    const ctx = LogContext.getInstance();
    ctx.setActiveFile('/logs/app.log');
    const listener = jest.fn();
    ctx.onDidChangeActiveFile(listener);

    ctx.setActiveFile(undefined);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  // ── resolveEditor() ──────────────────────────────────────────────────────

  test('resolveEditor() returns undefined when no active editor and no active file', async () => {
    const ctx = LogContext.getInstance();
    (vscode.window as any).activeTextEditor = undefined;
    const editor = await ctx.resolveEditor();
    expect(editor).toBeUndefined();
  });

  test('resolveEditor() returns the active editor when one is open', async () => {
    const ctx = LogContext.getInstance();
    const mockEditor = { document: { uri: { scheme: 'file' } } };
    (vscode.window as any).activeTextEditor = mockEditor;

    const editor = await ctx.resolveEditor();
    expect(editor).toBe(mockEditor);
  });

  test('resolveEditor() skips acacia-log scheme editors and falls back to tree-selected file', async () => {
    const ctx = LogContext.getInstance();
    const acaciaEditor = { document: { uri: { scheme: 'acacia-log' } } };
    (vscode.window as any).activeTextEditor = acaciaEditor;

    // No active file set, so should return undefined
    const editor = await ctx.resolveEditor();
    expect(editor).toBeUndefined();
  });

  test('resolveEditor() opens tree-selected file when active editor has acacia-log scheme', async () => {
    const ctx = LogContext.getInstance();
    const acaciaEditor = { document: { uri: { scheme: 'acacia-log' } } };
    (vscode.window as any).activeTextEditor = acaciaEditor;

    ctx.setActiveFile('/logs/selected.log');

    const mockOpenedDoc = { uri: { fsPath: '/logs/selected.log' } };
    const mockShownEditor = { document: mockOpenedDoc };
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockOpenedDoc);
    (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockShownEditor);

    const editor = await ctx.resolveEditor();
    expect(editor).toBe(mockShownEditor);
    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockOpenedDoc, expect.objectContaining({
      viewColumn: 1,
      preview: true,
      preserveFocus: false,
    }));
  });

  test('resolveEditor() opens tree-selected file when no active editor', async () => {
    const ctx = LogContext.getInstance();
    (vscode.window as any).activeTextEditor = undefined;

    ctx.setActiveFile('/logs/fallback.log');

    const mockOpenedDoc = { uri: { fsPath: '/logs/fallback.log' } };
    const mockShownEditor = { document: mockOpenedDoc };
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockOpenedDoc);
    (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockShownEditor);

    const editor = await ctx.resolveEditor();
    expect(editor).toBe(mockShownEditor);
  });

  test('resolveEditor() returns undefined when opening tree-selected file fails', async () => {
    const ctx = LogContext.getInstance();
    (vscode.window as any).activeTextEditor = undefined;

    ctx.setActiveFile('/logs/missing.log');

    (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const editor = await ctx.resolveEditor();
    expect(editor).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[LogContext] Failed to open selected log file:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  // ── Format cache helpers ────────────────────────────────────────────────

  test('clearFormatCache does not throw', () => {
    const ctx = LogContext.getInstance();
    const doc = mockDocument('file:///logs/app.log');
    expect(() => ctx.clearFormatCache(doc)).not.toThrow();
  });

  test('clearAllFormatCache does not throw', () => {
    const ctx = LogContext.getInstance();
    expect(() => ctx.clearAllFormatCache()).not.toThrow();
  });

  test('getCachedFormat returns null for uncached document', () => {
    const ctx = LogContext.getInstance();
    const doc = mockDocument('file:///logs/app.log');
    expect(ctx.getCachedFormat(doc)).toBeNull();
  });

  test('getOrDetectFormat populates cache', async () => {
    const ctx = LogContext.getInstance();
    const doc = mockDocument('/logs/app.log');

    const result = await ctx.getOrDetectFormat(doc);
    expect(result.detected).toBe(true);
    expect(result.format).toBeDefined();
    expect(result.format?.pattern).toBe('yyyy-MM-dd HH:mm:ss');
    expect(result.totalLines).toBe(100);

    // Second call should use cached value
    const cached = ctx.getCachedFormat(doc);
    expect(cached).toBeDefined();
    expect(cached?.pattern).toBe('yyyy-MM-dd HH:mm:ss');
  });

  test('clearFormatCache removes cached entry', async () => {
    const ctx = LogContext.getInstance();
    const doc = mockDocument('/logs/app.log');

    await ctx.getOrDetectFormat(doc);
    expect(ctx.getCachedFormat(doc)).not.toBeNull();

    ctx.clearFormatCache(doc);
    expect(ctx.getCachedFormat(doc)).toBeNull();
  });

  test('clearAllFormatCache removes all cached entries', async () => {
    const ctx = LogContext.getInstance();
    const doc1 = mockDocument('/logs/a.log');
    const doc2 = mockDocument('/logs/b.log');

    await ctx.getOrDetectFormat(doc1);
    await ctx.getOrDetectFormat(doc2);
    expect(ctx.getCachedFormat(doc1)).not.toBeNull();
    expect(ctx.getCachedFormat(doc2)).not.toBeNull();

    ctx.clearAllFormatCache();
    expect(ctx.getCachedFormat(doc1)).toBeNull();
    expect(ctx.getCachedFormat(doc2)).toBeNull();
  });

  // ── Cache expiration ────────────────────────────────────────────────────

  test('cache expires after 5 minutes', async () => {
    jest.useFakeTimers();
    try {
      const ctx = LogContext.getInstance();
      const doc = mockDocument('/logs/expire.log');

      await ctx.getOrDetectFormat(doc);
      expect(ctx.getCachedFormat(doc)).not.toBeNull();

      // Advance time by 4 minutes — still cached
      jest.advanceTimersByTime(4 * 60 * 1000);
      expect(ctx.getCachedFormat(doc)).not.toBeNull();

      // Advance past the 5-minute expiration
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(ctx.getCachedFormat(doc)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('getOrDetectFormat re-detects after cache expiration', async () => {
    jest.useFakeTimers();
    try {
      const { LogFileHandler } = require('../utils/log-file-reader');
      const ctx = LogContext.getInstance();
      const doc = mockDocument('/logs/redetect.log');

      await ctx.getOrDetectFormat(doc);
      const callCount1 = (LogFileHandler as jest.Mock).mock.calls.length;

      // Advance past expiration
      jest.advanceTimersByTime(6 * 60 * 1000);

      await ctx.getOrDetectFormat(doc);
      const callCount2 = (LogFileHandler as jest.Mock).mock.calls.length;

      // Should have been called again after expiration
      expect(callCount2).toBeGreaterThan(callCount1);
    } finally {
      jest.useRealTimers();
    }
  });

  // ── dispose() ───────────────────────────────────────────────────────────

  test('dispose() clears state and format cache', async () => {
    const ctx = LogContext.getInstance();
    ctx.setActiveFile('/logs/app.log');

    // Populate format cache
    const doc = mockDocument('/logs/app.log');
    await ctx.getOrDetectFormat(doc);
    expect(ctx.getCachedFormat(doc)).not.toBeNull();

    ctx.dispose();

    expect(ctx.activeFilePath).toBeUndefined();
    expect(ctx.getCachedFormat(doc)).toBeNull();
  });
});
