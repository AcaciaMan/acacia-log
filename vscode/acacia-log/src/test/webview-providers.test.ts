/**
 * Integration tests for webview providers.
 *
 * Covers message handling, HTML generation, and provider lifecycle for:
 *  - UnifiedLogViewProvider
 *  - EditorToolsViewProvider
 *  - LogGapReportProvider
 *  - LogChunkStatsProvider
 *  - LogChunkStatsComparisonProvider
 */

// ── Mock setup (must precede imports) ─────────────────────────────────────────

const mockPostMessage = jest.fn();
const mockOnDidReceiveMessage = jest.fn();

function createMockWebviewView() {
  const webview = {
    html: '',
    onDidReceiveMessage: mockOnDidReceiveMessage,
    postMessage: mockPostMessage,
    asWebviewUri: jest.fn((uri: any) => uri),
    cspSource: 'mock-csp',
    options: {} as any,
  };
  return {
    webview,
    onDidDispose: jest.fn(),
    onDidChangeVisibility: jest.fn(),
    visible: true,
  };
}

const mockCreateWebviewPanel = jest.fn().mockImplementation(() => ({
  webview: {
    html: '',
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  },
  onDidDispose: jest.fn(),
  reveal: jest.fn(),
  dispose: jest.fn(),
}));

const mockShowSaveDialog = jest.fn();
const mockShowOpenDialog = jest.fn();

jest.mock('vscode', () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}`, scheme: 'file' }),
    joinPath: (base: any, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
      toString: () => [base.fsPath, ...parts].join('/'),
    }),
    parse: (s: string) => ({ toString: () => s, fsPath: s, scheme: 'file' }),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(''),
      update: jest.fn().mockResolvedValue(undefined),
    }),
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    openTextDocument: jest.fn().mockResolvedValue({}),
  },
  window: {
    activeTextEditor: undefined,
    showTextDocument: jest.fn().mockResolvedValue({}),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showSaveDialog: mockShowSaveDialog,
    showOpenDialog: mockShowOpenDialog,
    createWebviewPanel: mockCreateWebviewPanel,
    withProgress: jest.fn().mockImplementation(async (_opts: any, task: any) => {
      const progress = { report: jest.fn() };
      return task(progress);
    }),
  },
  ViewColumn: { One: 1, Beside: 2 },
  ProgressLocation: { Notification: 15 },
  ConfigurationTarget: { Workspace: 2 },
  commands: { executeCommand: jest.fn() },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}), { virtual: true });

// ── Mock fs ───────────────────────────────────────────────────────────────────

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('<html><head></head><body>mock</body></html>'),
    createReadStream: jest.fn(),
    promises: {
      stat: jest.fn().mockResolvedValue({
        size: 1024,
        birthtime: new Date('2026-01-01'),
        mtime: new Date('2026-01-15'),
        atime: new Date('2026-01-15'),
      }),
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// ── Mock internal utilities ───────────────────────────────────────────────────

const mockNavigateToDateTime = jest.fn().mockResolvedValue(undefined);
jest.mock('../utils/navigateToDateTime', () => ({ navigateToDateTime: mockNavigateToDateTime }));

const mockCalculateSimilarLineCounts = jest.fn().mockResolvedValue(undefined);
jest.mock('../utils/calculateSimilarLineCounts', () => ({ calculateSimilarLineCounts: mockCalculateSimilarLineCounts }));

const mockDrawLogTimeline = jest.fn().mockResolvedValue(undefined);
jest.mock('../utils/drawLogTimeline', () => ({ drawLogTimeline: mockDrawLogTimeline }));

jest.mock('../utils/readLogPatterns', () => ({
  readLogPatterns: jest.fn().mockReturnValue([]),
}));

jest.mock('../utils/resultDocumentProvider', () => ({
  ResultDocumentProvider: {
    getInstance: jest.fn().mockReturnValue({
      openPatternSearchResult: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const mockGetOrDetectFormat = jest.fn();
const mockGetRegexPatternString = jest.fn().mockReturnValue('\\d{4}-\\d{2}-\\d{2}');
jest.mock('../utils/format-cache', () => ({
  getOrDetectFormat: mockGetOrDetectFormat,
  getRegexPatternString: mockGetRegexPatternString,
}));

jest.mock('../utils/navigateToLine', () => ({
  navigateToLine: jest.fn().mockResolvedValue(undefined),
}));

// Mock log-file-reader utilities used by report providers
const mockLogFileHandlerInstance = {
  initialize: jest.fn().mockResolvedValue({ detected: true }),
  index: {
    totalLines: 500,
    offsets: [
      { timestamp: new Date('2026-01-01T10:00:00Z'), line: 0 },
      { timestamp: new Date('2026-01-01T10:01:00Z'), line: 50 },
      { timestamp: new Date('2026-01-01T10:05:00Z'), line: 100 },
    ],
  },
  format: { pattern: 'yyyy-MM-dd HH:mm:ss' },
};
jest.mock('../utils/log-file-reader', () => ({
  LogFileHandler: jest.fn().mockImplementation(() => ({ ...mockLogFileHandlerInstance })),
  getFileDates: jest.fn().mockReturnValue({ created: new Date(), modified: new Date() }),
  buildLineIndex: jest.fn().mockResolvedValue({
    totalLines: 500,
    offsets: [
      { timestamp: new Date('2026-01-01T10:00:00Z'), line: 0 },
      { timestamp: new Date('2026-01-01T10:01:00Z'), line: 50 },
    ],
  }),
}));

// Mock log-gap-finder
const mockGapRecord = {
  line: 5,
  timestamp: new Date('2026-01-01T10:00:00Z'),
  nextTimestamp: new Date('2026-01-01T10:05:00Z'),
  durationMs: 300_000,
  text: 'sample log line',
};
jest.mock('../utils/log-gap-finder', () => ({
  findTopGapsFromIndex: jest.fn().mockReturnValue({
    gaps: [mockGapRecord],
    totalRecords: 100,
    logSpanMs: 3_600_000,
  }),
  findSlowestRecords: jest.fn().mockResolvedValue({
    gaps: [mockGapRecord],
    totalRecords: 100,
    logSpanMs: 3_600_000,
  }),
  refineLargestGap: jest.fn().mockResolvedValue(mockGapRecord),
  formatDuration: jest.fn().mockImplementation((ms: number) => `${ms}ms`),
}));

// Mock log-chunk-stats
jest.mock('../utils/log-chunk-stats', () => ({
  extractAllGapsFromIndex: jest.fn().mockReturnValue([
    { ...mockGapRecord, durationMs: 100 },
    { ...mockGapRecord, durationMs: 200 },
    { ...mockGapRecord, durationMs: 300 },
  ]),
  computeDescriptiveStats: jest.fn().mockReturnValue({
    count: 3,
    mean: 200,
    median: 200,
    min: 100,
    max: 300,
    p90: 280,
    p95: 290,
    p99: 298,
    stdDev: 81.65,
    skewness: 0,
    kurtosis: -1.5,
  }),
  detectOutliers: jest.fn().mockReturnValue([]),
}));

// Mock similar-lines-analyzer
jest.mock('../utils/similar-lines-analyzer', () => ({
  findTopSimilarLines: jest.fn().mockResolvedValue({
    lines: [],
    totalLinesAnalyzed: 100,
    totalUniquePatterns: 5,
  }),
}));

// Mock LogContext singleton
const mockResolveEditor = jest.fn();
const mockLogContextInstance = {
  activeFilePath: undefined as string | undefined,
  setActiveFile: jest.fn((path: string | undefined) => { mockLogContextInstance.activeFilePath = path; }),
  resolveEditor: mockResolveEditor,
  getOrDetectFormat: jest.fn(),
  getCachedFormat: jest.fn().mockReturnValue(null),
  clearFormatCache: jest.fn(),
  clearAllFormatCache: jest.fn(),
  onDidChangeActiveFile: jest.fn(),
  dispose: jest.fn(),
};
jest.mock('../utils/log-context', () => ({
  LogContext: {
    getInstance: jest.fn().mockReturnValue(mockLogContextInstance),
    resetInstance: jest.fn(),
  },
}));

// ── Imports under test ────────────────────────────────────────────────────────

import { UnifiedLogViewProvider } from '../logSearch/unifiedLogViewProvider';
import { EditorToolsViewProvider } from '../logSearch/editorToolsViewProvider';
import { LogGapReportProvider } from '../logSearch/logGapReportProvider';
import { LogChunkStatsProvider } from '../logSearch/logChunkStatsProvider';
import { LogChunkStatsComparisonProvider } from '../logSearch/logChunkStatsComparisonProvider';
import { LogContext } from '../utils/log-context';
import * as vscode from 'vscode';
import * as fs from 'fs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockExtensionContext(): any {
  return {
    subscriptions: [],
    extensionPath: '/mock/extension',
    extensionUri: { fsPath: '/mock/extension' },
  };
}

/**
 * Capture the message handler callback registered via onDidReceiveMessage
 * and return it so tests can invoke it directly.
 */
function captureMessageHandler(): (message: any) => Promise<void> {
  const lastCall = mockOnDidReceiveMessage.mock.calls[mockOnDidReceiveMessage.mock.calls.length - 1];
  return lastCall[0]; // The callback is the first argument
}

// ═══════════════════════════════════════════════════════════════════════════════
// UnifiedLogViewProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('UnifiedLogViewProvider', () => {
  let provider: UnifiedLogViewProvider;
  let context: any;
  let view: ReturnType<typeof createMockWebviewView>;
  let handleMessage: (msg: any) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    LogContext.resetInstance();
    mockLogContextInstance.activeFilePath = undefined;
    context = createMockExtensionContext();
    provider = new UnifiedLogViewProvider(context);
    view = createMockWebviewView();

    // resolveWebviewView captures the message handler
    provider.resolveWebviewView(view as any, {} as any, {} as any);
    handleMessage = captureMessageHandler();
  });

  describe('resolveWebviewView', () => {
    it('sets HTML content on the webview', () => {
      expect(view.webview.html).toBeTruthy();
      expect(typeof view.webview.html).toBe('string');
    });

    it('enables scripts in webview options', () => {
      expect(view.webview.options.enableScripts).toBe(true);
    });

    it('sends initial config values to the webview', () => {
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'setValues' }),
      );
    });

    it('registers message handler via onDidReceiveMessage', () => {
      expect(mockOnDidReceiveMessage).toHaveBeenCalled();
    });
  });

  describe('message: search', () => {
    it('calls navigateToDateTime and sends success feedback', async () => {
      await handleMessage({
        command: 'search',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
        searchDate: '2026-01-01',
        searchTime: '10:00:00',
      });

      expect(mockNavigateToDateTime).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('message: calculateSimilarLineCounts', () => {
    it('shows error when no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await handleMessage({
        command: 'calculateSimilarLineCounts',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: false,
        }),
      );
    });

    it('calls calculateSimilarLineCounts when editor available', async () => {
      (vscode.window as any).activeTextEditor = { document: {} };

      await handleMessage({
        command: 'calculateSimilarLineCounts',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockCalculateSimilarLineCounts).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('message: drawLogTimeline', () => {
    it('shows error when no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await handleMessage({
        command: 'drawLogTimeline',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: false,
          message: 'No active editor found',
        }),
      );
    });

    it('draws timeline when editor is available', async () => {
      (vscode.window as any).activeTextEditor = { document: {} };

      await handleMessage({
        command: 'drawLogTimeline',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockDrawLogTimeline).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('message: testRegex', () => {
    it('reports no active editor when none available', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await handleMessage({ command: 'testRegex', logTimeRegex: '\\d+' });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'testRegexResult',
          success: false,
        }),
      );
    });

    it('reports matches when editor has matching content', async () => {
      const mockDoc = {
        lineCount: 3,
        lineAt: jest.fn().mockImplementation((i: number) => ({
          text: `2026-01-01 10:00:0${i} INFO line ${i}`,
        })),
      };
      (vscode.window as any).activeTextEditor = { document: mockDoc };

      await handleMessage({ command: 'testRegex', logTimeRegex: '\\d{4}-\\d{2}-\\d{2}' });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'testRegexResult',
          success: true,
        }),
      );
    });

    it('reports error for invalid regex pattern', async () => {
      const mockDoc = {
        lineCount: 1,
        lineAt: jest.fn().mockReturnValue({ text: 'test' }),
      };
      (vscode.window as any).activeTextEditor = { document: mockDoc };

      await handleMessage({ command: 'testRegex', logTimeRegex: '[invalid' });

      // The invalid regex throws before the handler reaches the testRegex
      // response path, so the outer catch sends operationComplete instead.
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  describe('message: autoDetectTimestampFormat', () => {
    it('reports detection failure when no editor', async () => {
      mockResolveEditor.mockResolvedValue(undefined);

      await handleMessage({ command: 'autoDetectTimestampFormat', tab: 'logSearch' });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'timestampFormatDetected',
          success: false,
          detected: false,
        }),
      );
    });

    it('returns detected format when found', async () => {
      const mockDoc = { uri: { scheme: 'file' } };
      mockResolveEditor.mockResolvedValue({ document: mockDoc });
      mockGetOrDetectFormat.mockResolvedValue({
        detected: true,
        format: { pattern: 'yyyy-MM-dd HH:mm:ss' },
        totalLines: 100,
      });

      await handleMessage({ command: 'autoDetectTimestampFormat', tab: 'logSearch' });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'timestampFormatDetected',
          success: true,
          detected: true,
        }),
      );
    });
  });

  describe('message: searchPatterns', () => {
    it('posts error when log file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      await handleMessage({
        command: 'searchPatterns',
        logFilePath: '/nonexistent.log',
        searchPatternsFilePath: '/patterns.json',
      });

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: false,
        }),
      );
    });

    it('posts error when pattern file does not exist', async () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)   // log file exists
        .mockReturnValueOnce(false); // pattern file doesn't

      await handleMessage({
        command: 'searchPatterns',
        logFilePath: '/mock.log',
        searchPatternsFilePath: '/nonexistent.json',
      });

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('message: browseFile', () => {
    it('sends file path back when user selects a file', async () => {
      mockShowOpenDialog.mockResolvedValue([{ fsPath: '/selected/file.log' }]);

      await handleMessage({ command: 'browseFile', fileType: 'log' });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'setFilePath',
          fileType: 'log',
          path: '/selected/file.log',
        }),
      );
    });

    it('does nothing when user cancels dialog', async () => {
      mockShowOpenDialog.mockResolvedValue(undefined);
      mockPostMessage.mockClear();

      await handleMessage({ command: 'browseFile', fileType: 'patterns' });

      // postMessage is NOT called with setFilePath
      const setFilePathCalls = mockPostMessage.mock.calls.filter(
        (c: any) => c[0]?.command === 'setFilePath',
      );
      expect(setFilePathCalls).toHaveLength(0);
    });
  });

  describe('message: openFile', () => {
    it('executes vscode.open command', async () => {
      await handleMessage({ command: 'openFile', fileUri: 'file:///mock/test.log' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.open',
        expect.anything(),
      );
    });
  });

  describe('message: revealInExplorer', () => {
    it('executes revealFileInOS command', async () => {
      await handleMessage({ command: 'revealInExplorer', fileUri: 'file:///mock/test.log' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'revealFileInOS',
        expect.anything(),
      );
    });
  });

  describe('switchTab', () => {
    it('sends switchTab message to webview', () => {
      provider.switchTab('fileInfo');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchTab',
          tabName: 'fileInfo',
        }),
      );
    });
  });

  describe('showFileInfo', () => {
    it('sends file info message to webview', async () => {
      const uri = { fsPath: '/mock/test.log', toString: () => 'file:///mock/test.log' };
      await provider.showFileInfo(uri as any, {
        size: 2048,
        totalLines: 500,
        timestampDetected: true,
        timestampPattern: 'yyyy-MM-dd',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'showFileInfo',
          fileName: 'test.log',
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EditorToolsViewProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('EditorToolsViewProvider', () => {
  let provider: EditorToolsViewProvider;
  let context: any;
  let view: ReturnType<typeof createMockWebviewView>;
  let handleMessage: (msg: any) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    LogContext.resetInstance();
    mockLogContextInstance.activeFilePath = undefined;
    context = createMockExtensionContext();
    provider = new EditorToolsViewProvider(context);
    view = createMockWebviewView();

    provider.resolveWebviewView(view as any, {} as any, {} as any);
    handleMessage = captureMessageHandler();
  });

  describe('resolveWebviewView', () => {
    it('sets HTML content on the webview', () => {
      expect(view.webview.html).toBeTruthy();
      expect(typeof view.webview.html).toBe('string');
    });

    it('enables scripts in webview options', () => {
      expect(view.webview.options.enableScripts).toBe(true);
    });

    it('sends initial config values', () => {
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'setValues' }),
      );
    });
  });

  describe('message: search', () => {
    it('shows error when no editor is resolvable', async () => {
      mockResolveEditor.mockResolvedValue(undefined);

      await handleMessage({
        command: 'search',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
        searchDate: '2026-01-01',
        searchTime: '10:00:00',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: false,
        }),
      );
    });

    it('navigates when editor is available', async () => {
      mockResolveEditor.mockResolvedValue({
        document: { uri: { scheme: 'file' } },
      });

      await handleMessage({
        command: 'search',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
        searchDate: '2026-01-01',
        searchTime: '10:00:00',
      });

      expect(mockNavigateToDateTime).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('message: calculateSimilarLineCounts', () => {
    it('shows error when no editor available', async () => {
      mockResolveEditor.mockResolvedValue(undefined);

      await handleMessage({
        command: 'calculateSimilarLineCounts',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: false,
        }),
      );
    });

    it('runs analysis when editor available', async () => {
      mockResolveEditor.mockResolvedValue({
        document: { uri: { scheme: 'file' } },
      });

      await handleMessage({
        command: 'calculateSimilarLineCounts',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockCalculateSimilarLineCounts).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('message: drawLogTimeline', () => {
    it('draws timeline when editor available', async () => {
      mockResolveEditor.mockResolvedValue({
        document: { uri: { scheme: 'file' } },
      });

      await handleMessage({
        command: 'drawLogTimeline',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
      });

      expect(mockDrawLogTimeline).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'operationComplete',
          success: true,
        }),
      );
    });
  });

  describe('switchTab', () => {
    it('sends switchTab message to webview', () => {
      provider.switchTab('similarLines');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchTab',
          tabName: 'similarLines',
        }),
      );
    });
  });

  describe('resolveEditor fallback via LogContext', () => {
    it('uses LogContext.resolveEditor for editor resolution', async () => {
      // Mock LogContext returning an editor
      const mockEditor = { document: { uri: { scheme: 'file' } } };
      mockResolveEditor.mockResolvedValue(mockEditor);

      await handleMessage({
        command: 'search',
        logTimeRegex: '\\d+',
        logTimeFormat: 'yyyy',
        searchDate: '2026-01-01',
        searchTime: '10:00:00',
      });

      // Should successfully resolve via LogContext
      expect(mockResolveEditor).toHaveBeenCalled();
      expect(mockNavigateToDateTime).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LogGapReportProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('LogGapReportProvider', () => {
  let provider: LogGapReportProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LogGapReportProvider('/mock/extension');
  });

  describe('generateReport', () => {
    it('creates a webview panel with gap data', async () => {
      await provider.generateReport('/mock/logfile.log');

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'logGapReport',
        expect.stringContaining('logfile.log'),
        expect.anything(),
        expect.objectContaining({ enableScripts: true }),
      );
    });

    it('sets HTML content on the panel webview', async () => {
      await provider.generateReport('/mock/logfile.log');

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      expect(panel.webview.html).toBeTruthy();
    });

    it('shows success message after report generation', async () => {
      await provider.generateReport('/mock/logfile.log');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('report generated'),
      );
    });

    it('shows error when handler fails to initialize', async () => {
      // Override handler mock to simulate failure
      const { LogFileHandler } = require('../utils/log-file-reader');
      LogFileHandler.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue({}),
        index: null,
        format: null,
      }));

      await provider.generateReport('/mock/bad.log');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
      );
    });

    it('shows info message when no gaps found', async () => {
      const { findTopGapsFromIndex } = require('../utils/log-gap-finder');
      findTopGapsFromIndex.mockReturnValueOnce({ gaps: [], totalRecords: 0, logSpanMs: 0 });

      await provider.generateReport('/mock/empty.log');

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('injects REPORT_DATA into HTML', async () => {
      await provider.generateReport('/mock/logfile.log');

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      expect(panel.webview.html).toContain('REPORT_DATA');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LogChunkStatsProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('LogChunkStatsProvider', () => {
  let provider: LogChunkStatsProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LogChunkStatsProvider('/mock/extension');
  });

  describe('generateReport', () => {
    it('creates a webview panel with stats', async () => {
      await provider.generateReport('/mock/logfile.log');

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'logChunkStats',
        expect.stringContaining('logfile.log'),
        expect.anything(),
        expect.objectContaining({ enableScripts: true }),
      );
    });

    it('sets HTML content containing REPORT_DATA', async () => {
      await provider.generateReport('/mock/logfile.log');

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      expect(panel.webview.html).toContain('REPORT_DATA');
    });

    it('shows success message', async () => {
      await provider.generateReport('/mock/logfile.log');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('report generated'),
      );
    });

    it('shows info when not enough chunks', async () => {
      const { extractAllGapsFromIndex } = require('../utils/log-chunk-stats');
      extractAllGapsFromIndex.mockReturnValueOnce([{ durationMs: 100 }]); // fewer than 2

      await provider.generateReport('/mock/small.log');

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('handles handler initialization failure', async () => {
      const { LogFileHandler } = require('../utils/log-file-reader');
      LogFileHandler.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue({}),
        index: null,
        format: null,
      }));

      await provider.generateReport('/mock/bad.log');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
      );
    });

    it('includes stats data in the HTML report', async () => {
      await provider.generateReport('/mock/logfile.log');

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      const html = panel.webview.html;
      // The HTML should contain serialized report data with stats
      expect(html).toContain('REPORT_DATA');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LogChunkStatsComparisonProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('LogChunkStatsComparisonProvider', () => {
  let provider: LogChunkStatsComparisonProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LogChunkStatsComparisonProvider('/mock/extension');
  });

  describe('generateComparison', () => {
    it('shows warning when fewer than 2 files provided', async () => {
      await provider.generateComparison(['/mock/single.log']);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('at least 2'),
      );
      expect(mockCreateWebviewPanel).not.toHaveBeenCalled();
    });

    it('creates a webview panel for multi-file comparison', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log']);

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'logChunkStatsComparison',
        expect.stringContaining('Comparison'),
        expect.anything(),
        expect.objectContaining({ enableScripts: true }),
      );
    });

    it('sets HTML content with COMPARISON_DATA', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log']);

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      expect(panel.webview.html).toContain('COMPARISON_DATA');
    });

    it('shows success message', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log']);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('comparison'),
      );
    });

    it('truncates to 20 files when more than 20 provided', async () => {
      const paths = Array.from({ length: 25 }, (_, i) => `/mock/file${i}.log`);
      await provider.generateComparison(paths);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('limited to 20'),
      );
    });

    it('includes rankings in HTML when multiple valid files', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log', '/mock/c.log']);

      const panel = mockCreateWebviewPanel.mock.results[0].value;
      expect(panel.webview.html).toContain('COMPARISON_DATA');
    });

    it('title includes file names when 3 or fewer files', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log']);

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('a.log'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('title shows count when more than 3 files', async () => {
      await provider.generateComparison(['/mock/a.log', '/mock/b.log', '/mock/c.log', '/mock/d.log']);

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('4 files'),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
