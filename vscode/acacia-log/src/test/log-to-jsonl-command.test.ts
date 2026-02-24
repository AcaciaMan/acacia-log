/**
 * Unit tests for log-to-jsonl-command.ts
 * Tests the VS Code command wrapper that converts log documents to JSONL.
 */

// ── Tracking variables ───────────────────────────────────────────────────────

let capturedOpenContent: string | undefined;
let mockActiveEditor: any = undefined;
const mockShowTextDocument = jest.fn();
const mockShowErrorMessage = jest.fn();
const mockShowWarningMessage = jest.fn().mockResolvedValue('Continue');
const mockShowInformationMessage = jest.fn();
const mockOpenTextDocument = jest.fn().mockImplementation(async (opts: any) => {
  capturedOpenContent = opts?.content;
  return {
    getText: () => opts?.content ?? '',
    uri: { toString: () => 'untitled:Untitled-1', scheme: 'untitled' },
  };
});
const mockApplyEdit = jest.fn().mockResolvedValue(true);
const mockEditReplace = jest.fn();

jest.mock('vscode', () => ({
  window: {
    get activeTextEditor() { return mockActiveEditor; },
    showTextDocument: mockShowTextDocument,
    showErrorMessage: mockShowErrorMessage,
    showWarningMessage: mockShowWarningMessage,
    showInformationMessage: mockShowInformationMessage,
    withProgress: jest.fn().mockImplementation(async (_opts: any, task: any) => {
      await task({ report: jest.fn() });
    }),
  },
  workspace: {
    openTextDocument: mockOpenTextDocument,
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultVal: any) => {
        const config: Record<string, any> = {
          'jsonl.messageMode': 'firstLineMinusTimestamp',
          'jsonl.maxMultilineSize': 1000,
          'jsonl.openResultInNewEditor': true,
        };
        return config[key] ?? defaultVal;
      }),
    }),
    applyEdit: mockApplyEdit,
  },
  WorkspaceEdit: jest.fn().mockImplementation(() => ({
    replace: jest.fn(),
  })),
  Range: jest.fn((start: any, end: any) => ({ start, end })),
  Position: jest.fn((l: number, c: number) => ({ line: l, character: c })),
  Uri: {
    parse: (s: string) => ({ toString: () => s, fsPath: s, scheme: 'file' }),
  },
  ProgressLocation: { Notification: 15 },
}), { virtual: true });

// Mock format-cache
const mockGetOrDetectFormat = jest.fn();
const mockGetRegexAndFormat = jest.fn();

jest.mock('../utils/format-cache', () => ({
  getOrDetectFormat: (...args: any[]) => mockGetOrDetectFormat(...args),
  getRegexAndFormat: (...args: any[]) => mockGetRegexAndFormat(...args),
}));

// Mock luxon DateTime so parseTimestamp works without the real library
jest.mock('luxon', () => ({
  DateTime: {
    fromFormat: jest.fn().mockReturnValue({ isValid: false }),
  },
}));

import { convertToJsonl } from '../utils/log-to-jsonl-command';
import * as vscode from 'vscode';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ISO_REGEX = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

function mockDocument(content: string, uri = 'file:///test.log') {
  const lines = content.split('\n');
  return {
    uri: { toString: () => uri, fsPath: uri, scheme: 'file' },
    getText: () => content,
    lineCount: lines.length,
    lineAt: (i: number) => ({ text: lines[i] }),
    positionAt: (offset: number) => ({ line: 0, character: offset }),
  } as unknown as vscode.TextDocument;
}

function setupDetectedFormat() {
  mockGetOrDetectFormat.mockResolvedValue({
    format: {
      pattern: 'yyyy-MM-dd HH:mm:ss',
      regex: ISO_REGEX,
      groupIndex: 0,
      parseFunc: (m: string) => new Date(m.replace(' ', 'T') + 'Z'),
      score: 10,
    },
    detected: true,
    totalLines: 100,
  });
  mockGetRegexAndFormat.mockReturnValue({
    regex: ISO_REGEX,
    format: 'yyyy-MM-dd HH:mm:ss',
    useDetected: true,
  });
}

function setupNoFormat() {
  mockGetOrDetectFormat.mockResolvedValue({
    format: null,
    detected: false,
    totalLines: 0,
  });
  mockGetRegexAndFormat.mockReturnValue({
    regex: ISO_REGEX,
    format: 'yyyy-MM-dd HH:mm:ss',
    useDetected: false,
  });
}

function makeEditor(doc: any) {
  return {
    document: doc,
    edit: jest.fn().mockImplementation(async (cb: any) => {
      const editBuilder = { replace: mockEditReplace };
      cb(editBuilder);
      return true;
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('convertToJsonl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOpenContent = undefined;
    mockActiveEditor = undefined;
    mockShowWarningMessage.mockResolvedValue('Continue');
    // Restore implementation after clearAllMocks
    mockOpenTextDocument.mockImplementation(async (opts: any) => {
      capturedOpenContent = opts?.content;
      return {
        getText: () => opts?.content ?? '',
        uri: { toString: () => 'untitled:Untitled-1', scheme: 'untitled' },
      };
    });
    (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts: any, task: any) => {
      await task({ report: jest.fn() });
    });
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultVal: any) => {
        const config: Record<string, any> = {
          'jsonl.messageMode': 'firstLineMinusTimestamp',
          'jsonl.maxMultilineSize': 1000,
          'jsonl.openResultInNewEditor': true,
        };
        return config[key] ?? defaultVal;
      }),
    });
  });

  // ── Basic conversion ────────────────────────────────────────────────────

  describe('basic conversion', () => {
    it('converts 3 timestamped lines to 3 JSONL objects', async () => {
      const content = [
        '2026-01-01 10:00:00 INFO first',
        '2026-01-01 10:00:01 WARN second',
        '2026-01-01 10:00:02 ERROR third',
      ].join('\n');
      const doc = mockDocument(content);
      const editor = makeEditor(doc);
      mockActiveEditor = editor;
      setupDetectedFormat();

      await convertToJsonl();

      expect(mockOpenTextDocument).toHaveBeenCalled();
      expect(capturedOpenContent).toBeDefined();

      const lines = capturedOpenContent!.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(3);

      // Each line should be valid JSON
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('message');
        expect(parsed).toHaveProperty('text');
      }
    });

    it('groups multiline entries (stack traces)', async () => {
      const content = [
        '2026-01-01 10:00:00 ERROR something failed',
        '  at Foo.bar (file.ts:10)',
        '  at main (index.ts:5)',
        '2026-01-01 10:00:01 INFO recovered',
      ].join('\n');
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      const lines = capturedOpenContent!.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]);
      expect(first.text).toContain('at Foo.bar');
      expect(first.text).toContain('at main');
    });

    it('produces single entry with null timestamp when no timestamps found', async () => {
      const content = 'no timestamps\njust plain text\nthird line';
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupNoFormat();

      await convertToJsonl();

      const lines = capturedOpenContent!.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]);
      expect(entry.timestamp).toBeNull();
    });
  });

  // ── Format detection ────────────────────────────────────────────────────

  describe('format detection', () => {
    it('uses auto-detected format without warning', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO test');
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      expect(mockShowWarningMessage).not.toHaveBeenCalled();
      expect(mockOpenTextDocument).toHaveBeenCalled();
    });

    it('shows warning when no format detected and continues on confirm', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO test');
      mockActiveEditor = makeEditor(doc);
      setupNoFormat();
      mockShowWarningMessage.mockResolvedValue('Continue');

      await convertToJsonl();

      expect(mockShowWarningMessage).toHaveBeenCalled();
      expect(mockOpenTextDocument).toHaveBeenCalled();
    });

    it('aborts when user cancels on no format warning', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO test');
      mockActiveEditor = makeEditor(doc);
      setupNoFormat();
      mockShowWarningMessage.mockResolvedValue(undefined);

      await convertToJsonl();

      expect(mockShowWarningMessage).toHaveBeenCalled();
      expect(mockOpenTextDocument).not.toHaveBeenCalled();
    });

    it('aborts when user clicks Cancel on warning', async () => {
      const doc = mockDocument('some log content');
      mockActiveEditor = makeEditor(doc);
      setupNoFormat();
      mockShowWarningMessage.mockResolvedValue('Cancel');

      await convertToJsonl();

      expect(mockOpenTextDocument).not.toHaveBeenCalled();
    });
  });

  // ── Settings ────────────────────────────────────────────────────────────

  describe('settings', () => {
    it('opens result in new editor when openResultInNewEditor is true', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO test');
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'json' })
      );
      expect(mockShowTextDocument).toHaveBeenCalled();
    });

    it('replaces source document when openResultInNewEditor is false', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO test');
      const editor = makeEditor(doc);
      mockActiveEditor = editor;
      setupDetectedFormat();

      // Override config to return false for openResultInNewEditor
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, defaultVal: any) => {
          if (key === 'jsonl.openResultInNewEditor') { return false; }
          if (key === 'jsonl.messageMode') { return 'firstLineMinusTimestamp'; }
          if (key === 'jsonl.maxMultilineSize') { return 1000; }
          return defaultVal;
        }),
      });

      await convertToJsonl();

      expect(editor.edit).toHaveBeenCalled();
      expect(mockEditReplace).toHaveBeenCalled();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty document gracefully', async () => {
      const doc = mockDocument('');
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      // Empty string produces 1 entry with null timestamp
      // The command still completes (shows info about no timestamps or completion)
      expect(mockShowInformationMessage).toHaveBeenCalled();
    });

    it('uses documentOverride instead of active editor', async () => {
      const doc = mockDocument('2026-01-01 10:00:00 INFO override test');
      setupDetectedFormat();
      // No active editor set — the override should be used
      mockActiveEditor = undefined;

      await convertToJsonl(doc);

      // showTextDocument called at least twice: once for override doc, once for result
      expect(mockShowTextDocument).toHaveBeenCalled();
      // openTextDocument called for the JSONL result
      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'json' })
      );
    });

    it('shows error when no active editor and no override', async () => {
      mockActiveEditor = undefined;

      await convertToJsonl();

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('No active text editor')
      );
    });
  });

  // ── Output format ───────────────────────────────────────────────────────

  describe('output format', () => {
    it('produces valid JSONL where each line is valid JSON', async () => {
      const content = [
        '2026-01-01 10:00:00 INFO alpha',
        '2026-01-01 10:00:01 WARN beta',
      ].join('\n');
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      const outputLines = capturedOpenContent!.split('\n').filter(l => l.trim());
      for (const line of outputLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it('each entry has timestamp, message, and text fields', async () => {
      const content = '2026-01-01 10:00:00 INFO hello world';
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      const outputLines = capturedOpenContent!.split('\n').filter(l => l.trim());
      for (const line of outputLines) {
        const entry = JSON.parse(line);
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('message');
        expect(entry).toHaveProperty('text');
      }
    });

    it('entries are newline-delimited', async () => {
      const content = [
        '2026-01-01 10:00:00 INFO first',
        '2026-01-01 10:00:01 INFO second',
      ].join('\n');
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      // Output should contain exactly one newline between entries (no trailing)
      const rawLines = capturedOpenContent!.split('\n');
      const nonEmpty = rawLines.filter(l => l.trim());
      expect(nonEmpty).toHaveLength(2);
    });

    it('shows completion message with entry count', async () => {
      const content = [
        '2026-01-01 10:00:00 INFO first',
        '2026-01-01 10:00:01 INFO second',
        '2026-01-01 10:00:02 INFO third',
      ].join('\n');
      const doc = mockDocument(content);
      mockActiveEditor = makeEditor(doc);
      setupDetectedFormat();

      await convertToJsonl();

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('3')
      );
    });
  });
});
