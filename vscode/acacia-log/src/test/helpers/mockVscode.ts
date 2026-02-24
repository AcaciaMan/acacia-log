/**
 * Shared mock helpers for VS Code extension tests.
 * Provides reusable factory functions for creating mock ExtensionContext,
 * mock webview views, and other vscode API objects.
 */

import type * as vscode from 'vscode';

/**
 * Creates a mock ExtensionContext suitable for activation tests.
 * All disposable arrays are pre-initialized and other required fields
 * are filled with safe defaults.
 */
export function createMockExtensionContext(
    overrides: Partial<vscode.ExtensionContext> = {},
): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '/mock/extension/path',
        extensionUri: { fsPath: '/mock/extension/path' } as any,
        storageUri: undefined,
        globalStorageUri: { fsPath: '/mock/global' } as any,
        logUri: { fsPath: '/mock/log' } as any,
        extensionMode: 1, // Production
        globalState: {
            get: jest.fn(),
            update: jest.fn(),
            keys: jest.fn().mockReturnValue([]),
            setKeysForSync: jest.fn(),
        } as any,
        workspaceState: {
            get: jest.fn(),
            update: jest.fn(),
            keys: jest.fn().mockReturnValue([]),
        } as any,
        secrets: {
            get: jest.fn(),
            store: jest.fn(),
            delete: jest.fn(),
            onDidChange: jest.fn(),
        } as any,
        environmentVariableCollection: {
            persistent: false,
            description: '',
            replace: jest.fn(),
            append: jest.fn(),
            prepend: jest.fn(),
            get: jest.fn(),
            forEach: jest.fn(),
            clear: jest.fn(),
            delete: jest.fn(),
            getScoped: jest.fn(),
            [Symbol.iterator]: jest.fn(),
        } as any,
        storagePath: '/mock/storage',
        globalStoragePath: '/mock/global',
        logPath: '/mock/log',
        asAbsolutePath: jest.fn((p: string) => `/mock/extension/path/${p}`),
        extension: {
            id: 'manacacia.acacia-log',
            extensionUri: { fsPath: '/mock/extension/path' } as any,
            extensionPath: '/mock/extension/path',
            isActive: true,
            packageJSON: {},
            exports: undefined,
            extensionKind: 1,
            activate: jest.fn(),
        } as any,
        languageModelAccessInformation: {
            onDidChange: jest.fn(),
            canSendRequest: jest.fn(),
        } as any,
        ...overrides,
    } as any;
}

/**
 * Creates a minimal mock WebviewView for testing webview view providers.
 */
export function createMockWebviewView(): any {
    return {
        webview: {
            html: '',
            options: {},
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn().mockResolvedValue(true),
            asWebviewUri: jest.fn((uri: any) => uri),
            cspSource: 'mock-csp',
        },
        viewType: 'mock.viewType',
        title: '',
        description: '',
        visible: true,
        onDidDispose: jest.fn(),
        onDidChangeVisibility: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    };
}

/**
 * Creates a minimal mock TextEditor.
 */
export function createMockTextEditor(overrides: Record<string, any> = {}): any {
    return {
        document: {
            uri: { fsPath: '/mock/test.log', toString: () => 'file:///mock/test.log', scheme: 'file' },
            getText: jest.fn().mockReturnValue(''),
            lineAt: jest.fn().mockReturnValue({ text: '' }),
            lineCount: 100,
            fileName: '/mock/test.log',
            languageId: 'log',
        },
        selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        selections: [],
        visibleRanges: [],
        options: {},
        viewColumn: 1,
        edit: jest.fn(),
        insertSnippet: jest.fn(),
        setDecorations: jest.fn(),
        revealRange: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        ...overrides,
    };
}
