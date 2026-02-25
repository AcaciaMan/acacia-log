/**
 * Benchmarks for extension activation timing.
 * These tests measure and report activation time but don't fail
 * unless activation exceeds a generous threshold.
 * 
 * The benchmarks use real timers (performance.now) to measure actual
 * wall-clock time, while still mocking vscode and internal modules.
 */

import { performance } from 'perf_hooks';

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
}), { virtual: true });

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
jest.mock('luxon', () => ({
    DateTime: { fromFormat: jest.fn(), fromISO: jest.fn(), now: jest.fn() },
}));

// ── Import under test ─────────────────────────────────────────────────────────

import { activate } from '../extension';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockContext(): any {
    mockSubscriptions.length = 0;
    return {
        subscriptions: mockSubscriptions,
        extensionPath: '/mock/extension/path',
        extensionUri: { fsPath: '/mock/extension/path' },
    };
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

describe('Activation Benchmark', () => {
    let context: any;

    beforeEach(() => {
        jest.clearAllMocks();
        context = createMockContext();
    });

    afterEach(async () => {
        // Wait for Phase 2 setTimeout(0) callbacks to complete
        // before Jest tears down the environment
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('activate() completes within 100ms', async () => {
        const start = performance.now();
        await activate(context);
        const elapsed = performance.now() - start;

        console.log(`[Benchmark] activate() took ${elapsed.toFixed(1)}ms`);

        // Generous threshold — mainly to catch catastrophic regressions
        expect(elapsed).toBeLessThan(100);
    });

    it('activate() synchronous phase completes within 20ms', async () => {
        const start = performance.now();
        // activate() should return quickly; deferred work happens in setTimeout
        const activatePromise = activate(context);
        const syncElapsed = performance.now() - start;

        console.log(`[Benchmark] sync phase took ${syncElapsed.toFixed(1)}ms`);

        // Phase 1 (synchronous registration) should be very fast
        expect(syncElapsed).toBeLessThan(20);

        // Wait for the promise to resolve
        await activatePromise;
    });

    it('multiple consecutive activations are consistently fast', async () => {
        const timings: number[] = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
            jest.clearAllMocks();
            const ctx = createMockContext();

            const start = performance.now();
            await activate(ctx);
            const elapsed = performance.now() - start;
            timings.push(elapsed);
        }

        const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
        const max = Math.max(...timings);
        const min = Math.min(...timings);

        console.log(`[Benchmark] ${iterations} activations:`);
        console.log(`  avg: ${avg.toFixed(1)}ms, min: ${min.toFixed(1)}ms, max: ${max.toFixed(1)}ms`);
        console.log(`  individual: ${timings.map(t => t.toFixed(1) + 'ms').join(', ')}`);

        // Average should stay well under threshold
        expect(avg).toBeLessThan(100);
        // No single run should be extremely slow
        expect(max).toBeLessThan(200);
    });

    it('registration count matches expected (no accidental extras)', async () => {
        await activate(context);

        const commandCount = mockRegisterCommand.mock.calls.length;
        const webviewProviderCount = mockRegisterWebviewViewProvider.mock.calls.length;
        const contentProviderCount = mockRegisterTextDocumentContentProvider.mock.calls.length;
        const treeViewCount = mockCreateTreeView.mock.calls.length;

        console.log(`[Benchmark] Registration counts:`);
        console.log(`  commands: ${commandCount}`);
        console.log(`  webview providers: ${webviewProviderCount}`);
        console.log(`  content providers: ${contentProviderCount}`);
        console.log(`  tree views: ${treeViewCount}`);
        console.log(`  subscriptions: ${context.subscriptions.length}`);

        // These counts should remain stable. Update if commands are added/removed.
        expect(commandCount).toBe(32);
        expect(webviewProviderCount).toBe(2);
        expect(contentProviderCount).toBe(1);
        expect(treeViewCount).toBe(1);
    });
});
