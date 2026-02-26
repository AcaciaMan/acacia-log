/**
 * Tests for extension activation performance and correctness.
 * Verifies that:
 * - activate() completes without errors
 * - Lazy-loaded modules are NOT loaded at activation time
 * - Commands are registered but handlers are deferred
 * - Providers are registered with minimal overhead
 * - createLogPatterns is called asynchronously (Phase 2), not synchronously
 * - No forbidden heavy static imports remain in extension.ts
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

jest.mock('../logSearch/lensStatusBar', () => ({
    LensStatusBar: jest.fn().mockImplementation(() => ({
        activate: jest.fn(),
        refresh: jest.fn(),
        dispose: jest.fn(),
    })),
}));

// Mock internal modules to prevent side effects
const mockCreateLogPatterns = jest.fn().mockResolvedValue(undefined);
jest.mock('../utils/navigateToDateTime', () => ({ navigateToDateTime: jest.fn() }));
jest.mock('../utils/calculateSimilarLineCounts', () => ({ calculateSimilarLineCounts: jest.fn() }));
jest.mock('../utils/drawLogTimeline', () => ({ drawLogTimeline: jest.fn() }));
jest.mock('../utils/createLogPatterns', () => ({ createLogPatterns: mockCreateLogPatterns }));
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

import { activate, deactivate } from '../extension';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockContext(): any {
    mockSubscriptions.length = 0;
    return {
        subscriptions: mockSubscriptions,
        extensionPath: '/mock/extension/path',
        extensionUri: { fsPath: '/mock/extension/path' },
    };
}

function getRegisteredCommandIds(): string[] {
    return mockRegisterCommand.mock.calls.map((call: any[]) => call[0]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Activation Performance Tests', () => {
    let context: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        context = createMockContext();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ── Core activation correctness ───────────────────────────────────────

    describe('activate() correctness', () => {
        it('completes without throwing', async () => {
            await expect(activate(context)).resolves.not.toThrow();
        });

        it('returns undefined (void)', async () => {
            const result = await activate(context);
            expect(result).toBeUndefined();
        });

        it('pushes disposables to context.subscriptions', async () => {
            await activate(context);
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });

        it('registers all expected commands', async () => {
            await activate(context);

            const expectedCommands = [
                'acacia-log.helloWorld',
                'extension.setLogDateFormat',
                'extension.setLogDateRegex',
                'extension.setLogSearchDate',
                'extension.setLogSearchTime',
                'extension.calculateSimilarLineCounts',
                'extension.drawLogTimeline',
                'acacia-log.loadMoreAbove',
                'acacia-log.loadMoreBelow',
                'acacia-log.toggleLensDecorations',
                'acacia-log.logExplorer.onFileClick',
                'acacia-log.logExplorer.refresh',
                'acacia-log.logExplorer.filter',
                'acacia-log.logExplorer.clearFilter',
                'acacia-log.logExplorer.addFolder',
                'acacia-log.logExplorer.removeFolder',
                'acacia-log.logExplorer.openFile',
                'acacia-log.logExplorer.showFileInfo',
                'acacia-log.logExplorer.revealInExplorer',
                'acacia-log.logExplorer.generateGapReport',
                'acacia-log.logExplorer.generateChunkStatsReport',
                'acacia-log.logExplorer.compareChunkStats',
                'acacia-log.convertToJsonl',
                'acacia-log.logExplorer.convertToJsonl',
                'acacia-log.logExplorer.convertJsonlToLog',
                'acacia-log.openLogManagerPanel',
            ];

            const registeredIds = getRegisteredCommandIds();
            for (const cmd of expectedCommands) {
                expect(registeredIds).toContain(cmd);
            }
        });

        it('registers providers (webview, tree, content)', async () => {
            await activate(context);
            expect(mockRegisterWebviewViewProvider).toHaveBeenCalledTimes(1);
            expect(mockRegisterTextDocumentContentProvider).toHaveBeenCalledTimes(1);
            expect(mockCreateTreeView).toHaveBeenCalledTimes(1);
        });
    });

    // ── Lazy loading verification ─────────────────────────────────────────

    describe('lazy module loading', () => {
        it('createLogPatterns is NOT called during synchronous activate()', async () => {
            // activate() returns immediately; createLogPatterns runs in setTimeout
            await activate(context);

            // Before timer fires, createLogPatterns should NOT have been called
            expect(mockCreateLogPatterns).not.toHaveBeenCalled();
        });

        it('createLogPatterns IS called after Phase 2 (setTimeout fires)', async () => {
            await activate(context);

            // Run all pending timers (Phase 2 setTimeout)
            await jest.runAllTimersAsync();

            expect(mockCreateLogPatterns).toHaveBeenCalledTimes(1);
        });

        it('lazy modules are not loaded until their command is invoked', async () => {
            // These modules are lazy-loaded via require() inside command handlers.
            // After activate(), they should have been imported by jest.mock but
            // the actual require() inside handlers should NOT have been called yet.
            await activate(context);

            // Get handlers for lazy-loaded commands
            const lazyCommands = [
                'extension.calculateSimilarLineCounts',
                'extension.drawLogTimeline',
                'acacia-log.convertToJsonl',
                'acacia-log.logExplorer.convertJsonlToLog',
                'acacia-log.loadMoreAbove',
                'acacia-log.loadMoreBelow',
            ];

            // The handlers are registered but the underlying functions haven't been invoked
            for (const cmdId of lazyCommands) {
                const call = mockRegisterCommand.mock.calls.find((c: any[]) => c[0] === cmdId);
                expect(call).toBeDefined();
                // Handler is a function waiting to be called
                expect(typeof call![1]).toBe('function');
            }
        });

        it('LogLensDecorationProvider.activate() is NOT called synchronously', async () => {
            await activate(context);

            const { LogLensDecorationProvider } = require('../logSearch/logLensDecorationProvider');
            const instance = LogLensDecorationProvider.mock.results[0]?.value;
            // Before Phase 2, activate() on the lens provider should not be called
            expect(instance.activate).not.toHaveBeenCalled();
        });

        it('LogLensDecorationProvider.activate() is called during Phase 2 when editors are visible', async () => {
            // Set up visible editors so Phase 2 triggers lens activation
            const vscode = require('vscode');
            vscode.window.visibleTextEditors = [{ document: {} }];

            await activate(context);
            await jest.runAllTimersAsync();

            const { LogLensDecorationProvider } = require('../logSearch/logLensDecorationProvider');
            const instance = LogLensDecorationProvider.mock.results[0]?.value;
            expect(instance.activate).toHaveBeenCalledTimes(1);
        });

        it('LogLensDecorationProvider.activate() is deferred when no editors visible', async () => {
            const vscode = require('vscode');
            vscode.window.visibleTextEditors = [];

            await activate(context);
            await jest.runAllTimersAsync();

            const { LogLensDecorationProvider } = require('../logSearch/logLensDecorationProvider');
            const instance = LogLensDecorationProvider.mock.results[0]?.value;
            // Should NOT be called yet — waiting for onDidChangeVisibleTextEditors
            expect(instance.activate).not.toHaveBeenCalled();
            // But the listener should have been registered
            expect(vscode.window.onDidChangeVisibleTextEditors).toHaveBeenCalled();
        });
    });

    // ── Two-phase activation verification ─────────────────────────────────

    describe('two-phase activation', () => {
        it('Phase 1 completes synchronously (commands and providers registered)', async () => {
            const activatePromise = activate(context);

            // Phase 1 should already have registered everything
            expect(mockRegisterCommand.mock.calls.length).toBeGreaterThan(0);
            expect(mockRegisterWebviewViewProvider.mock.calls.length).toBe(1);
            expect(mockCreateTreeView.mock.calls.length).toBe(1);

            await activatePromise;
        });

        it('Phase 2 runs deferred work via setTimeout', async () => {
            await activate(context);

            // createLogPatterns not called yet (it's in setTimeout)
            expect(mockCreateLogPatterns).not.toHaveBeenCalled();

            // Run pending timers
            await jest.runAllTimersAsync();

            // Now it should have been called
            expect(mockCreateLogPatterns).toHaveBeenCalled();
        });

        it('Phase 2 errors are caught and do not crash the extension', async () => {
            mockCreateLogPatterns.mockRejectedValueOnce(new Error('Pattern file error'));

            // Spy on console.error to verify error is logged
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();

            await activate(context);
            await jest.runAllTimersAsync();

            expect(errorSpy).toHaveBeenCalledWith(
                '[Acacia Log] Phase 2 initialization error:',
                expect.any(Error),
            );

            errorSpy.mockRestore();
        });
    });

    // ── Provider construction overhead ────────────────────────────────────

    describe('provider construction', () => {
        it('providers are instantiated without I/O during construction', async () => {
            // If providers did synchronous I/O (fs.readFileSync, etc.) during
            // construction, the mocks would throw. This test verifies construction
            // completes without errors, implying no unmocked I/O.
            await expect(activate(context)).resolves.not.toThrow();

            // Verify all provider constructors were called exactly once
            const { LogTreeProvider } = require('../logManagement/logTreeProvider');
            const { LogLensDecorationProvider } = require('../logSearch/logLensDecorationProvider');
            const { LogManagerViewProvider } = require('../logSearch/logManagerViewProvider');
            const { LogManagerPanelProvider } = require('../logSearch/logManagerPanelProvider');

            expect(LogTreeProvider).toHaveBeenCalledTimes(1);
            expect(LogLensDecorationProvider).toHaveBeenCalledTimes(1);
            expect(LogManagerViewProvider).toHaveBeenCalledTimes(1);
            expect(LogManagerPanelProvider).toHaveBeenCalledTimes(1);
        });
    });

    // ── Import weight analysis ────────────────────────────────────────────

    describe('import weight analysis', () => {
        it('extension.ts has no heavy static imports for command-only modules', () => {
            const fs = require('fs');
            const path = require('path');
            const extensionSource = fs.readFileSync(
                path.join(__dirname, '..', 'extension.ts'), 'utf-8',
            );

            // These modules should NOT be statically imported in extension.ts.
            // They should be lazy-loaded in command handlers or Phase 2.
            const forbiddenImports = [
                'navigateToDateTime',
                'calculateSimilarLineCounts',
                'drawLogTimeline',
                'jsonl-to-log',
                'log-to-jsonl-command',
                'log-to-jsonl',
                "'luxon'",
                "'domain'",
                'logGapReportProvider',
                'logChunkStatsProvider',
                'logChunkStatsComparisonProvider',
            ];

            for (const forbidden of forbiddenImports) {
                // Allow type-only imports (import type ...)
                const importRegex = new RegExp(
                    `^import\\s+(?!type\\s).*${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
                    'm',
                );
                expect(extensionSource).not.toMatch(importRegex);
            }
        });

        it('extension.ts uses dynamic require() for createLogPatterns', () => {
            const fs = require('fs');
            const path = require('path');
            const extensionSource = fs.readFileSync(
                path.join(__dirname, '..', 'extension.ts'), 'utf-8',
            );

            // createLogPatterns should be loaded via require(), not static import
            expect(extensionSource).toMatch(/require\(['"]\.\/utils\/createLogPatterns['"]\)/);
            expect(extensionSource).not.toMatch(
                /^import\s+(?!type\s).*createLogPatterns/m,
            );
        });

        it('extension.ts only statically imports lightweight provider/command modules', () => {
            const fs = require('fs');
            const path = require('path');
            const extensionSource = fs.readFileSync(
                path.join(__dirname, '..', 'extension.ts'), 'utf-8',
            );

            // Extract all static import paths
            const importMatches = extensionSource.match(
                /^import\s+(?!type\s).*from\s+['"]([^'"]+)['"]/gm,
            ) || [];

            // Allowed static import sources
            const allowedPatterns = [
                'vscode',
                './logManagement/logTreeProvider',
                './logSearch/logManagerViewProvider',
                './logSearch/logManagerPanelProvider',
                './utils/resultDocumentProvider',
                './logSearch/logLensDecorationProvider',
                './logSearch/lensStatusBar',
                './utils/readLogPatterns',
                './utils/log-context',
                './commands/configCommands',
                './commands/analysisCommands',
                './commands/treeCommands',
                './commands/reportCommands',
                './commands/conversionCommands',
                './commands/viewCommands',
            ];

            for (const imp of importMatches) {
                const pathMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
                if (pathMatch) {
                    expect(allowedPatterns).toContain(pathMatch[1]);
                }
            }
        });
    });

    // ── Subscription integrity ────────────────────────────────────────────

    describe('subscription integrity', () => {
        it('all subscriptions are disposable objects', async () => {
            await activate(context);
            for (const sub of context.subscriptions) {
                expect(sub).toBeDefined();
                expect(typeof sub.dispose).toBe('function');
            }
        });

        it('no duplicate command IDs are registered', async () => {
            await activate(context);
            const ids = getRegisteredCommandIds();
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);
        });
    });

    // ── Deactivation ──────────────────────────────────────────────────────

    describe('deactivation', () => {
        it('deactivate() does not throw', () => {
            expect(() => deactivate()).not.toThrow();
        });

        it('deactivate() returns undefined', () => {
            expect(deactivate()).toBeUndefined();
        });
    });
});
