/**
 * Unit tests for lensStatusBar.ts
 * Tests item creation, count updates, visibility toggling, and disposal.
 */

import * as path from 'path';

// ── Mock setup (before any imports) ──────────────────────────────────────────

const mockStatusBarItemShow = jest.fn();
const mockStatusBarItemHide = jest.fn();
const mockStatusBarItemDispose = jest.fn();

// Factory returns a fresh mock item each call
const mockCreateStatusBarItem = jest.fn().mockImplementation(() => ({
  text: '',
  color: undefined as string | undefined,
  tooltip: undefined as any,
  command: undefined as any,
  show: mockStatusBarItemShow,
  hide: mockStatusBarItemHide,
  dispose: mockStatusBarItemDispose,
}));

let mockActiveEditor: any = undefined;
const mockOnDidChangeActiveTextEditor = jest.fn();
const mockOnDidChangeConfiguration = jest.fn();
const mockSubscriptions: any[] = [];

jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: mockCreateStatusBarItem,
    get activeTextEditor() { return mockActiveEditor; },
    onDidChangeActiveTextEditor: mockOnDidChangeActiveTextEditor
      .mockReturnValue({ dispose: jest.fn() }),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'patternsFilePath') {
          return path.join(__dirname, 'logPatterns.json');
        }
        return defaultVal;
      }),
    }),
    workspaceFolders: [{ uri: { fsPath: path.join(__dirname) } }],
    onDidChangeConfiguration: mockOnDidChangeConfiguration
      .mockReturnValue({ dispose: jest.fn() }),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  MarkdownString: jest.fn().mockImplementation((value: string, trusted?: boolean) => ({
    value,
    isTrusted: trusted ?? false,
    supportThemeIcons: false,
  })),
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}), { virtual: true });

// ── Mock LogLensDecorationProvider ────────────────────────────────────────────

function createMockDecorationProvider() {
  const onDidUpdateCountsListeners: Array<(counts: ReadonlyMap<string, number>) => void> = [];

  return {
    onDidUpdateCounts: jest.fn((listener: (counts: ReadonlyMap<string, number>) => void) => {
      onDidUpdateCountsListeners.push(listener);
      return { dispose: jest.fn() };
    }),
    getLensVisible: jest.fn().mockReturnValue(true),
    setLensVisible: jest.fn(),
    // Helper to simulate a decoration pass firing counts
    _fireCounts(counts: ReadonlyMap<string, number>) {
      for (const l of onDidUpdateCountsListeners) { l(counts); }
    },
  };
}

import { LensStatusBar } from '../logSearch/lensStatusBar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createContext(): any {
  return {
    extensionPath: path.join(__dirname, '..'),
    subscriptions: mockSubscriptions,
  };
}

function fileEditor(): any {
  return {
    document: {
      uri: { scheme: 'file' },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LensStatusBar', () => {
  let provider: ReturnType<typeof createMockDecorationProvider>;
  let statusBar: LensStatusBar;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptions.length = 0;
    mockActiveEditor = undefined;
    provider = createMockDecorationProvider();
    statusBar = new LensStatusBar(provider as any, createContext());
  });

  afterEach(() => {
    statusBar.dispose();
  });

  // ── Construction ─────────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates the manager status bar item on construction', () => {
      // Manager item should be created inside the constructor
      expect(mockCreateStatusBarItem).toHaveBeenCalledTimes(1);
    });

    it('manager item text contains Lenses', () => {
      const managerItem = mockCreateStatusBarItem.mock.results[0].value;
      expect(managerItem.text).toMatch(/Lenses/);
    });

    it('manager item command is acacia-log.manageLenses', () => {
      const managerItem = mockCreateStatusBarItem.mock.results[0].value;
      expect(managerItem.command).toBe('acacia-log.manageLenses');
    });
  });

  // ── activate() ───────────────────────────────────────────────────────────

  describe('activate()', () => {
    it('creates per-lens status bar items for patterns with lensShowInStatusBar=true', () => {
      // logPatterns.json has 3 patterns (error, warn, info), all lensShowInStatusBar=true
      // Manager item was created in constructor → total items = 1 + 3 = 4
      statusBar.activate();
      expect(mockCreateStatusBarItem.mock.calls.length).toBe(4);
    });

    it('subscribes to onDidUpdateCounts', () => {
      statusBar.activate();
      expect(provider.onDidUpdateCounts).toHaveBeenCalled();
    });

    it('subscribes to onDidChangeActiveTextEditor', () => {
      statusBar.activate();
      const vscode = require('vscode');
      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
    });
  });

  // ── Visibility (show / hide) ─────────────────────────────────────────────

  describe('visibility', () => {
    it('shows all items when active editor has file scheme', () => {
      mockActiveEditor = fileEditor();
      statusBar.activate();

      expect(mockStatusBarItemShow).toHaveBeenCalled();
    });

    it('hides all items when no active editor', () => {
      mockActiveEditor = undefined;
      statusBar.activate();

      expect(mockStatusBarItemHide).toHaveBeenCalled();
    });

    it('hides all items for untitled scheme', () => {
      mockActiveEditor = { document: { uri: { scheme: 'untitled' } } };
      statusBar.activate();

      expect(mockStatusBarItemHide).toHaveBeenCalled();
    });

    it('shows items for acacia-log scheme', () => {
      mockActiveEditor = { document: { uri: { scheme: 'acacia-log' } } };
      statusBar.activate();

      expect(mockStatusBarItemShow).toHaveBeenCalled();
    });

    it('shows items when editor switches to a file', () => {
      mockActiveEditor = undefined;
      statusBar.activate();

      // Capture handler BEFORE clearing mocks
      const editorChangeHandler =
        mockOnDidChangeActiveTextEditor.mock.calls[0]?.[0];

      jest.clearAllMocks();

      // Simulate editor change to a file
      mockActiveEditor = fileEditor();
      if (editorChangeHandler) {
        editorChangeHandler(mockActiveEditor);
      }

      expect(mockStatusBarItemShow).toHaveBeenCalled();
    });
  });

  // ── Count updates ─────────────────────────────────────────────────────────

  describe('count updates', () => {
    it('updates per-lens item text when counts fire', () => {
      mockActiveEditor = fileEditor();
      statusBar.activate();

      // Capture items BEFORE clearing mocks so we still have references
      const allItems = mockCreateStatusBarItem.mock.results.map(r => r.value);

      jest.clearAllMocks();

      const counts = new Map([
        ['error', 12],
        ['warn',   3],
        ['info',  47],
      ]);
      (provider as any)._fireCounts(counts);

      // At least one lens item should have updated text containing the count
      const textsWithCounts = allItems
        .map((item: any) => item.text as string)
        .filter((t: string) => /\d+/.test(t));

      expect(textsWithCounts.length).toBeGreaterThanOrEqual(1);

      // Verify specific counts appear in item texts
      const allTexts = allItems.map((i: any) => i.text).join(' ');
      expect(allTexts).toMatch(/12|3|47/);
    });

    it('zero count displays as 0 not blank', () => {
      mockActiveEditor = fileEditor();
      statusBar.activate();

      const counts = new Map([
        ['error', 0],
        ['warn',  0],
        ['info',  0],
      ]);
      (provider as any)._fireCounts(counts);

      const allItems = mockCreateStatusBarItem.mock.results.map(r => r.value);
      // Items for lens patterns should show 0
      const lensItems = allItems.slice(1); // skip manager item
      for (const item of lensItems) {
        expect(String(item.text)).toMatch(/0/);
      }
    });
  });

  // ── dispose() ────────────────────────────────────────────────────────────

  describe('dispose()', () => {
    it('disposes the manager item', () => {
      statusBar.activate();

      const disposeCountBefore = mockStatusBarItemDispose.mock.calls.length;
      statusBar.dispose();

      expect(mockStatusBarItemDispose.mock.calls.length).toBeGreaterThan(
        disposeCountBefore,
      );
    });

    it('disposes all lens items', () => {
      statusBar.activate();

      const disposeCountBefore = mockStatusBarItemDispose.mock.calls.length;
      statusBar.dispose();

      // Should dispose manager + 3 lens items = at least 4 calls total
      const newDisposals =
        mockStatusBarItemDispose.mock.calls.length - disposeCountBefore;
      expect(newDisposals).toBeGreaterThanOrEqual(4);
    });
  });

  // ── refresh() ────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('rebuilds items without error', () => {
      statusBar.activate();

      expect(() => statusBar.refresh()).not.toThrow();
    });

    it('disposes old lens items and creates new ones', () => {
      statusBar.activate();

      const disposeBefore = mockStatusBarItemDispose.mock.calls.length;
      const createBefore = mockCreateStatusBarItem.mock.calls.length;

      statusBar.refresh();

      // Old lens items should be disposed (3 items)
      expect(mockStatusBarItemDispose.mock.calls.length).toBeGreaterThan(disposeBefore);
      // New lens items should be created
      expect(mockCreateStatusBarItem.mock.calls.length).toBeGreaterThan(createBefore);
    });
  });
});
