/**
 * Unit tests for wiring gaps fixed in Step 7a:
 * 1. toggleLensDecorations calls lensStatusBar.refresh() after toggle()
 * 2. onDidChangeConfiguration syncs acacia-log.lensVisibility → decoration provider
 * 3. Phase 2 visibility restore on activation
 */

// ── Mock setup (before any imports) ──────────────────────────────────────────

const mockToggle = jest.fn();
const mockGetLensVisible = jest.fn((_key: string) => true);
const mockSetLensVisible = jest.fn();
const mockRefresh = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('../logSearch/logLensDecorationProvider', () => ({
    LogLensDecorationProvider: jest.fn().mockImplementation(() => ({
        activate: jest.fn(),
        dispose: jest.fn(),
        toggle: mockToggle,
        getLensVisible: mockGetLensVisible,
        setLensVisible: mockSetLensVisible,
        onDidUpdateCounts: { event: jest.fn() },
    })),
}));

jest.mock('../logSearch/lensStatusBar', () => ({
    LensStatusBar: jest.fn().mockImplementation(() => ({
        activate: jest.fn(),
        dispose: jest.fn(),
        refresh: mockRefresh,
    })),
}));

const mockReadLogPatterns = jest.fn();
jest.mock('../utils/readLogPatterns', () => ({
    readLogPatterns: (...args: unknown[]) => mockReadLogPatterns(...args),
}));

jest.mock('../utils/createLogPatterns', () => ({
    createLogPatterns: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/navigateToDateTime', () => ({ navigateToDateTime: jest.fn() }));
jest.mock('../utils/calculateSimilarLineCounts', () => ({ calculateSimilarLineCounts: jest.fn() }));
jest.mock('../utils/drawLogTimeline', () => ({ drawLogTimeline: jest.fn() }));
jest.mock('../utils/log-to-jsonl-command', () => ({ convertToJsonl: jest.fn() }));
jest.mock('../utils/jsonl-to-log', () => ({ convertJsonlToLog: jest.fn() }));
jest.mock('../utils/log-file-reader', () => ({ readLineRange: jest.fn() }));
jest.mock('../utils/log-context', () => ({
    LogContext: {
        getInstance: jest.fn().mockReturnValue({
            activeFilePath: undefined,
            setActiveFile: jest.fn(),
            resolveEditor: jest.fn(),
            getOrDetectFormat: jest.fn(),
            getCachedFormat: jest.fn(),
            clearFormatCache: jest.fn(),
            clearAllFormatCache: jest.fn(),
            onDidChangeActiveFile: jest.fn(),
            dispose: jest.fn(),
        }),
        resetInstance: jest.fn(),
    },
}));
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
jest.mock('../logSearch/logManagerViewProvider', () => {
    const ctor = jest.fn().mockImplementation(() => ({}));
    (ctor as any).viewType = 'acacia-log.logManager';
    return { LogManagerViewProvider: ctor };
});
jest.mock('../logSearch/logManagerPanelProvider', () => {
    const ctor = jest.fn().mockImplementation(() => ({
        openPanel: jest.fn(),
        dispose: jest.fn(),
    }));
    return { LogManagerPanelProvider: ctor };
});
jest.mock('../logSearch/logGapReportProvider', () => ({
    LogGapReportProvider: jest.fn().mockImplementation(() => ({ generateReport: jest.fn() })),
}));
jest.mock('../logSearch/logChunkStatsProvider', () => ({
    LogChunkStatsProvider: jest.fn().mockImplementation(() => ({ generateReport: jest.fn() })),
}));
jest.mock('../logSearch/logChunkStatsComparisonProvider', () => ({
    LogChunkStatsComparisonProvider: jest.fn().mockImplementation(() => ({ generateComparison: jest.fn() })),
}));
jest.mock('luxon', () => ({
    DateTime: { fromFormat: jest.fn(), fromISO: jest.fn(), now: jest.fn() },
}));

// ── vscode mock ───────────────────────────────────────────────────────────────

const mockShowQuickPick = jest.fn();
const mockShowErrorMessage = jest.fn();
const mockShowInformationMessage = jest.fn();
const mockGetConfig = jest.fn();

jest.mock('vscode', () => ({
    commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn(),
    },
    window: {
        registerWebviewViewProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        createTreeView: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            onDidChangeSelection: jest.fn(),
            selection: [],
        }),
        onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidChangeVisibleTextEditors: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidChangeTextEditorVisibleRanges: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        activeTextEditor: undefined,
        visibleTextEditors: [],
        showInputBox: jest.fn(),
        showInformationMessage: mockShowInformationMessage,
        showWarningMessage: jest.fn(),
        showErrorMessage: mockShowErrorMessage,
        showQuickPick: mockShowQuickPick,
    },
    workspace: {
        registerTextDocumentContentProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        getConfiguration: jest.fn().mockImplementation(() => ({
            get: mockGetConfig,
            update: mockUpdate,
        })),
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
    TreeItem: class { constructor(public label: string) {} },
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
    StatusBarAlignment: { Left: 1, Right: 2 },
}), { virtual: true });

// ── Import extension after mocks ──────────────────────────────────────────────

import * as vscode from 'vscode';
import { activate } from '../extension';

// ── Test state ────────────────────────────────────────────────────────────────

let fakeContext: any;
let toggleLensDecorationsHandler: () => void;
let onConfigChangedHandler: (event: { affectsConfiguration: (s: string) => boolean }) => void;

beforeEach(async () => {
    jest.clearAllMocks();
    mockReadLogPatterns.mockReturnValue([]);
    mockGetConfig.mockReturnValue('');

    fakeContext = {
        subscriptions: { push: jest.fn() },
        extensionPath: '/fake',
        extensionUri: { fsPath: '/fake' },
    };

    const registerSpy = jest.spyOn(vscode.commands, 'registerCommand');
    const onConfigSpy = jest.spyOn(vscode.workspace, 'onDidChangeConfiguration');

    await activate(fakeContext as any);

    // Capture toggleLensDecorations handler
    const tldCall = registerSpy.mock.calls.find(([cmd]) => cmd === 'acacia-log.toggleLensDecorations');
    toggleLensDecorationsHandler = tldCall![1] as () => void;

    // Capture all onDidChangeConfiguration handlers
    const configHandlers = onConfigSpy.mock.calls.map(([handler]) => handler as any);
    (global as any).__configHandlers = configHandlers;

    // Invoke all handlers so both extension.ts and lensStatusBar handlers are exercised
    onConfigChangedHandler = (event) => {
        for (const h of configHandlers) { h(event); }
    };
});

// ── Suite A — toggleLensDecorations calls lensStatusBar.refresh ───────────────

describe('Suite A — toggleLensDecorations calls lensStatusBar.refresh', () => {
    test('Test 1 — refresh is called once per toggle invocation', () => {
        toggleLensDecorationsHandler();
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    test('Test 2 — toggle() is called before refresh()', () => {
        const callOrder: string[] = [];
        mockToggle.mockImplementation(() => callOrder.push('toggle'));
        mockRefresh.mockImplementation(() => callOrder.push('refresh'));

        toggleLensDecorationsHandler();

        expect(callOrder).toEqual(['toggle', 'refresh']);
    });

    test('Test 3 — multiple invocations each call both toggle and refresh', () => {
        toggleLensDecorationsHandler();
        toggleLensDecorationsHandler();

        expect(mockToggle).toHaveBeenCalledTimes(2);
        expect(mockRefresh).toHaveBeenCalledTimes(2);
    });
});

// ── Suite B — onDidChangeConfiguration syncs lensVisibility → decoration provider

describe('Suite B — onDidChangeConfiguration syncs lensVisibility → decoration provider', () => {
    test('Test 4 — setLensVisible called for each key when affectsConfiguration is true', () => {
        mockGetConfig.mockImplementation((key: string, def?: unknown) => {
            if (key === 'lensVisibility') {
                return { error: false, warn: true, info: true };
            }
            return def ?? '';
        });

        onConfigChangedHandler({
            affectsConfiguration: (s: string) => s === 'acacia-log.lensVisibility',
        });

        expect(mockSetLensVisible).toHaveBeenCalledWith('error', false);
        expect(mockSetLensVisible).toHaveBeenCalledWith('warn', true);
        expect(mockSetLensVisible).toHaveBeenCalledWith('info', true);
    });

    test('Test 5 — refresh called once after syncing visibility', () => {
        mockGetConfig.mockImplementation((key: string, def?: unknown) => {
            if (key === 'lensVisibility') { return { error: false }; }
            return def ?? '';
        });

        onConfigChangedHandler({
            affectsConfiguration: (s: string) => s === 'acacia-log.lensVisibility',
        });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    test('Test 6 — setLensVisible NOT called when affectsConfiguration returns false', () => {
        onConfigChangedHandler({
            affectsConfiguration: (_s: string) => false,
        });

        expect(mockSetLensVisible).not.toHaveBeenCalled();
    });

    test('Test 7 — refresh NOT called when affectsConfiguration returns false', () => {
        onConfigChangedHandler({
            affectsConfiguration: (_s: string) => false,
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });

    test('Test 8 — empty lensVisibility object calls setLensVisible zero times, but still calls refresh', () => {
        mockGetConfig.mockImplementation((key: string, def?: unknown) => {
            if (key === 'lensVisibility') { return {}; }
            return def ?? '';
        });

        onConfigChangedHandler({
            affectsConfiguration: (s: string) => s === 'acacia-log.lensVisibility',
        });

        expect(mockSetLensVisible).not.toHaveBeenCalled();
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    test('Test 9 — handles null/undefined lensVisibility gracefully (no crash)', () => {
        mockGetConfig.mockImplementation((key: string, def?: unknown) => {
            if (key === 'lensVisibility') { return null; }
            return def ?? '';
        });

        // Must not throw
        expect(() => onConfigChangedHandler({
            affectsConfiguration: (s: string) => s === 'acacia-log.lensVisibility',
        })).not.toThrow();
    });
});

// ── Suite C — Phase 2 visibility restore on activation ───────────────────────

describe('Suite C — Phase 2 visibility restore on activation', () => {
    afterEach(() => {
        jest.useRealTimers();
        (vscode.window as any).visibleTextEditors = [];
    });

    test('Test 10 — setLensVisible called for each persisted key after Phase 2 fires', async () => {
        jest.useFakeTimers();

        mockGetConfig.mockImplementation((key: string, def?: unknown) => {
            if (key === 'lensVisibility') { return { error: false, warn: true }; }
            return def ?? '';
        });

        // Re-activate after setting up fake timers
        const ctx = {
            subscriptions: { push: jest.fn() },
            extensionPath: '/fake',
            extensionUri: { fsPath: '/fake' },
        };
        await activate(ctx as any);

        // Phase 2 setTimeout has not fired yet — clear calls from beforeEach activation
        mockSetLensVisible.mockClear();

        jest.runAllTimers();
        await Promise.resolve(); // flush microtasks

        // After Phase 2 fires, restore block should have run
        expect(mockSetLensVisible).toHaveBeenCalledWith('error', false);
        expect(mockSetLensVisible).toHaveBeenCalledWith('warn', true);
    });

    test('Test 11 — activate() is called on logLensDecorationProvider during Phase 2 (when visibleTextEditors is non-empty)', async () => {
        jest.useFakeTimers();

        const mockActivate = jest.fn();
        // Override the mock to capture activate
        require('../logSearch/logLensDecorationProvider').LogLensDecorationProvider
            .mockImplementation(() => ({
                activate: mockActivate,
                dispose: jest.fn(),
                toggle: jest.fn(),
                getLensVisible: jest.fn(() => true),
                setLensVisible: jest.fn(),
                onDidUpdateCounts: { event: jest.fn() },
            }));

        // Set visibleTextEditors to non-empty
        (vscode.window as any).visibleTextEditors = [{}];

        const ctx = {
            subscriptions: { push: jest.fn() },
            extensionPath: '/fake',
            extensionUri: { fsPath: '/fake' },
        };
        await activate(ctx as any);

        expect(mockActivate).not.toHaveBeenCalled(); // not yet

        jest.runAllTimers();
        await Promise.resolve();

        expect(mockActivate).toHaveBeenCalledTimes(1);
    });
});
