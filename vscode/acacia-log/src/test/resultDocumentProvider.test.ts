/**
 * Unit tests for resultDocumentProvider.ts
 * Tests the virtual document provider for displaying results in editor tabs.
 */

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockShowTextDocument = jest.fn().mockResolvedValue({});
const mockOpenTextDocument = jest.fn().mockResolvedValue({
  uri: { scheme: 'acacia-log', toString: () => 'acacia-log:/results/test' },
});
const mockShowErrorMessage = jest.fn();
const mockCreateWebviewPanel = jest.fn().mockReturnValue({
  webview: {
    html: '',
    onDidReceiveMessage: jest.fn(),
  },
  dispose: jest.fn(),
});
const mockExecuteCommand = jest.fn();

jest.mock('vscode', () => {
  const EventEmitterImpl = jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  }));

  return {
    Uri: {
      parse: jest.fn((s: string) => {
        // Simulate basic URI parsing
        const schemeEnd = s.indexOf(':');
        const scheme = schemeEnd > -1 ? s.substring(0, schemeEnd) : 'file';
        const rest = schemeEnd > -1 ? s.substring(schemeEnd + 1) : s;
        const hashIdx = rest.indexOf('#');
        const pathPart = hashIdx > -1 ? rest.substring(0, hashIdx) : rest;
        const fragment = hashIdx > -1 ? rest.substring(hashIdx + 1) : '';
        return {
          scheme,
          path: pathPart,
          fragment,
          toString: () => s,
          fsPath: pathPart,
        };
      }),
      file: jest.fn((p: string) => ({ fsPath: p, toString: () => `file://${p}`, scheme: 'file' })),
    },
    workspace: {
      openTextDocument: mockOpenTextDocument,
      textDocuments: [],
    },
    window: {
      showTextDocument: mockShowTextDocument,
      showErrorMessage: mockShowErrorMessage,
      visibleTextEditors: [],
      createWebviewPanel: mockCreateWebviewPanel,
    },
    commands: {
      executeCommand: mockExecuteCommand,
    },
    EventEmitter: EventEmitterImpl,
    ViewColumn: { One: 1, Two: 2, Beside: 3 },
    languages: {
      setTextDocumentLanguage: jest.fn().mockImplementation(async (doc: any) => doc),
    },
  };
}, { virtual: true });

jest.mock('fs');
jest.mock('../utils/navigateToLine', () => ({
  navigateToLine: jest.fn(),
}));

import { ResultDocumentProvider } from '../utils/resultDocumentProvider';

const vscode = require('vscode');
const fs = require('fs');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset the singleton between tests */
function resetSingleton() {
  (ResultDocumentProvider as any).instance = undefined;
  (ResultDocumentProvider as any).lineIndexCache = new Map();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResultDocumentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSingleton();
  });

  // ── Singleton ──

  describe('getInstance', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ResultDocumentProvider.getInstance();
      const b = ResultDocumentProvider.getInstance();
      expect(a).toBe(b);
    });

    it('stores extensionPath when provided', () => {
      const inst = ResultDocumentProvider.getInstance('/ext');
      expect((inst as any).extensionPath).toBe('/ext');
    });

    it('updates extensionPath on second call if not set previously', () => {
      const inst = ResultDocumentProvider.getInstance();
      expect((inst as any).extensionPath).toBeUndefined();

      ResultDocumentProvider.getInstance('/ext/path');
      expect((inst as any).extensionPath).toBe('/ext/path');
    });

    it('does not overwrite extensionPath if already set', () => {
      ResultDocumentProvider.getInstance('/first');
      const inst = ResultDocumentProvider.getInstance('/second');
      // extensionPath should remain '/first' because the condition checks
      // `!instance.extensionPath` — it's already set
      expect((inst as any).extensionPath).toBe('/first');
    });
  });

  // ── provideTextDocumentContent ──

  describe('provideTextDocumentContent', () => {
    it('returns default content when no document stored', () => {
      const provider = new ResultDocumentProvider();
      const uri = vscode.Uri.parse('acacia-log:/results/test.txt');
      const content = provider.provideTextDocumentContent(uri);
      expect(content).toBe('// No content available');
    });

    it('returns stored content by full path with fragment', () => {
      const provider = new ResultDocumentProvider();
      (provider as any).documents.set('/results/test.txt#1', 'hello world');

      const uri = vscode.Uri.parse('acacia-log:/results/test.txt#1');
      const content = provider.provideTextDocumentContent(uri);
      expect(content).toBe('hello world');
    });

    it('falls back to path without fragment', () => {
      const provider = new ResultDocumentProvider();
      (provider as any).documents.set('/results/test.txt', 'fallback content');

      const uri = vscode.Uri.parse('acacia-log:/results/test.txt');
      const content = provider.provideTextDocumentContent(uri);
      expect(content).toBe('fallback content');
    });

    it('falls back to base path when fragment lookup fails', () => {
      const provider = new ResultDocumentProvider();
      // Store content without fragment
      (provider as any).documents.set('/results/test.txt', 'base content');

      // Request with a fragment that doesn't match
      const uri = vscode.Uri.parse('acacia-log:/results/test.txt#99');
      // Override the parsed URI's path/fragment to simulate the scenario
      (provider as any).documents.delete(uri.path + '#' + uri.fragment);
      const content = provider.provideTextDocumentContent(uri);
      expect(content).toBe('base content');
    });
  });

  // ── updateDocument ──

  describe('updateDocument', () => {
    it('stores content and fires change event', () => {
      const provider = new ResultDocumentProvider();
      const emitter = (provider as any)._onDidChange;

      provider.updateDocument('/results/doc.txt', 'new content');

      expect((provider as any).documents.get('/results/doc.txt')).toBe('new content');
      expect(emitter.fire).toHaveBeenCalled();
    });
  });

  // ── openResultDocument ──

  describe('openResultDocument', () => {
    const mockDoc = { uri: { scheme: 'acacia-log', toString: () => 'acacia-log:/test' } };

    it('stores content with unique path and opens document', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue(mockDoc);
      mockShowTextDocument.mockResolvedValue({});

      await provider.openResultDocument('/results/test.txt', 'test content');

      // Should have stored content
      const docs = (provider as any).documents;
      expect(docs.size).toBe(1);
      const key = Array.from(docs.keys())[0] as string;
      expect(key).toContain('/results/test.txt#');
      expect(docs.get(key)).toBe('test content');
    });

    it('increments document counter for each call', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue(mockDoc);
      mockShowTextDocument.mockResolvedValue({});

      await provider.openResultDocument('/results/a.txt', 'content a');
      await provider.openResultDocument('/results/b.txt', 'content b');

      const docs = (provider as any).documents;
      const keys = Array.from(docs.keys()) as string[];
      // After cleanup (keeps last 5), both should be present
      expect(keys.length).toBe(2);
    });

    it('applies language ID when provided', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue(mockDoc);
      mockShowTextDocument.mockResolvedValue({});

      await provider.openResultDocument('/results/test.log', 'content', 1, 'log');

      expect(vscode.languages.setTextDocumentLanguage).toHaveBeenCalledWith(mockDoc, 'log');
    });

    it('handles language ID error gracefully', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue(mockDoc);
      mockShowTextDocument.mockResolvedValue({});
      vscode.languages.setTextDocumentLanguage.mockRejectedValueOnce(new Error('Unknown language'));

      // Should not throw
      await expect(
        provider.openResultDocument('/results/test.log', 'content', 1, 'unknown-lang')
      ).resolves.toBeDefined();
    });

    it('shows error message when openTextDocument fails', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockRejectedValueOnce(new Error('Cannot open'));

      await expect(
        provider.openResultDocument('/results/test.txt', 'content')
      ).rejects.toThrow('Cannot open');

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Cannot open')
      );
    });

    it('cleans up old documents when more than 5', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue(mockDoc);
      mockShowTextDocument.mockResolvedValue({});

      // Open 7 documents
      for (let i = 0; i < 7; i++) {
        await provider.openResultDocument(`/results/doc${i}.txt`, `content ${i}`);
      }

      const docs = (provider as any).documents;
      expect(docs.size).toBeLessThanOrEqual(5);
    });
  });

  // ── Convenience methods ──

  describe('openSimilarLinesResult', () => {
    it('opens document with correct path and viewColumn', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue({ uri: { scheme: 'acacia-log', toString: () => 'mock' } });
      mockShowTextDocument.mockResolvedValue({});

      await provider.openSimilarLinesResult('pattern results');

      // Verify the document was stored under the /results/similar-lines.txt path
      const docs = (provider as any).documents;
      const keys = Array.from(docs.keys()) as string[];
      expect(keys[0]).toContain('/results/similar-lines.txt');
    });
  });

  describe('openLogChunkResult', () => {
    it('opens document with correct path', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue({ uri: { scheme: 'acacia-log', toString: () => 'mock' } });
      mockShowTextDocument.mockResolvedValue({});

      await provider.openLogChunkResult('chunk content');

      const docs = (provider as any).documents;
      const keys = Array.from(docs.keys()) as string[];
      expect(keys[0]).toContain('/results/navigate-chunk.log');
    });
  });

  describe('openTimelineResult', () => {
    it('opens document with correct path', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue({ uri: { scheme: 'acacia-log', toString: () => 'mock' } });
      mockShowTextDocument.mockResolvedValue({});

      await provider.openTimelineResult('timeline content');

      const docs = (provider as any).documents;
      const keys = Array.from(docs.keys()) as string[];
      expect(keys[0]).toContain('/results/timeline.txt');
    });
  });

  describe('openPatternSearchResultJson', () => {
    it('opens document with correct path', async () => {
      const provider = new ResultDocumentProvider();
      mockOpenTextDocument.mockResolvedValue({ uri: { scheme: 'acacia-log', toString: () => 'mock' } });
      mockShowTextDocument.mockResolvedValue({});

      await provider.openPatternSearchResultJson('{}');

      const docs = (provider as any).documents;
      const keys = Array.from(docs.keys()) as string[];
      expect(keys[0]).toContain('/results/pattern-search.json');
    });
  });

  // ── Line index cache ──

  describe('cacheLineIndex / getCachedLineIndex', () => {
    it('stores and retrieves a line index', () => {
      const mockIndex = { totalLines: 100, offsets: [0, 50, 100] } as any;
      ResultDocumentProvider.cacheLineIndex('/path/to/file.log', mockIndex);

      const cached = ResultDocumentProvider.getCachedLineIndex('/path/to/file.log');
      expect(cached).toBe(mockIndex);
    });

    it('returns undefined for uncached path', () => {
      const cached = ResultDocumentProvider.getCachedLineIndex('/not/cached.log');
      expect(cached).toBeUndefined();
    });
  });

  // ── Chunk state ──

  describe('setChunkState / getChunkState', () => {
    it('stores and retrieves chunk state', () => {
      const provider = new ResultDocumentProvider();
      const state = {
        filePath: '/path/to/file.log',
        lineIndex: { totalLines: 500 } as any,
        ctxStart: 100,
        ctxEnd: 200,
        matchedLine: 150,
        totalLines: 500,
      };

      provider.setChunkState(state);
      const retrieved = provider.getChunkState();

      expect(retrieved).toEqual(state);
    });

    it('returns undefined when no chunk state set', () => {
      const provider = new ResultDocumentProvider();
      expect(provider.getChunkState()).toBeUndefined();
    });
  });

  // ── generateHtmlContent (private) ──

  describe('generateHtmlContent (via openPatternSearchResult)', () => {
    it('throws when extensionPath is not available', async () => {
      const provider = new ResultDocumentProvider(); // no extensionPath

      await expect(
        provider.openPatternSearchResult({ test: { count: 1, line_match: ['line'] } }, '/file.log')
      ).rejects.toThrow('Extension path not available');
    });

    it('throws when template file is not found', async () => {
      const provider = new ResultDocumentProvider('/ext');
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        provider.openPatternSearchResult({ test: { count: 1, line_match: ['line'] } }, '/file.log')
      ).rejects.toThrow('Template not found');
    });

    it('injects data into HTML template and creates webview', async () => {
      const provider = new ResultDocumentProvider('/ext');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        '<html><head></head><body>template</body></html>'
      );

      await provider.openPatternSearchResult(
        { error: { count: 5, line_match: ['error line 1'] } },
        '/path/to/log.log'
      );

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'patternSearchResults',
        'Pattern Search Results',
        2, // ViewColumn.Two
        expect.objectContaining({ enableScripts: true })
      );
    });
  });
});
