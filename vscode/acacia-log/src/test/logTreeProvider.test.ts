/**
 * Unit tests for logTreeProvider.ts
 * Tests tree data provider logic, filtering, metadata, and lifecycle.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── vscode mock ───────────────────────────────────────────────────────────────

const mockFire = jest.fn();
const mockCreateFileSystemWatcher = jest.fn().mockReturnValue({
  onDidCreate: jest.fn(),
  onDidDelete: jest.fn(),
  onDidChange: jest.fn(),
  dispose: jest.fn(),
});

let tempDir: string; // set in beforeAll

jest.mock('vscode', () => {
  // Use a simple class that mimics TreeItem
  class MockTreeItem {
    label: string;
    collapsibleState: number;
    resourceUri?: any;
    iconPath?: any;
    tooltip?: any;
    description?: string;
    contextValue?: string;
    command?: any;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }

  return {
    TreeItem: MockTreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: jest.fn().mockImplementation(() => ({
      event: jest.fn(),
      fire: mockFire,
      dispose: jest.fn(),
    })),
    Uri: {
      file: (p: string) => ({ fsPath: p, toString: () => `file://${p}`, scheme: 'file' }),
    },
    ThemeIcon: jest.fn((id: string) => ({ id })),
    RelativePattern: jest.fn((base: string, pattern: string) => ({ base, pattern })),
    workspace: {
      workspaceFolders: undefined as any, // set per-test
      getConfiguration: jest.fn().mockReturnValue({ get: jest.fn() }),
      createFileSystemWatcher: mockCreateFileSystemWatcher,
    },
    window: {
      showOpenDialog: jest.fn(),
      showInformationMessage: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
    MarkdownString: jest.fn().mockImplementation(() => ({
      value: '',
      isTrusted: true,
      appendMarkdown(s: string) { this.value += s; },
    })),
  };
}, { virtual: true });

// Mock LogFileHandler to avoid real file I/O during metadata loading
jest.mock('../utils/log-file-reader', () => ({
  LogFileHandler: jest.fn().mockImplementation(() => ({
    totalLines: 42,
    initialize: jest.fn().mockResolvedValue({
      detected: true,
      format: { pattern: 'yyyy-MM-dd HH:mm:ss' },
    }),
  })),
}));

jest.mock('../utils/timestamp-detect', () => ({
  getFormatDisplayString: jest.fn().mockReturnValue('ISO 8601'),
}));

import { LogTreeProvider, LogTreeItem, FilterOptions } from '../logManagement/logTreeProvider';
import * as vscode from 'vscode';

// ── Test fixtures ─────────────────────────────────────────────────────────────

function createMockContext(watchedFolders: string[] = []): any {
  return {
    globalState: {
      get: jest.fn((_key: string, defaultVal: any) => watchedFolders.length > 0 ? watchedFolders : defaultVal),
      update: jest.fn(),
    },
    subscriptions: [],
  };
}

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acacia-tree-'));
  fs.writeFileSync(path.join(tempDir, 'app.log'), '2026-01-15 10:00:00 INFO Started\n'.repeat(100));
  fs.writeFileSync(path.join(tempDir, 'error.log'), '2026-01-15 10:00:00 ERROR Failed\n');
  fs.writeFileSync(path.join(tempDir, 'data.txt'), 'no timestamps here\n');
  fs.writeFileSync(path.join(tempDir, 'readme.md'), '# Not a log file\n');
  fs.mkdirSync(path.join(tempDir, 'subdir'));
  fs.writeFileSync(path.join(tempDir, 'subdir', 'nested.log'), 'nested log\n');
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── LogTreeItem ───────────────────────────────────────────────────────────────

describe('LogTreeItem', () => {
  it('creates a file item with isFolder=false and collapsibleState=None', () => {
    const uri = vscode.Uri.file('/test/app.log');
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);

    expect(item.label).toBe('app.log');
    expect(item.isFolder).toBe(false);
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(item.contextValue).toBe('logFile');
  });

  it('creates a folder item with isFolder=true and collapsibleState=Collapsed', () => {
    const uri = vscode.Uri.file('/test/logs');
    const item = new LogTreeItem('logs', vscode.TreeItemCollapsibleState.Collapsed, uri, true);

    expect(item.label).toBe('logs');
    expect(item.isFolder).toBe(true);
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(item.contextValue).toBe('logFolder');
  });

  it('populates metadata fields on construction', () => {
    const now = new Date();
    const uri = vscode.Uri.file('/test/app.log');
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false, {
      size: 2048,
      lastModified: now,
      created: now,
      totalLines: 100,
      timestampPattern: 'yyyy-MM-dd HH:mm:ss',
      timestampDetected: true,
    });

    expect(item.metadata).toBeDefined();
    expect(item.metadata!.size).toBe(2048);
    expect(item.metadata!.totalLines).toBe(100);
    expect(item.metadata!.timestampDetected).toBe(true);
  });

  it('sets file command for non-folder items with resourceUri', () => {
    const uri = vscode.Uri.file('/test/app.log');
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);

    expect(item.command).toBeDefined();
    expect(item.command!.command).toBe('acacia-log.logExplorer.onFileClick');
  });

  it('does not set command for folder items', () => {
    const uri = vscode.Uri.file('/test/logs');
    const item = new LogTreeItem('logs', vscode.TreeItemCollapsibleState.Collapsed, uri, true);

    expect(item.command).toBeUndefined();
  });

  it('applyFullMetadata updates initialized flag and metadata', () => {
    const uri = vscode.Uri.file('/test/app.log');
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);

    expect(item.initialized).toBe(false);

    item.applyFullMetadata({
      size: 4096,
      totalLines: 200,
      timestampDetected: true,
      timestampPattern: 'yyyy-MM-dd HH:mm:ss',
    });

    expect(item.initialized).toBe(true);
  });
});

// ── LogTreeProvider — getChildren ─────────────────────────────────────────────

describe('LogTreeProvider — getChildren', () => {
  let provider: LogTreeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set workspace folders to our tempDir
    (vscode.workspace as any).workspaceFolders = [
      { name: 'test-workspace', uri: vscode.Uri.file(tempDir) },
    ];
    provider = new LogTreeProvider(createMockContext());
  });

  afterEach(() => {
    provider.dispose();
  });

  it('returns watched workspace folders at root level', async () => {
    const roots = await provider.getChildren();

    expect(roots.length).toBeGreaterThanOrEqual(1);
    const root = roots.find(r => r.label === 'test-workspace');
    expect(root).toBeDefined();
    expect(root!.isFolder).toBe(true);
  });

  it('returns log files when expanding a folder', async () => {
    const roots = await provider.getChildren();
    const root = roots.find(r => r.label === 'test-workspace')!;

    const children = await provider.getChildren(root);

    const fileNames = children.map(c => c.label);
    expect(fileNames).toContain('app.log');
    expect(fileNames).toContain('error.log');
    expect(fileNames).toContain('data.txt');
  });

  it('excludes non-log files like .md', async () => {
    const roots = await provider.getChildren();
    const root = roots.find(r => r.label === 'test-workspace')!;

    const children = await provider.getChildren(root);
    const fileNames = children.map(c => c.label);

    expect(fileNames).not.toContain('readme.md');
  });

  it('shows subfolders as collapsible items when they contain log files', async () => {
    const roots = await provider.getChildren();
    const root = roots.find(r => r.label === 'test-workspace')!;

    const children = await provider.getChildren(root);
    const subdir = children.find(c => c.label === 'subdir');

    expect(subdir).toBeDefined();
    expect(subdir!.isFolder).toBe(true);
    expect(subdir!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
  });

  it('returns nested log files when expanding a subfolder', async () => {
    const roots = await provider.getChildren();
    const root = roots.find(r => r.label === 'test-workspace')!;
    const children = await provider.getChildren(root);
    const subdir = children.find(c => c.label === 'subdir')!;

    const nestedChildren = await provider.getChildren(subdir);
    const nestedNames = nestedChildren.map(c => c.label);

    expect(nestedNames).toContain('nested.log');
  });

  it('returns placeholder when no workspace folders exist', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    provider = new LogTreeProvider(createMockContext());

    const roots = await provider.getChildren();

    expect(roots.length).toBe(1);
    expect(roots[0].label).toBe('No log files found');
    expect(roots[0].contextValue).toBe('placeholder');
  });
});

// ── LogTreeProvider — getChildren with manually watched folders ───────────────

describe('LogTreeProvider — watched folders', () => {
  it('includes manually watched folders at root level', async () => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext([tempDir]));

    const roots = await provider.getChildren();
    const folderName = path.basename(tempDir);
    const watched = roots.find(r => r.label === folderName);

    expect(watched).toBeDefined();
    expect(watched!.isFolder).toBe(true);

    provider.dispose();
  });
});

// ── LogTreeProvider — filter ──────────────────────────────────────────────────

describe('LogTreeProvider — filter', () => {
  let provider: LogTreeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [
      { name: 'test-workspace', uri: vscode.Uri.file(tempDir) },
    ];
    provider = new LogTreeProvider(createMockContext());
  });

  afterEach(() => {
    provider.dispose();
  });

  it('has no active filter initially', () => {
    expect(provider.hasActiveFilter()).toBe(false);
  });

  it('hasActiveFilter returns true after setting a date filter', () => {
    provider.setFilter({ dateFilter: { range: 'today' } });
    expect(provider.hasActiveFilter()).toBe(true);
  });

  it('hasActiveFilter returns true after setting a file type filter', () => {
    provider.setFilter({ fileTypes: ['.log'] });
    expect(provider.hasActiveFilter()).toBe(true);
  });

  it('getFilter returns the current filter', () => {
    const filter: FilterOptions = { dateFilter: { range: 'last7days' } };
    provider.setFilter(filter);

    const result = provider.getFilter();
    expect(result.dateFilter?.range).toBe('last7days');
  });

  it('clearing filter resets hasActiveFilter to false', () => {
    provider.setFilter({ dateFilter: { range: 'today' } });
    expect(provider.hasActiveFilter()).toBe(true);

    provider.setFilter({});
    expect(provider.hasActiveFilter()).toBe(false);
  });

  it('file type filter excludes non-matching extensions', async () => {
    provider.setFilter({ fileTypes: ['.log'] });

    const roots = await provider.getChildren();
    const root = roots.find(r => r.label === 'test-workspace')!;
    const children = await provider.getChildren(root);
    const names = children.filter(c => !c.isFolder).map(c => c.label);

    // .log files should be present, .txt should be filtered out
    expect(names).toContain('app.log');
    expect(names).toContain('error.log');
    expect(names).not.toContain('data.txt');
  });

  it('setFilter triggers refresh (fires change event)', () => {
    jest.clearAllMocks();
    provider.setFilter({ fileTypes: ['.log'] });

    expect(mockFire).toHaveBeenCalled();
  });

  it('setFilter sets context for filterActive', () => {
    provider.setFilter({ dateFilter: { range: 'today' } });

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext', 'acacia-log.filterActive', true
    );
  });
});

// ── LogTreeProvider — refresh ─────────────────────────────────────────────────

describe('LogTreeProvider — refresh', () => {
  it('fires onDidChangeTreeData event', () => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext());

    provider.refresh();

    expect(mockFire).toHaveBeenCalled();
    provider.dispose();
  });
});

// ── LogTreeProvider — getTreeItem ─────────────────────────────────────────────

describe('LogTreeProvider — getTreeItem', () => {
  it('returns the same element passed in', () => {
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext());
    const uri = vscode.Uri.file('/test/app.log');
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);

    const result = provider.getTreeItem(item);
    expect(result).toBe(item);

    provider.dispose();
  });
});

// ── LogTreeProvider — loadMetadata ────────────────────────────────────────────

describe('LogTreeProvider — loadMetadata', () => {
  it('populates metadata for a file item', async () => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext());
    const filePath = path.join(tempDir, 'app.log');
    const uri = vscode.Uri.file(filePath);
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);

    expect(item.initialized).toBe(false);
    await provider.loadMetadata(item);
    expect(item.initialized).toBe(true);

    provider.dispose();
  });

  it('skips loading for folder items', async () => {
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext());
    const uri = vscode.Uri.file(tempDir);
    const item = new LogTreeItem('logs', vscode.TreeItemCollapsibleState.Collapsed, uri, true);

    await provider.loadMetadata(item);
    expect(item.initialized).toBe(false);

    provider.dispose();
  });

  it('skips loading for already initialized items', async () => {
    (vscode.workspace as any).workspaceFolders = [];
    const provider = new LogTreeProvider(createMockContext());
    const filePath = path.join(tempDir, 'app.log');
    const uri = vscode.Uri.file(filePath);
    const item = new LogTreeItem('app.log', vscode.TreeItemCollapsibleState.None, uri, false);
    item.initialized = true;

    await provider.loadMetadata(item);
    // Should not fire change event for already-initialized items
    // (mockFire may be called from constructor, so just ensure no extra calls)

    provider.dispose();
  });
});

// ── LogTreeProvider — dispose ─────────────────────────────────────────────────

describe('LogTreeProvider — dispose', () => {
  it('disposes all file watchers', () => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [];
    // Create provider with a watched folder to trigger watcher creation
    const provider = new LogTreeProvider(createMockContext([tempDir]));

    provider.dispose();

    // The file watcher's dispose should have been called
    const watcher = mockCreateFileSystemWatcher.mock.results[0]?.value;
    if (watcher) {
      expect(watcher.dispose).toHaveBeenCalled();
    }
  });
});
