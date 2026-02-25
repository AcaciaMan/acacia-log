/**
 * Unit tests for logLensDecorationProvider.ts
 * Tests decoration lifecycle, pattern matching, toggle, and disposal.
 */

import * as path from 'path';

// ── Mock setup (before imports) ───────────────────────────────────────────────

const mockDispose = jest.fn();
const mockCreateDecorationType = jest.fn().mockReturnValue({ dispose: mockDispose });
const mockSetDecorations = jest.fn();

let mockActiveEditor: any = undefined;
const mockOnDidChangeActiveTextEditor = jest.fn();
const mockOnDidChangeTextEditorVisibleRanges = jest.fn();
const mockOnDidChangeConfiguration = jest.fn();

const mockSubscriptions: any[] = [];

jest.mock('vscode', () => ({
  window: {
    createTextEditorDecorationType: mockCreateDecorationType,
    get activeTextEditor() { return mockActiveEditor; },
    onDidChangeActiveTextEditor: mockOnDidChangeActiveTextEditor.mockReturnValue({ dispose: jest.fn() }),
    onDidChangeTextEditorVisibleRanges: mockOnDidChangeTextEditorVisibleRanges.mockReturnValue({ dispose: jest.fn() }),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'lensDecorationsEnabled') { return true; }
        if (key === 'patternsFilePath') { return undefined; }
        return defaultVal;
      }),
    }),
    workspaceFolders: [{ uri: { fsPath: path.join(__dirname, '..', 'test') } }],
    onDidChangeConfiguration: mockOnDidChangeConfiguration.mockReturnValue({ dispose: jest.fn() }),
  },
  Range: jest.fn((...args: any[]) => {
    // Support both Range(startPos, endPos) and Range(sl, sc, el, ec)
    if (args.length === 2) {
      return { start: args[0], end: args[1] };
    }
    return {
      start: { line: args[0], character: args[1] },
      end: { line: args[2], character: args[3] },
    };
  }),
  Position: jest.fn((l: number, c: number) => ({ line: l, character: c })),
  ThemeColor: jest.fn((id: string) => ({ id })),
  OverviewRulerLane: {
    Left: 1,
    Center: 2,
    Right: 4,
    Full: 7,
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}), { virtual: true });

import { LogLensDecorationProvider } from '../logSearch/logLensDecorationProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockEditor(lines: string[], visibleStart = 0, visibleEnd?: number) {
  const end = visibleEnd ?? lines.length - 1;
  return {
    document: {
      uri: { scheme: 'file', toString: () => 'file:///test.log' },
      lineCount: lines.length,
      lineAt: (i: number) => ({
        text: lines[i],
        range: { start: { character: 0 }, end: { character: lines[i].length } },
      }),
    },
    visibleRanges: [{ start: { line: visibleStart }, end: { line: end } }],
    setDecorations: mockSetDecorations,
  };
}

function createContext(): any {
  return {
    extensionPath: path.join(__dirname, '..'),
    subscriptions: mockSubscriptions,
  };
}

/**
 * The logPatterns.json used here is at src/test/logPatterns.json.
 * The provider resolves it via workspaceFolders[0]/.vscode/logPatterns.json,
 * but we override workspaceFolders so that:
 *   path.join(fsPath, '.vscode', 'logPatterns.json') → src/test/.vscode/logPatterns.json
 *
 * Instead, we place the test fixture so it's found. We already have src/test/logPatterns.json.
 * We mock workspaceFolders so the resolved path points to it.
 */

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LogLensDecorationProvider', () => {
  let provider: LogLensDecorationProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptions.length = 0;
    mockActiveEditor = undefined;

    // Point workspace folders so logPatterns.json resolves to our test fixture
    const vscode = require('vscode');
    // The provider looks for: path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'logPatterns.json')
    // Our fixture is at src/test/logPatterns.json
    // So set fsPath to the parent of '.vscode' that resolves correctly
    // Actually, let's use patternsFilePath config to point directly to the fixture
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'lensDecorationsEnabled') { return true; }
        if (key === 'patternsFilePath') {
          return path.join(__dirname, 'logPatterns.json');
        }
        return defaultVal;
      }),
    });

    provider = new LogLensDecorationProvider(createContext());
  });

  afterEach(() => {
    provider.dispose();
  });

  // ── Construction & Pattern Loading ────────────────────────────────────────

  describe('construction & pattern loading', () => {
    it('loads patterns from file and creates decoration types for each lens-enabled pattern', () => {
      provider.activate();

      // logPatterns.json has 3 patterns (error, warn, info), all lensEnabled=true
      expect(mockCreateDecorationType).toHaveBeenCalledTimes(3);
    });

    it('creates decoration types with correct colors', () => {
      provider.activate();

      const calls = mockCreateDecorationType.mock.calls;
      const colors = calls.map((c: any[]) => c[0].color);

      expect(colors).toContain('#ff4d4f'); // error
      expect(colors).toContain('#faad14'); // warn
      expect(colors).toContain('#40a9ff'); // info
    });

    it('creates decoration types with fontWeight bold', () => {
      provider.activate();

      const calls = mockCreateDecorationType.mock.calls;
      for (const call of calls) {
        expect(call[0].fontWeight).toBe('bold');
      }
    });
  });

  // ── applyDecorations (via activate with active editor) ────────────────────

  describe('applyDecorations', () => {
    it('decorates ERROR lines with setDecorations', () => {
      const editor = mockEditor([
        '2026-01-01 10:00:00 ERROR something failed',
        '2026-01-01 10:00:01 INFO all good',
      ]);
      mockActiveEditor = editor;

      provider.activate();

      // setDecorations should have been called with non-empty ranges
      // for the pattern that matches ERROR (line 0)
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(1);

      // At least one decoration range should be on line 0 (the ERROR line)
      const allRanges = nonEmptyCalls.flatMap((c: any[]) => c[1]);
      const line0Ranges = allRanges.filter((r: any) => r.start.line === 0);
      expect(line0Ranges.length).toBeGreaterThanOrEqual(1);
    });

    it('decorates WARN lines', () => {
      const editor = mockEditor([
        '2026-01-01 10:00:00 WARN slow query',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      const warnCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(warnCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('decorates INFO lines', () => {
      const editor = mockEditor([
        '2026-01-01 10:00:00 INFO startup complete',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      const infoCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(infoCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('only scans visible range', () => {
      const editor = mockEditor(
        [
          '2026-01-01 10:00:00 ERROR line 0',
          '2026-01-01 10:00:01 ERROR line 1',
          '2026-01-01 10:00:02 ERROR line 2',
          '2026-01-01 10:00:03 ERROR line 3',
          '2026-01-01 10:00:04 ERROR line 4',
        ],
        1, // visible start
        3, // visible end
      );
      mockActiveEditor = editor;
      provider.activate();

      // Decorations should only cover lines 1-3
      const rangesWithDecorations = mockSetDecorations.mock.calls
        .filter((c: any[]) => c[1].length > 0)
        .flatMap((c: any[]) => c[1]);

      for (const range of rangesWithDecorations) {
        expect(range.start.line).toBeGreaterThanOrEqual(1);
        expect(range.start.line).toBeLessThanOrEqual(3);
      }
    });

    it('matches case insensitively', () => {
      const editor = mockEditor([
        'error lowercase',
        'Error Mixed',
        'ERROR UPPER',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      // All 3 lines should get ERROR decoration
      const allRanges = mockSetDecorations.mock.calls
        .filter((c: any[]) => c[1].length > 0)
        .flatMap((c: any[]) => c[1]);

      const matchedLines = new Set(allRanges.map((r: any) => r.start.line));
      expect(matchedLines.has(0)).toBe(true);
      expect(matchedLines.has(1)).toBe(true);
      expect(matchedLines.has(2)).toBe(true);
    });

    it('handles lines with no pattern matches', () => {
      const editor = mockEditor([
        'just a plain log line with nothing special',
        'another ordinary line',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      // All setDecorations calls should have empty ranges
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls).toHaveLength(0);
    });

    it('handles empty document gracefully', () => {
      const editor = mockEditor([]);
      editor.visibleRanges = [{ start: { line: 0 }, end: { line: 0 } }];
      editor.document.lineCount = 0;
      mockActiveEditor = editor;

      expect(() => provider.activate()).not.toThrow();
    });

    it('applies multiple decorations when line matches multiple patterns', () => {
      const editor = mockEditor([
        'ERROR and WARN on same line',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      // Should have decoration calls with non-empty ranges for both ERROR and WARN patterns
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      // At least 2 different decoration types matched (ERROR, WARN)
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── toggle ────────────────────────────────────────────────────────────────

  describe('toggle', () => {
    it('disables decorations when toggled off', () => {
      const editor = mockEditor(['2026-01-01 10:00:00 ERROR fail']);
      mockActiveEditor = editor;
      provider.activate();

      jest.clearAllMocks();
      provider.toggle(); // off

      // setDecorations should be called with empty arrays to clear
      const calls = mockSetDecorations.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call[1]).toEqual([]);
      }
    });

    it('re-enables decorations when toggled on again', () => {
      const editor = mockEditor(['2026-01-01 10:00:00 ERROR fail']);
      mockActiveEditor = editor;
      provider.activate();

      provider.toggle(); // off
      jest.clearAllMocks();
      provider.toggle(); // on

      // Should have non-empty decoration calls again
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── dispose ─────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('disposes all decoration types', () => {
      provider.activate();

      const disposeCount = mockDispose.mock.calls.length;
      provider.dispose();

      // 3 decoration types should be disposed (in addition to any from rebuildDecorationTypes)
      expect(mockDispose.mock.calls.length).toBeGreaterThan(disposeCount);
    });
  });

  // ── refreshPatterns (via configuration change) ──────────────────────────

  describe('refreshPatterns', () => {
    it('disposes old decoration types and creates new ones when patterns reload', () => {
      provider.activate();

      const initialCreateCount = mockCreateDecorationType.mock.calls.length;
      const initialDisposeCount = mockDispose.mock.calls.length;

      // Simulate configuration change by calling activate again through the event handler
      // The onDidChangeConfiguration handler calls loadPatterns()
      // Instead, we can call activate() again which reloads patterns
      const configHandler = mockOnDidChangeConfiguration.mock.calls[0]?.[0];
      if (configHandler) {
        configHandler({ affectsConfiguration: (s: string) => s === 'acacia-log' });
      }

      // Old types should be disposed, new types created
      expect(mockDispose.mock.calls.length).toBeGreaterThan(initialDisposeCount);
      expect(mockCreateDecorationType.mock.calls.length).toBeGreaterThan(initialCreateCount);
    });
  });

  // ── Non-file schemes ────────────────────────────────────────────────────

  describe('scheme filtering', () => {
    it('does not apply decorations for non-file schemes', () => {
      const editor = mockEditor(['ERROR something']);
      editor.document.uri.scheme = 'untitled';
      mockActiveEditor = editor;
      provider.activate();

      // setDecorations should not be called on the editor
      expect(mockSetDecorations).not.toHaveBeenCalled();
    });

    it('applies decorations for allowed acacia-log scheme', () => {
      const editor = mockEditor(['ERROR something']);
      editor.document.uri.scheme = 'acacia-log';
      mockActiveEditor = editor;
      provider.activate();

      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Overview ruler ────────────────────────────────────────────────────────

  describe('overview ruler', () => {
    it('sets overviewRulerColor on every decoration type', () => {
      provider.activate();

      const calls = mockCreateDecorationType.mock.calls;
      // All 3 patterns (error, warn, info) should have overviewRulerColor
      expect(calls.length).toBe(3);
      for (const call of calls) {
        expect(call[0].overviewRulerColor).toBeDefined();
        expect(typeof call[0].overviewRulerColor).toBe('string');
        expect(call[0].overviewRulerColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('overviewRulerColor matches lensColor for each pattern', () => {
      provider.activate();

      const calls = mockCreateDecorationType.mock.calls;
      const rulerColors = calls.map((c: any[]) => c[0].overviewRulerColor);
      const textColors  = calls.map((c: any[]) => c[0].color);

      // ruler color must equal the text decoration color for each entry
      for (let i = 0; i < calls.length; i++) {
        expect(rulerColors[i]).toBe(textColors[i]);
      }
    });

    it('sets overviewRulerLane on every decoration type', () => {
      provider.activate();

      const calls = mockCreateDecorationType.mock.calls;
      for (const call of calls) {
        expect(call[0].overviewRulerLane).toBeDefined();
      }
    });

    it('uses Right lane for all level-category patterns (error, warn, info)', () => {
      provider.activate();

      const vscode = require('vscode');
      const calls = mockCreateDecorationType.mock.calls;
      // All 3 test-fixture patterns are lensCategory=level → Right lane
      for (const call of calls) {
        expect(call[0].overviewRulerLane).toBe(vscode.OverviewRulerLane.Right);
      }
    });
  });

  // ── Visible counts ────────────────────────────────────────────────────────

  describe('visible counts', () => {
    it('getVisibleCounts returns zero count for patterns with no matches', () => {
      const editor = mockEditor([
        'plain log line',
        'another plain line',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      const counts = provider.getVisibleCounts();
      // All patterns (error, warn, info) should have 0 matches
      for (const [, count] of counts) {
        expect(count).toBe(0);
      }
    });

    it('getVisibleCounts returns correct count for ERROR pattern', () => {
      const editor = mockEditor([
        '10:00:00 ERROR first failure',
        '10:00:01 INFO  all good',
        '10:00:02 ERROR second failure',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      const counts = provider.getVisibleCounts();
      expect(counts.get('error')).toBe(2);
    });

    it('getVisibleCounts accumulates counts when a single line matches multiple times', () => {
      // The regexp is 'ERROR' with global flag — each occurrence on a line is
      // a separate range, so a line with 'ERROR ERROR' yields 2 ranges
      const editor = mockEditor([
        '10:00:00 ERROR ERROR double',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      const counts = provider.getVisibleCounts();
      expect(counts.get('error')).toBeGreaterThanOrEqual(2);
    });

    it('counts update when visible range changes', () => {
      const editor = mockEditor(
        [
          '10:00:00 ERROR line 0',
          '10:00:01 INFO  line 1',
          '10:00:02 ERROR line 2',
          '10:00:03 INFO  line 3',
        ],
        0, 1, // visible: lines 0-1
      );
      mockActiveEditor = editor;
      provider.activate();

      // After first pass: 1 ERROR visible (line 0)
      expect(provider.getVisibleCounts().get('error')).toBe(1);

      // Simulate scroll: now lines 2-3 are visible
      editor.visibleRanges = [{ start: { line: 2 }, end: { line: 3 } }];
      jest.clearAllMocks();

      // Trigger the visible range change handler
      const vrHandler = mockOnDidChangeTextEditorVisibleRanges.mock.calls[0]?.[0];
      if (vrHandler) {
        vrHandler({ textEditor: editor });
      }

      // After second pass: 1 ERROR visible (line 2)
      expect(provider.getVisibleCounts().get('error')).toBe(1);
    });

    it('hidden lens does not appear in visible counts', () => {
      const editor = mockEditor(['10:00:00 ERROR failure']);
      mockActiveEditor = editor;
      provider.activate();

      // Hide the error lens
      provider.setLensVisible('error', false);

      const counts = provider.getVisibleCounts();
      // 'error' should be absent since it was skipped in the loop
      expect(counts.has('error')).toBe(false);
    });
  });

  // ── Per-lens visibility toggle (setLensVisible / getLensVisible) ──────────

  describe('per-lens visibility', () => {
    it('getLensVisible returns true for a known key with no override', () => {
      provider.activate();
      expect(provider.getLensVisible('error')).toBe(true);
    });

    it('getLensVisible returns true for an unknown key', () => {
      provider.activate();
      expect(provider.getLensVisible('nonexistent')).toBe(true);
    });

    it('setLensVisible(key, false) suppresses decorations for that lens', () => {
      const editor = mockEditor(['10:00:00 ERROR fail']);
      mockActiveEditor = editor;
      provider.activate();

      jest.clearAllMocks();
      provider.setLensVisible('error', false);

      // After hiding: the error decoration type should receive empty ranges
      const errorDecorationIndex = mockCreateDecorationType.mock.calls
        .findIndex((c: any[]) => c[0].color === '#ff4d4f');

      const errorDecorationType =
        mockCreateDecorationType.mock.results[errorDecorationIndex]?.value;

      if (errorDecorationType) {
        const clearCall = mockSetDecorations.mock.calls.find(
          (c: any[]) => c[0] === errorDecorationType && c[1].length === 0
        );
        expect(clearCall).toBeDefined();
      }
    });

    it('getLensVisible returns false after setLensVisible(key, false)', () => {
      provider.activate();
      provider.setLensVisible('error', false);
      expect(provider.getLensVisible('error')).toBe(false);
    });

    it('setLensVisible(key, true) re-enables a hidden lens', () => {
      const editor = mockEditor(['10:00:00 ERROR fail']);
      mockActiveEditor = editor;
      provider.activate();

      provider.setLensVisible('error', false);
      jest.clearAllMocks();
      provider.setLensVisible('error', true);

      expect(provider.getLensVisible('error')).toBe(true);

      // Non-empty decoration call expected after re-enable
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('setLensVisible(key, undefined) removes the override', () => {
      provider.activate();
      provider.setLensVisible('error', false);
      expect(provider.getLensVisible('error')).toBe(false);

      provider.setLensVisible('error', undefined);
      // Should revert to the pattern's lensEnabled=true from JSON
      expect(provider.getLensVisible('error')).toBe(true);
    });

    it('hiding one lens does not affect other lenses', () => {
      const editor = mockEditor([
        '10:00:00 ERROR fail',
        '10:00:01 WARN  slow',
      ]);
      mockActiveEditor = editor;
      provider.activate();

      jest.clearAllMocks();
      provider.setLensVisible('error', false);

      // WARN decorations should still fire with non-empty ranges
      const nonEmptyCalls = mockSetDecorations.mock.calls.filter(
        (c: any[]) => c[1].length > 0
      );
      expect(nonEmptyCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── onDidUpdateCounts event ───────────────────────────────────────────────

  describe('onDidUpdateCounts', () => {
    it('fires after each decoration pass', () => {
      const editor = mockEditor(['10:00:00 ERROR fail']);
      mockActiveEditor = editor;
      provider.activate();

      // The EventEmitter mock's fire() should have been called at least once
      const vscode = require('vscode');
      const emitterInstance = vscode.EventEmitter.mock.results[0]?.value;
      if (emitterInstance) {
        expect(emitterInstance.fire).toHaveBeenCalled();
      }
    });

    it('EventEmitter is disposed on provider.dispose()', () => {
      provider.activate();

      const vscode = require('vscode');
      const emitterInstance = vscode.EventEmitter.mock.results[0]?.value;

      provider.dispose();

      if (emitterInstance) {
        expect(emitterInstance.dispose).toHaveBeenCalled();
      }
    });
  });
});
