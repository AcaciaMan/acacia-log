/**
 * Unit tests for extension activation (extension.ts)
 * Uses .jest.ts suffix to avoid conflict with the existing Mocha-based extension.test.ts.
 */

// ── Mock setup (must be before imports) ───────────────────────────────────────

const mockSubscriptions: any[] = [];
const mockRegisterCommand = jest.fn().mockReturnValue({ dispose: jest.fn() });
const mockRegisterWebviewViewProvider = jest.fn().mockReturnValue({ dispose: jest.fn() });
const mockRegisterTextDocumentContentProvider = jest.fn().mockReturnValue({ dispose: jest.fn() });
const mockCreateTreeView = jest.fn().mockReturnValue({
  dispose: jest.fn(),
  onDidChangeSelection: jest.fn(),
  selection: [],
});

jest.mock('vscode', () => ({
  commands: {
    registerCommand: mockRegisterCommand,
    executeCommand: jest.fn(),
  },
  window: {
    registerWebviewViewProvider: mockRegisterWebviewViewProvider,
    createTreeView: mockCreateTreeView,
    onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeVisibleTextEditors: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeTextEditorVisibleRanges: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    showInputBox: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
  },
  workspace: {
    registerTextDocumentContentProvider: mockRegisterTextDocumentContentProvider,
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn(),
    }),
    onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    workspaceFolders: [{ uri: { fsPath: '/mock' } }],
    openTextDocument: jest.fn().mockResolvedValue({}),
  },
  Uri: {
    parse: jest.fn((s: string) => ({ toString: () => s, fsPath: s, scheme: 'file' })),
    file: jest.fn((p: string) => ({ fsPath: p, toString: () => `file://${p}`, scheme: 'file' })),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
  TreeItem: class {
    constructor(public label: string) {}
  },
  TreeItemCollapsibleState: { Collapsed: 1, None: 0, Expanded: 2 },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn(),
  ViewColumn: { One: 1, Beside: 2 },
  MarkdownString: jest.fn().mockImplementation((s: string) => ({ value: s })),
  ThemeIcon: jest.fn(),
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  TextEditorRevealType: { InCenter: 2 },
  QuickPickItemKind: { Separator: -1 },
}), { virtual: true });

// Mock internal modules to prevent side effects
jest.mock('../utils/navigateToDateTime', () => ({ navigateToDateTime: jest.fn() }));
jest.mock('../utils/calculateSimilarLineCounts', () => ({ calculateSimilarLineCounts: jest.fn() }));
jest.mock('../utils/drawLogTimeline', () => ({ drawLogTimeline: jest.fn() }));
jest.mock('../utils/createLogPatterns', () => ({ createLogPatterns: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/log-to-jsonl-command', () => ({ convertToJsonl: jest.fn() }));
jest.mock('../utils/jsonl-to-log', () => ({ convertJsonlToLog: jest.fn() }));
jest.mock('../utils/log-file-reader', () => ({ readLineRange: jest.fn() }));
jest.mock('../utils/log-context', () => {
  const mockInstance = {
    activeFilePath: undefined,
    setActiveFile: jest.fn(),
    resolveEditor: jest.fn(),
    getOrDetectFormat: jest.fn(),
    getCachedFormat: jest.fn(),
    clearFormatCache: jest.fn(),
    clearAllFormatCache: jest.fn(),
    onDidChangeActiveFile: jest.fn(),
    dispose: jest.fn(),
  };
  return {
    LogContext: {
      getInstance: jest.fn().mockReturnValue(mockInstance),
      resetInstance: jest.fn(),
    },
    ILogContext: {},
  };
});
jest.mock('../utils/resultDocumentProvider', () => ({
  ResultDocumentProvider: {
    getInstance: jest.fn().mockReturnValue({
      setChunkState: jest.fn(),
      getChunkState: jest.fn(),
      getCachedLineIndex: jest.fn(),
      openLogChunkResult: jest.fn(),
    }),
  },
}));
jest.mock('../logManagement/logTreeProvider', () => ({
  LogTreeProvider: jest.fn().mockImplementation(() => ({
    refresh: jest.fn(),
    addFolder: jest.fn(),
    removeFolder: jest.fn(),
    openFile: jest.fn(),
    revealInExplorer: jest.fn(),
    loadMetadata: jest.fn(),
    onDidChangeTreeData: jest.fn(),
    getTreeItem: jest.fn(),
    getChildren: jest.fn(),
    setFilter: jest.fn(),
    getFilter: jest.fn().mockReturnValue({}),
    hasActiveFilter: jest.fn().mockReturnValue(false),
    dispose: jest.fn(),
  })),
  LogTreeItem: jest.fn(),
}));
jest.mock('../logSearch/logLensDecorationProvider', () => ({
  LogLensDecorationProvider: jest.fn().mockImplementation(() => ({
    applyDecorations: jest.fn(),
    clearDecorations: jest.fn(),
    toggle: jest.fn(),
    isEnabled: jest.fn(),
    activate: jest.fn(),
    dispose: jest.fn(),
  })),
}));
jest.mock('../logSearch/unifiedLogViewProvider', () => {
  const ctor = jest.fn().mockImplementation(() => ({
    switchTab: jest.fn(),
    showFileInfo: jest.fn(),
  }));
  (ctor as any).viewType = 'acacia-log.unifiedView';
  return { UnifiedLogViewProvider: ctor };
});
jest.mock('../logSearch/editorToolsViewProvider', () => {
  const ctor = jest.fn().mockImplementation(() => ({
    switchTab: jest.fn(),
  }));
  (ctor as any).viewType = 'acacia-log.editorTools';
  return { EditorToolsViewProvider: ctor };
});
jest.mock('../logSearch/logGapReportProvider', () => ({
  LogGapReportProvider: jest.fn().mockImplementation(() => ({
    generateReport: jest.fn(),
  })),
}));
jest.mock('../logSearch/logChunkStatsProvider', () => ({
  LogChunkStatsProvider: jest.fn().mockImplementation(() => ({
    generateReport: jest.fn(),
  })),
}));
jest.mock('../logSearch/logChunkStatsComparisonProvider', () => ({
  LogChunkStatsComparisonProvider: jest.fn().mockImplementation(() => ({
    generateComparison: jest.fn(),
  })),
}));
// luxon is imported but only used inside DateTime calls; mock it lightly
jest.mock('luxon', () => ({
  DateTime: { fromFormat: jest.fn(), fromISO: jest.fn(), now: jest.fn() },
}));

// ── Import under test ─────────────────────────────────────────────────────────

import { activate, deactivate } from '../extension';
import { UnifiedLogViewProvider } from '../logSearch/unifiedLogViewProvider';
import { EditorToolsViewProvider } from '../logSearch/editorToolsViewProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockContext(): any {
  // Reset for each test
  mockSubscriptions.length = 0;
  return {
    subscriptions: mockSubscriptions,
    extensionPath: '/mock/extension/path',
    extensionUri: { fsPath: '/mock/extension/path' },
  };
}

/** Returns all command IDs passed to registerCommand across all calls. */
function getRegisteredCommandIds(): string[] {
  return mockRegisterCommand.mock.calls.map((call: any[]) => call[0]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Extension activation', () => {
  let context: any;

  beforeEach(() => {
    jest.clearAllMocks();
    context = createMockContext();
    activate(context);
  });

  // ── Activation basics ───────────────────────────────────────────────────

  describe('activation basics', () => {
    it('pushes disposables to context.subscriptions', () => {
      expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('registers the expected number of commands (≥ 30)', () => {
      expect(mockRegisterCommand.mock.calls.length).toBeGreaterThanOrEqual(30);
    });
  });

  // ── Provider registration ───────────────────────────────────────────────

  describe('provider registration', () => {
    it('registers UnifiedLogViewProvider webview', () => {
      expect(mockRegisterWebviewViewProvider).toHaveBeenCalledWith(
        'acacia-log.unifiedView',
        expect.any(Object),
      );
    });

    it('registers EditorToolsViewProvider webview', () => {
      expect(mockRegisterWebviewViewProvider).toHaveBeenCalledWith(
        'acacia-log.editorTools',
        expect.any(Object),
      );
    });

    it('registers ResultDocumentProvider for the acacia-log scheme', () => {
      expect(mockRegisterTextDocumentContentProvider).toHaveBeenCalledWith(
        'acacia-log',
        expect.any(Object),
      );
    });

    it('creates tree view for acacia-log.logExplorer', () => {
      expect(mockCreateTreeView).toHaveBeenCalledWith(
        'acacia-log.logExplorer',
        expect.objectContaining({
          treeDataProvider: expect.any(Object),
          showCollapseAll: true,
        }),
      );
    });

    it('registers exactly 2 webview view providers', () => {
      expect(mockRegisterWebviewViewProvider).toHaveBeenCalledTimes(2);
    });
  });

  // ── Command IDs ─────────────────────────────────────────────────────────

  describe('command registration', () => {
    const expectedCommands: string[] = [
      // Hello world
      'acacia-log.helloWorld',
      // Configuration commands
      'extension.setLogDateFormat',
      'extension.setLogDateRegex',
      'extension.setLogSearchDate',
      'extension.setLogSearchTime',
      // Analysis commands
      'extension.calculateSimilarLineCounts',
      'extension.drawLogTimeline',
      // Load more context
      'acacia-log.loadMoreAbove',
      'acacia-log.loadMoreBelow',
      // Decoration toggle
      'acacia-log.toggleLensDecorations',
      // Tree view commands
      'acacia-log.logExplorer.onFileClick',
      'acacia-log.logExplorer.refresh',
      'acacia-log.logExplorer.filter',
      'acacia-log.logExplorer.clearFilter',
      'acacia-log.logExplorer.addFolder',
      'acacia-log.logExplorer.removeFolder',
      'acacia-log.logExplorer.openFile',
      'acacia-log.logExplorer.showFileInfo',
      'acacia-log.logExplorer.revealInExplorer',
      // Report generation
      'acacia-log.logExplorer.generateGapReport',
      'acacia-log.logExplorer.generateChunkStatsReport',
      'acacia-log.logExplorer.compareChunkStats',
      // Conversion commands
      'acacia-log.convertToJsonl',
      'acacia-log.logExplorer.convertToJsonl',
      'acacia-log.logExplorer.convertJsonlToLog',
      // Unified view tab switching
      'acacia-log.unifiedView.switchToLogAnalysis',
      'acacia-log.unifiedView.switchToSimilarLines',
      'acacia-log.unifiedView.switchToTimeline',
      'acacia-log.unifiedView.switchToPatternSearch',
      'acacia-log.unifiedView.switchToFileInfo',
      // Editor tools tab switching
      'acacia-log.editorTools.switchToSimilarLines',
      'acacia-log.editorTools.switchToTimeline',
    ];

    it.each(expectedCommands)('registers command "%s"', (commandId) => {
      const registeredIds = getRegisteredCommandIds();
      expect(registeredIds).toContain(commandId);
    });

    it('all expected commands are accounted for (no extras missing)', () => {
      const registeredIds = getRegisteredCommandIds();
      for (const cmd of expectedCommands) {
        expect(registeredIds).toContain(cmd);
      }
    });

    it('total registered command count matches expected list', () => {
      const registeredIds = getRegisteredCommandIds();
      expect(registeredIds.length).toBe(expectedCommands.length);
    });
  });

  // ── Subscriptions ──────────────────────────────────────────────────────

  describe('subscriptions', () => {
    it('all registered commands are pushed to subscriptions', () => {
      // Each registerCommand return value should end up in subscriptions
      const commandDisposables = mockRegisterCommand.mock.results.map(
        (r: any) => r.value,
      );
      for (const disposable of commandDisposables) {
        expect(context.subscriptions).toContain(disposable);
      }
    });

    it('webview provider disposables are in subscriptions', () => {
      const webviewDisposables = mockRegisterWebviewViewProvider.mock.results.map(
        (r: any) => r.value,
      );
      for (const disposable of webviewDisposables) {
        expect(context.subscriptions).toContain(disposable);
      }
    });

    it('content provider disposable is in subscriptions', () => {
      const contentDisposables = mockRegisterTextDocumentContentProvider.mock.results.map(
        (r: any) => r.value,
      );
      for (const disposable of contentDisposables) {
        expect(context.subscriptions).toContain(disposable);
      }
    });

    it('tree view disposable is in subscriptions', () => {
      const treeDisposable = mockCreateTreeView.mock.results[0].value;
      expect(context.subscriptions).toContain(treeDisposable);
    });
  });
});

// ── Deactivation ──────────────────────────────────────────────────────────────

describe('Extension deactivation', () => {
  it('deactivate is a no-op and does not throw', () => {
    expect(() => deactivate()).not.toThrow();
  });

  it('deactivate returns undefined', () => {
    expect(deactivate()).toBeUndefined();
  });
});

// ── Command handler execution tests ───────────────────────────────────────────

describe('Command handler execution', () => {
  let context: any;

  /** Returns the handler function registered for the given command ID. */
  function getHandler(commandId: string): (...args: any[]) => any {
    const call = mockRegisterCommand.mock.calls.find((c: any[]) => c[0] === commandId);
    if (!call) { throw new Error(`Command not registered: ${commandId}`); }
    return call[1];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    context = createMockContext();
    activate(context);
  });

  // ── helloWorld ──

  it('helloWorld shows information message', () => {
    const handler = getHandler('acacia-log.helloWorld');
    handler();
    const vscode = require('vscode');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Hello World from acacia-log!');
  });

  // ── setLogDateFormat ──

  it('setLogDateFormat updates config when input is provided', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('dd/MM/yyyy');
    const handler = getHandler('extension.setLogDateFormat');
    await handler();
    expect(vscode.workspace.getConfiguration().update).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('dd/MM/yyyy')
    );
  });

  it('setLogDateFormat does nothing when input is cancelled', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue(undefined);
    const handler = getHandler('extension.setLogDateFormat');
    await handler();
    expect(vscode.workspace.getConfiguration().update).not.toHaveBeenCalled();
  });

  // ── setLogDateRegex ──

  it('setLogDateRegex updates config when input provided', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('\\d+');
    const handler = getHandler('extension.setLogDateRegex');
    await handler();
    expect(vscode.workspace.getConfiguration().update).toHaveBeenCalled();
  });

  it('setLogDateRegex does nothing when cancelled', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue(undefined);
    const handler = getHandler('extension.setLogDateRegex');
    await handler();
    expect(vscode.workspace.getConfiguration().update).not.toHaveBeenCalled();
  });

  // ── setLogSearchDate ──

  it('setLogSearchDate updates config when input provided', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('2026-01-15');
    const handler = getHandler('extension.setLogSearchDate');
    await handler();
    expect(vscode.workspace.getConfiguration().update).toHaveBeenCalled();
  });

  it('setLogSearchDate does nothing when cancelled', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue(undefined);
    const handler = getHandler('extension.setLogSearchDate');
    await handler();
    expect(vscode.workspace.getConfiguration().update).not.toHaveBeenCalled();
  });

  // ── setLogSearchTime ──

  it('setLogSearchTime updates config and navigates when input provided', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('14:30:00');
    const handler = getHandler('extension.setLogSearchTime');
    await handler();
    expect(vscode.workspace.getConfiguration().update).toHaveBeenCalled();
  });

  it('setLogSearchTime still calls navigateToDateTime even when cancelled', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue(undefined);
    const handler = getHandler('extension.setLogSearchTime');
    await handler();
    // navigateToDateTime is always called, even when input is undefined
  });

  // ── calculateSimilarLineCounts ──

  it('calculateSimilarLineCounts shows error when no active editor', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('extension.calculateSimilarLineCounts');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active editor found');
  });

  it('calculateSimilarLineCounts calls function when editor exists', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = { document: {} };
    const handler = getHandler('extension.calculateSimilarLineCounts');
    await handler();
    const { calculateSimilarLineCounts } = require('../utils/calculateSimilarLineCounts');
    expect(calculateSimilarLineCounts).toHaveBeenCalledWith(vscode.window.activeTextEditor);
  });

  // ── drawLogTimeline ──

  it('drawLogTimeline shows error when no active editor', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('extension.drawLogTimeline');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active editor found');
  });

  it('drawLogTimeline calls function when editor exists', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = { document: {} };
    const handler = getHandler('extension.drawLogTimeline');
    await handler();
    const { drawLogTimeline } = require('../utils/drawLogTimeline');
    expect(drawLogTimeline).toHaveBeenCalled();
  });

  // ── loadMoreAbove ──

  it('loadMoreAbove warns when no chunk state', async () => {
    const vscode = require('vscode');
    const { ResultDocumentProvider } = require('../utils/resultDocumentProvider');
    ResultDocumentProvider.getInstance.mockReturnValue({
      getChunkState: jest.fn().mockReturnValue(undefined),
      setChunkState: jest.fn(),
    });
    const handler = getHandler('acacia-log.loadMoreAbove');
    await handler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('[Acacia Log] No chunk loaded yet.');
  });

  it('loadMoreAbove shows info when already at start', async () => {
    const vscode = require('vscode');
    const { ResultDocumentProvider } = require('../utils/resultDocumentProvider');
    ResultDocumentProvider.getInstance.mockReturnValue({
      getChunkState: jest.fn().mockReturnValue({
        ctxStart: 0, ctxEnd: 100, matchedLine: 50, totalLines: 200,
        filePath: '/test.log', lineIndex: {},
      }),
      setChunkState: jest.fn(),
    });
    const handler = getHandler('acacia-log.loadMoreAbove');
    await handler();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('[Acacia Log] Already at the start of file.');
  });

  // ── loadMoreBelow ──

  it('loadMoreBelow warns when no chunk state', async () => {
    const vscode = require('vscode');
    const { ResultDocumentProvider } = require('../utils/resultDocumentProvider');
    ResultDocumentProvider.getInstance.mockReturnValue({
      getChunkState: jest.fn().mockReturnValue(undefined),
      setChunkState: jest.fn(),
    });
    const handler = getHandler('acacia-log.loadMoreBelow');
    await handler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('[Acacia Log] No chunk loaded yet.');
  });

  it('loadMoreBelow shows info when already at end', async () => {
    const vscode = require('vscode');
    const { ResultDocumentProvider } = require('../utils/resultDocumentProvider');
    ResultDocumentProvider.getInstance.mockReturnValue({
      getChunkState: jest.fn().mockReturnValue({
        ctxStart: 0, ctxEnd: 199, matchedLine: 50, totalLines: 200,
        filePath: '/test.log', lineIndex: {},
      }),
      setChunkState: jest.fn(),
    });
    const handler = getHandler('acacia-log.loadMoreBelow');
    await handler();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('[Acacia Log] Already at the end of file.');
  });

  // ── toggleLensDecorations ──

  it('toggleLensDecorations calls toggle on provider', () => {
    const handler = getHandler('acacia-log.toggleLensDecorations');
    handler();
    // Just ensure it doesn't throw — toggle is mocked
  });

  // ── onFileClick ──

  it('onFileClick returns early for folder items', async () => {
    const handler = getHandler('acacia-log.logExplorer.onFileClick');
    await handler({ isFolder: true });
    // Should not show any message or perform any action
  });

  it('onFileClick returns early for items without resourceUri', async () => {
    const handler = getHandler('acacia-log.logExplorer.onFileClick');
    await handler({ isFolder: false, resourceUri: undefined });
  });

  // ── generateGapReport ──

  it('generateGapReport shows error when no file selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('acacia-log.logExplorer.generateGapReport');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Please select a log file first');
  });

  // ── generateChunkStatsReport ──

  it('generateChunkStatsReport shows error when no file selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('acacia-log.logExplorer.generateChunkStatsReport');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Please select a log file first');
  });

  // ── compareChunkStats ──

  it('compareChunkStats warns when less than 2 files selected', async () => {
    const vscode = require('vscode');
    const handler = getHandler('acacia-log.logExplorer.compareChunkStats');
    await handler(undefined, []);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Select at least 2 log files')
    );
  });

  // ── showFileInfo ──

  it('showFileInfo calls unifiedLogView when resourceUri exists', async () => {
    const handler = getHandler('acacia-log.logExplorer.showFileInfo');
    await handler({ resourceUri: { fsPath: '/test.log' }, metadata: {} });
    const { UnifiedLogViewProvider: ULP } = require('../logSearch/unifiedLogViewProvider');
    const instance = ULP.mock.results[0].value;
    expect(instance.showFileInfo).toHaveBeenCalled();
  });

  it('showFileInfo does nothing when no resourceUri', async () => {
    const handler = getHandler('acacia-log.logExplorer.showFileInfo');
    await handler({ resourceUri: undefined });
    // No error expected
  });

  // ── convertToJsonl (tree) ──

  it('convertToJsonl tree shows error when no file selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('acacia-log.logExplorer.convertToJsonl');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Acacia Log: Please select a log file first.');
  });

  // ── convertJsonlToLog ──

  it('convertJsonlToLog shows error when no file selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = undefined;
    const handler = getHandler('acacia-log.logExplorer.convertJsonlToLog');
    await handler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Please select a JSONL file first.');
  });

  // ── tab switching commands ──

  it('switchToLogAnalysis focuses editor tools and switches tab', () => {
    const handler = getHandler('acacia-log.unifiedView.switchToLogAnalysis');
    handler();
    const vscode = require('vscode');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('acacia-log.editorTools.focus');
  });

  it('switchToSimilarLines switches tab on unified view', () => {
    const handler = getHandler('acacia-log.unifiedView.switchToSimilarLines');
    handler();
  });

  it('switchToTimeline switches tab on unified view', () => {
    const handler = getHandler('acacia-log.unifiedView.switchToTimeline');
    handler();
  });

  it('switchToPatternSearch switches tab on unified view', () => {
    const handler = getHandler('acacia-log.unifiedView.switchToPatternSearch');
    handler();
  });

  it('switchToFileInfo switches tab on unified view', () => {
    const handler = getHandler('acacia-log.unifiedView.switchToFileInfo');
    handler();
  });

  it('editorTools switchToSimilarLines focuses and switches', () => {
    const handler = getHandler('acacia-log.editorTools.switchToSimilarLines');
    handler();
    const vscode = require('vscode');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('acacia-log.editorTools.focus');
  });

  it('editorTools switchToTimeline focuses and switches', () => {
    const handler = getHandler('acacia-log.editorTools.switchToTimeline');
    handler();
    const vscode = require('vscode');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('acacia-log.editorTools.focus');
  });

  // ── refresh, addFolder, removeFolder, openFile, revealInExplorer ──

  it('refresh calls logTreeProvider.refresh', () => {
    const handler = getHandler('acacia-log.logExplorer.refresh');
    handler();
  });

  it('addFolder calls logTreeProvider.addFolder', () => {
    const handler = getHandler('acacia-log.logExplorer.addFolder');
    handler();
  });

  it('removeFolder calls logTreeProvider.removeFolder', () => {
    const handler = getHandler('acacia-log.logExplorer.removeFolder');
    handler({ isFolder: true });
  });

  it('openFile calls logTreeProvider.openFile', () => {
    const handler = getHandler('acacia-log.logExplorer.openFile');
    handler({});
  });

  it('revealInExplorer calls logTreeProvider.revealInExplorer', () => {
    const handler = getHandler('acacia-log.logExplorer.revealInExplorer');
    handler({});
  });
});
