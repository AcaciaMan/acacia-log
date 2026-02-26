/**
 * Unit tests for the acacia-log.manageLenses command registered in extension.ts
 */

// ── Mock setup (before any imports) ──────────────────────────────────────────

const mockSetLensVisible = jest.fn();
const mockGetLensVisible = jest.fn((_key: string) => true); // default: all visible
const mockRefresh = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('../logSearch/logLensDecorationProvider', () => ({
    LogLensDecorationProvider: jest.fn().mockImplementation(() => ({
        activate: jest.fn(),
        dispose: jest.fn(),
        toggle: jest.fn(),
        setLensVisible: mockSetLensVisible,
        getLensVisible: mockGetLensVisible,
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATTERNS = [
    {
        key: 'error',
        lensEnabled: true,
        lensCategory: 'stack',
        lensLabel: 'Error',
        regexp: 'error',
        regexpoptions: 'i',
        lensColor: '#ff0000',
        lensPriority: 10,
        lensShowInStatusBar: true,
        bSearch: true,
    },
    {
        key: 'warn',
        lensEnabled: true,
        lensCategory: 'stack',
        lensLabel: 'Warn',
        regexp: 'warn',
        regexpoptions: 'i',
        lensColor: '#ffaa00',
        lensPriority: 20,
        lensShowInStatusBar: true,
        bSearch: true,
    },
    {
        key: 'disabled',
        lensEnabled: false,
        lensCategory: 'stack',
        lensLabel: 'Disabled',
        regexp: 'disabled',
        regexpoptions: '',
        lensColor: '#888888',
        lensPriority: 99,
        lensShowInStatusBar: false,
        bSearch: false,
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeContext() {
    return {
        subscriptions: { push: jest.fn() },
        extensionPath: '/fake/extension',
        workspaceFolders: [{ uri: { fsPath: '/mock' } }],
    } as unknown as vscode.ExtensionContext;
}

/**
 * Activate the extension and return the handler for the manageLenses command.
 */
async function getManageLensesHandler(): Promise<() => Promise<void>> {
    const registerSpy = vscode.commands.registerCommand as jest.Mock;
    registerSpy.mockClear();

    await activate(makeFakeContext());

    const call = registerSpy.mock.calls.find(([cmd]: [string]) => cmd === 'acacia-log.manageLenses');
    if (!call) { throw new Error('manageLenses command not registered'); }
    return call[1] as () => Promise<void>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('acacia-log.manageLenses command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReadLogPatterns.mockReturnValue(PATTERNS);
        mockGetLensVisible.mockReturnValue(true); // reset to default: all visible
        mockGetConfig.mockImplementation((key: string, defaultVal?: unknown) => {
            if (key === 'lensVisibility') { return defaultVal ?? {}; }
            return defaultVal;
        });
        // Default: showQuickPick returns undefined (cancelled)
        mockShowQuickPick.mockResolvedValue(undefined);
    });

    // ── Test 1 ────────────────────────────────────────────────────────────────
    it('shows QuickPick with enabled patterns only', async () => {
        mockGetLensVisible.mockReturnValue(true);
        mockShowQuickPick.mockResolvedValue([]);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockShowQuickPick).toHaveBeenCalledTimes(1);
        const [items, opts] = mockShowQuickPick.mock.calls[0] as [unknown[], Record<string, unknown>];
        expect(items).toHaveLength(2);
        expect((items as any[]).every((i: any) => i.key !== 'disabled')).toBe(true);
        expect((items as any[]).every((i: any) => typeof i.picked === 'boolean')).toBe(true);
        expect(opts.canPickMany).toBe(true);
    });

    // ── Test 2 ────────────────────────────────────────────────────────────────
    it('Escape (showQuickPick returns undefined) does nothing', async () => {
        mockShowQuickPick.mockResolvedValue(undefined);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockSetLensVisible).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    // ── Test 3 ────────────────────────────────────────────────────────────────
    it('confirming with same state as current calls no setLensVisible but still persists and refreshes', async () => {
        mockGetLensVisible.mockReturnValue(true);
        // Return both enabled items as chosen (same visible state)
        mockShowQuickPick.mockResolvedValue([
            { key: 'error', label: '$(circle-filled) Error', picked: true },
            { key: 'warn',  label: '$(circle-filled) Warn',  picked: true },
        ]);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockSetLensVisible).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    // ── Test 4 ────────────────────────────────────────────────────────────────
    it('hiding one lens calls setLensVisible(false) for that key only', async () => {
        // Wire getLensVisible / setLensVisible to share mutable state so the
        // persistence step (step 6) sees the post-change values.
        const visibilityState: Record<string, boolean> = { error: true, warn: true };
        mockGetLensVisible.mockImplementation((key: string) => visibilityState[key] ?? true);
        mockSetLensVisible.mockImplementation((key: string, value: boolean) => { visibilityState[key] = value; });

        // Only warn chosen — error is unchecked
        mockShowQuickPick.mockResolvedValue([
            { key: 'warn', label: '$(circle-filled) Warn', picked: true },
        ]);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockSetLensVisible).toHaveBeenCalledWith('error', false);
        expect(mockSetLensVisible).not.toHaveBeenCalledWith('warn', expect.anything());

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const visibilityArg = mockUpdate.mock.calls[0][1] as Record<string, boolean>;
        expect(visibilityArg).toMatchObject({ error: false, warn: true });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    // ── Test 5 ────────────────────────────────────────────────────────────────
    it('showing a hidden lens calls setLensVisible(true) for that key only', async () => {
        mockGetLensVisible.mockImplementation((key: string) => key !== 'error'); // error is hidden
        // User selects both
        mockShowQuickPick.mockResolvedValue([
            { key: 'error', label: '$(circle-filled) Error', picked: false },
            { key: 'warn',  label: '$(circle-filled) Warn',  picked: true },
        ]);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockSetLensVisible).toHaveBeenCalledWith('error', true);
        expect(mockSetLensVisible).not.toHaveBeenCalledWith('warn', expect.anything());
    });

    // ── Test 6 ────────────────────────────────────────────────────────────────
    it('calls configuration.update with ConfigurationTarget.Workspace', async () => {
        mockGetLensVisible.mockReturnValue(true);
        mockShowQuickPick.mockResolvedValue([
            { key: 'error', label: '$(circle-filled) Error', picked: true },
        ]);

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const target = mockUpdate.mock.calls[0][2];
        expect(target).toBe(vscode.ConfigurationTarget.Workspace);
    });

    // ── Test 7 ────────────────────────────────────────────────────────────────
    it('readLogPatterns throws → showErrorMessage shown, no QuickPick', async () => {
        mockReadLogPatterns.mockImplementation(() => { throw new Error('file not found'); });

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockShowQuickPick).not.toHaveBeenCalled();
        expect(mockShowErrorMessage).toHaveBeenCalledTimes(1);
        expect(mockSetLensVisible).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    // ── Test 8 ────────────────────────────────────────────────────────────────
    it('no enabled patterns → showInformationMessage shown, no QuickPick', async () => {
        mockReadLogPatterns.mockReturnValue([PATTERNS[2]]); // only 'disabled' pattern

        const handler = await getManageLensesHandler();
        await handler();

        expect(mockShowQuickPick).not.toHaveBeenCalled();
        expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    });

    // ── Test 9 ────────────────────────────────────────────────────────────────
    it('visibility restore on activation reads acacia-log.lensVisibility and replays it', async () => {
        jest.useFakeTimers();

        mockGetConfig.mockImplementation((key: string, defaultVal?: unknown) => {
            if (key === 'lensVisibility') { return { error: false, warn: true }; }
            return defaultVal;
        });

        const registerSpy = vscode.commands.registerCommand as jest.Mock;
        registerSpy.mockClear();
        mockSetLensVisible.mockClear();

        await activate(makeFakeContext());

        // Flush the Phase 2 setTimeout
        await jest.runAllTimersAsync();

        expect(mockSetLensVisible).toHaveBeenCalledWith('error', false);
        expect(mockSetLensVisible).toHaveBeenCalledWith('warn', true);

        jest.useRealTimers();
    });
});
