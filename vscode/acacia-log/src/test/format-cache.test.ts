/**
 * Unit tests for format-cache.ts
 * Covers caching, fallback to VS Code config, and format detection.
 */

// vscode is automatically mocked via __mocks__/vscode.js

// Mock log-file-reader to avoid filesystem access
jest.mock('../utils/log-file-reader', () => {
  return {
    LogFileHandler: jest.fn().mockImplementation((filePath: string) => {
      return {
        filePath,
        totalLines: 100,
        initialize: jest.fn().mockResolvedValue({
          detected: true,
          format: {
            pattern: 'yyyy-MM-dd HH:mm:ss',
            regex: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
            groupIndex: 0,
            parseFunc: (match: string) => new Date(match.replace(' ', 'T') + 'Z'),
            score: 10,
          },
        }),
      };
    }),
  };
});

import {
  getOrDetectFormat,
  getCachedFormat,
  clearFormatCache,
  clearAllFormatCache,
  getRegexAndFormat,
  getRegexPatternString,
} from '../utils/format-cache';
import { DetectedFormat } from '../utils/timestamp-detect';
import { LogFileHandler } from '../utils/log-file-reader';
import { LogContext } from '../utils/log-context';
import * as vscode from 'vscode';

// ── Test helpers ──────────────────────────────────────────────────────────────

function mockDocument(uri: string, content: string) {
  const lines = content.split('\n');
  return {
    uri: { toString: () => uri, fsPath: uri },
    fileName: uri,
    getText: () => content,
    lineCount: lines.length,
    lineAt: (i: number) => ({ text: lines[i] }),
  } as unknown as vscode.TextDocument;
}

function makeDetectedFormat(overrides: Partial<DetectedFormat> = {}): DetectedFormat {
  return {
    pattern: 'yyyy-MM-dd HH:mm:ss',
    regex: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    groupIndex: 0,
    parseFunc: (match: string) => new Date(match.replace(' ', 'T') + 'Z'),
    score: 10,
    ...overrides,
  };
}

// ── getRegexAndFormat ─────────────────────────────────────────────────────────

describe('getRegexAndFormat', () => {
  it('returns detected format regex and useDetected=true when format is provided', () => {
    const detected = makeDetectedFormat();
    const result = getRegexAndFormat(detected);

    expect(result.useDetected).toBe(true);
    expect(result.regex).toBe(detected.regex);
    expect(result.format).toBe('yyyy-MM-dd HH:mm:ss');
  });

  it('falls back to workspace config when format is null', () => {
    const result = getRegexAndFormat(null);

    expect(result.useDetected).toBe(false);
    expect(result.format).toBe('yyyy-MM-dd HH:mm:ss');
    expect(result.regex).toBeInstanceOf(RegExp);
  });

  it('fallback regex matches expected date strings', () => {
    const result = getRegexAndFormat(null);

    expect(result.regex.test('2026-01-15 10:30:00')).toBe(true);
    expect(result.regex.test('no date here')).toBe(false);
  });

  it('detected format has higher priority over config', () => {
    const detected = makeDetectedFormat({
      pattern: 'dd/MM/yyyy HH:mm:ss',
      regex: /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/,
    });
    const result = getRegexAndFormat(detected);

    expect(result.useDetected).toBe(true);
    expect(result.regex).toBe(detected.regex);
    expect(result.format).toBe('dd/MM/yyyy HH:mm:ss');
  });
});

// ── getRegexPatternString ─────────────────────────────────────────────────────

describe('getRegexPatternString', () => {
  it('returns format.regex.source when detected format is provided', () => {
    const detected = makeDetectedFormat();
    const result = getRegexPatternString(detected);

    expect(result).toBe(detected.regex.source);
  });

  it('returns config value string when format is null', () => {
    const result = getRegexPatternString(null);

    expect(result).toBe('\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}');
  });
});

// ── clearAllFormatCache ───────────────────────────────────────────────────────

describe('clearAllFormatCache', () => {
  beforeEach(() => {
    LogContext.resetInstance();
    clearAllFormatCache();
  });

  it('clears everything — getCachedFormat returns null after clearing', async () => {
    const doc = mockDocument('file:///test/log1.log', '2026-01-01 10:00:00 INFO startup');
    await getOrDetectFormat(doc);

    // Should be cached now
    expect(getCachedFormat(doc)).not.toBeNull();

    clearAllFormatCache();

    // Should be cleared
    expect(getCachedFormat(doc)).toBeNull();
  });
});

// ── getCachedFormat and clearFormatCache ───────────────────────────────────────

describe('getCachedFormat and clearFormatCache', () => {
  beforeEach(() => {
    LogContext.resetInstance();
    clearAllFormatCache();
  });

  it('returns null initially for unknown document', () => {
    const doc = mockDocument('file:///unknown/file.log', 'some content');
    expect(getCachedFormat(doc)).toBeNull();
  });

  it('returns cached format after detection', async () => {
    const doc = mockDocument('file:///test/log2.log', '2026-01-01 10:00:00 INFO startup');
    await getOrDetectFormat(doc);

    const cached = getCachedFormat(doc);
    expect(cached).not.toBeNull();
    expect(cached!.pattern).toBe('yyyy-MM-dd HH:mm:ss');
  });

  it('clears only the specified document cache', async () => {
    const doc1 = mockDocument('file:///test/log-a.log', '2026-01-01 10:00:00 INFO a');
    const doc2 = mockDocument('file:///test/log-b.log', '2026-01-01 10:00:00 INFO b');

    await getOrDetectFormat(doc1);
    await getOrDetectFormat(doc2);

    expect(getCachedFormat(doc1)).not.toBeNull();
    expect(getCachedFormat(doc2)).not.toBeNull();

    clearFormatCache(doc1);

    expect(getCachedFormat(doc1)).toBeNull();
    expect(getCachedFormat(doc2)).not.toBeNull();
  });
});

// ── getOrDetectFormat ─────────────────────────────────────────────────────────

describe('getOrDetectFormat', () => {
  beforeEach(() => {
    LogContext.resetInstance();
    clearAllFormatCache();
    jest.clearAllMocks();
  });

  it('detects ISO format from document with timestamps', async () => {
    const doc = mockDocument(
      'file:///test/iso.log',
      '2026-01-01 10:00:00 INFO startup complete\n2026-01-01 10:00:01 WARN check config'
    );
    const result = await getOrDetectFormat(doc);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('yyyy-MM-dd HH:mm:ss');
  });

  it('returns detected=false when handler reports no detection', async () => {
    // Override the mock for this test to simulate no detection
    (LogFileHandler as jest.Mock).mockImplementationOnce(() => ({
      totalLines: 50,
      initialize: jest.fn().mockResolvedValue({
        detected: false,
        format: null,
      }),
    }));

    const doc = mockDocument(
      'file:///test/notime.log',
      'no timestamps here\njust plain text'
    );
    const result = await getOrDetectFormat(doc);

    expect(result.detected).toBe(false);
    expect(result.format).toBeNull();
  });

  it('caches result — second call does not invoke LogFileHandler again', async () => {
    const doc = mockDocument(
      'file:///test/cached.log',
      '2026-01-01 10:00:00 INFO cached test'
    );

    const result1 = await getOrDetectFormat(doc);
    const result2 = await getOrDetectFormat(doc);

    expect(result1.detected).toBe(true);
    expect(result2.detected).toBe(true);
    // LogFileHandler should only be constructed once since second call uses cache
    expect(LogFileHandler).toHaveBeenCalledTimes(1);
  });

  it('returns totalLines from handler', async () => {
    const doc = mockDocument(
      'file:///test/lines.log',
      '2026-01-01 10:00:00 INFO line count test'
    );
    const result = await getOrDetectFormat(doc);

    expect(result.totalLines).toBe(100); // from mock
  });

  it('handles initialization errors gracefully', async () => {
    (LogFileHandler as jest.Mock).mockImplementationOnce(() => ({
      totalLines: 0,
      initialize: jest.fn().mockRejectedValue(new Error('File not found')),
    }));

    const doc = mockDocument('file:///test/missing.log', '');
    const result = await getOrDetectFormat(doc);

    expect(result.detected).toBe(false);
    expect(result.format).toBeNull();
    expect(result.totalLines).toBe(0);
  });
});
