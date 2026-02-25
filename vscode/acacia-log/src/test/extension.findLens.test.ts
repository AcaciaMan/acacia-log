/**
 * Unit tests for the acacia-log.findLens command registered in extension.ts
 */

// ── Mock setup (before any imports) ──────────────────────────────────────────

const mockSetLensVisible = jest.fn();
const mockGetLensVisible = jest.fn((_key: string) => true);
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
jest.mock('../logSearch/unifiedLogViewProvider', () => {
    const ctor = jest.fn().mockImplementation(() => ({ switchTab: jest.fn(), showFileInfo: jest.fn() }));
    (ctor as any).viewType = 'acacia-log.unifiedView';
    return { UnifiedLogViewProvider: ctor };
});
jest.mock('../logSearch/editorToolsViewProvider', () => {
    const ctor = jest.fn().mockImplementation(() => ({ switchTab: jest.fn() }));
    (ctor as any).viewType = 'acacia-log.editorTools';
    return { EditorToolsViewProvider: ctor };
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
const mockExecuteCommand = jest.fn().mockResolvedValue(undefined);

jest.mock('vscode', () => ({
    commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: mockExecuteCommand,
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
        regexp: '\\bERROR\\b',
        regexpoptions: '',          // case-sensitive
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
        regexpoptions: 'i',         // case-insensitive
        lensColor: '#ffaa00',
        lensPriority: 20,
        lensShowInStatusBar: true,
        bSearch: true,
    },
];

// ── Shared context ────────────────────────────────────────────────────────────

let fakeContext: any;
let findLensHandler: (args: { key: string }) => Promise<void>;

beforeEach(async () => {
    jest.clearAllMocks();
    mockReadLogPatterns.mockReturnValue(PATTERNS);
    mockGetConfig.mockReturnValue('');          // no patternsFilePath override

    fakeContext = {
        subscriptions: { push: jest.fn() },
        extensionPath: '/fake/extension',
        extensionUri: { fsPath: '/fake/extension' },
    };

    const registerSpy = jest.spyOn(vscode.commands, 'registerCommand');
    await activate(fakeContext as any);

    const call = registerSpy.mock.calls.find(([cmd]) => cmd === 'acacia-log.findLens');
    findLensHandler = call![1] as (args: { key: string }) => Promise<void>;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('acacia-log.findLens command', () => {
    test('1 — delegates to editor.actions.findWithArgs with correct fields', async () => {
        await findLensHandler({ key: 'error' });

        expect(mockExecuteCommand).toHaveBeenCalledWith(
            'editor.actions.findWithArgs',
            {
                searchString: '\\bERROR\\b',
                isRegex: true,
                matchCase: true,        // regexpoptions '' does not include 'i'
                findInSelection: false,
            }
        );
    });

    test('2 — matchCase is false when regexpoptions contains "i"', async () => {
        await findLensHandler({ key: 'warn' });

        expect(mockExecuteCommand).toHaveBeenCalledWith(
            'editor.actions.findWithArgs',
            expect.objectContaining({ matchCase: false })
        );
    });

    test('3 — searchString matches the raw regexp from the pattern', async () => {
        await findLensHandler({ key: 'warn' });

        expect(mockExecuteCommand).toHaveBeenCalledWith(
            'editor.actions.findWithArgs',
            expect.objectContaining({ searchString: 'warn', isRegex: true })
        );
    });

    test('4 — findInSelection is always false', async () => {
        await findLensHandler({ key: 'error' });

        expect(mockExecuteCommand).toHaveBeenCalledWith(
            'editor.actions.findWithArgs',
            expect.objectContaining({ findInSelection: false })
        );
    });

    test('5 — returns silently when key is not found (no executeCommand call)', async () => {
        await findLensHandler({ key: 'nonexistent' });

        expect(mockExecuteCommand).not.toHaveBeenCalledWith('editor.actions.findWithArgs', expect.anything());
    });

    test('6 — returns silently when readLogPatterns throws', async () => {
        mockReadLogPatterns.mockImplementation(() => { throw new Error('file not found'); });

        await expect(findLensHandler({ key: 'error' })).resolves.toBeUndefined();
        expect(mockExecuteCommand).not.toHaveBeenCalledWith('editor.actions.findWithArgs', expect.anything());
    });

    test('7 — returns silently when args is undefined', async () => {
        await findLensHandler(undefined as any);

        expect(mockExecuteCommand).not.toHaveBeenCalledWith('editor.actions.findWithArgs', expect.anything());
    });

    test('8 — returns silently when args.key is empty string', async () => {
        await findLensHandler({ key: '' });

        expect(mockExecuteCommand).not.toHaveBeenCalledWith('editor.actions.findWithArgs', expect.anything());
    });

    test('9 — uses patternsFilePath setting when set', async () => {
        mockGetConfig.mockImplementation((key: string) =>
            key === 'patternsFilePath' ? '/custom/path/logPatterns.json' : ''
        );

        await findLensHandler({ key: 'error' });

        expect(mockReadLogPatterns).toHaveBeenCalledWith('/custom/path/logPatterns.json');
    });

    test('10 — falls back to .vscode/logPatterns.json in workspace root when patternsFilePath is blank', async () => {
        mockGetConfig.mockReturnValue('');
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/my/workspace' } }];

        await findLensHandler({ key: 'error' });

        expect(mockReadLogPatterns).toHaveBeenCalledWith(
            expect.stringContaining('.vscode')
        );
        expect(mockReadLogPatterns.mock.calls[0][0]).toMatch(/logPatterns\.json$/);
    });

    test('11 — executeCommand is called exactly once per valid invocation', async () => {
        await findLensHandler({ key: 'error' });
        await findLensHandler({ key: 'warn' });

        const findWithArgsCalls = mockExecuteCommand.mock.calls.filter(
            ([cmd]: [string]) => cmd === 'editor.actions.findWithArgs'
        );
        expect(findWithArgsCalls).toHaveLength(2);
    });
});
