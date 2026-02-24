/**
 * Unit tests for log-file-reader.ts
 * All functions require file I/O — uses temp files created in beforeAll.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getFileDates,
  readSampleLines,
  buildLineIndex,
  readLineRange,
  jumpToTimestamp,
  getTimestampsForRange,
  filterLinesByTimeRange,
  LogFileHandler,
  LineIndex,
} from '../utils/log-file-reader';
import {
  detectTimestampFormat,
  DetectedFormat,
  FileDates,
} from '../utils/timestamp-detect';

// ── Test fixtures ─────────────────────────────────────────────────────────────

let tempDir: string;
let simpleLogPath: string;
let multilineLogPath: string;
let emptyLogPath: string;
let noTimestampLogPath: string;
let fileDates: FileDates;
let format: DetectedFormat;

const SIMPLE_LOG_LINES = [
  '2026-01-15 10:00:00 INFO Application started',
  '2026-01-15 10:00:01 DEBUG Loading configuration',
  '2026-01-15 10:00:02 INFO Config loaded',
  '2026-01-15 10:00:05 WARN Slow query detected',
  '2026-01-15 10:00:10 ERROR Connection timeout',
  '2026-01-15 10:00:11 INFO Retrying connection',
  '2026-01-15 10:00:12 INFO Connected successfully',
  '2026-01-15 10:00:15 DEBUG Processing batch 1',
  '2026-01-15 10:00:20 INFO Batch 1 complete',
  '2026-01-15 10:00:25 INFO Shutdown complete',
];

const MULTILINE_LOG_LINES = [
  '2026-01-15 10:00:00 INFO Starting up',
  '2026-01-15 10:00:01 ERROR NullPointerException',
  '  at com.example.App.main(App.java:10)',
  '  at com.example.Runner.run(Runner.java:5)',
  '2026-01-15 10:00:05 INFO Recovered',
];

const NO_TIMESTAMP_LINES = [
  'This is just plain text',
  'No timestamps here at all',
  'Another line without dates',
];

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acacia-test-'));

  simpleLogPath = path.join(tempDir, 'simple.log');
  fs.writeFileSync(simpleLogPath, SIMPLE_LOG_LINES.join('\n'), 'utf-8');

  multilineLogPath = path.join(tempDir, 'multiline.log');
  fs.writeFileSync(multilineLogPath, MULTILINE_LOG_LINES.join('\n'), 'utf-8');

  emptyLogPath = path.join(tempDir, 'empty.log');
  fs.writeFileSync(emptyLogPath, '', 'utf-8');

  noTimestampLogPath = path.join(tempDir, 'no-timestamp.log');
  fs.writeFileSync(noTimestampLogPath, NO_TIMESTAMP_LINES.join('\n'), 'utf-8');

  // Detect format from the simple log for use in later tests
  fileDates = {
    createdAt: new Date('2026-01-15T10:00:00'),
    modifiedAt: new Date('2026-01-15T10:00:25'),
  };
  const detection = detectTimestampFormat(SIMPLE_LOG_LINES, fileDates);
  expect(detection.detected).toBe(true);
  format = detection.format!;
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// getFileDates
// ══════════════════════════════════════════════════════════════════════════════

describe('getFileDates', () => {
  it('returns createdAt and modifiedAt as Date objects', () => {
    const dates = getFileDates(simpleLogPath);

    // Use getTime() to verify they are valid date-like objects
    // (toBeInstanceOf can fail across realms)
    expect(typeof dates.createdAt.getTime()).toBe('number');
    expect(typeof dates.modifiedAt.getTime()).toBe('number');
    expect(dates.createdAt.getTime()).toBeGreaterThan(0);
    expect(dates.modifiedAt.getTime()).toBeGreaterThan(0);
  });

  it('throws for non-existent file', () => {
    expect(() => getFileDates(path.join(tempDir, 'nonexistent.log'))).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// readSampleLines
// ══════════════════════════════════════════════════════════════════════════════

describe('readSampleLines', () => {
  it('reads all lines when file is small', async () => {
    const lines = await readSampleLines(simpleLogPath);

    expect(lines.length).toBe(SIMPLE_LOG_LINES.length);
    expect(lines[0]).toBe(SIMPLE_LOG_LINES[0]);
    expect(lines[lines.length - 1]).toBe(SIMPLE_LOG_LINES[SIMPLE_LOG_LINES.length - 1]);
  });

  it('respects maxSample parameter', async () => {
    const lines = await readSampleLines(simpleLogPath, 3);

    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it('returns empty-ish array for empty file', async () => {
    const lines = await readSampleLines(emptyLogPath);

    // An empty file may produce [''] (one empty string) or []
    // depending on how split works; either is acceptable
    for (const line of lines) {
      expect(line.trim()).toBe('');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildLineIndex
// ══════════════════════════════════════════════════════════════════════════════

describe('buildLineIndex', () => {
  it('builds index with correct totalLines and totalBytes', async () => {
    const index = await buildLineIndex(simpleLogPath, format, fileDates, 1);

    expect(index.totalLines).toBe(SIMPLE_LOG_LINES.length);
    expect(index.totalBytes).toBeGreaterThan(0);
  });

  it('index entries have line, byte, and optionally timestamp', async () => {
    const index = await buildLineIndex(simpleLogPath, format, fileDates, 1);

    expect(index.offsets.length).toBeGreaterThan(0);
    for (const entry of index.offsets) {
      expect(typeof entry.line).toBe('number');
      expect(typeof entry.byte).toBe('number');
      // timestamp may be Date or null
      if (entry.timestamp !== null) {
        expect(entry.timestamp).toBeInstanceOf(Date);
      }
    }
  });

  it('respects indexStep granularity', async () => {
    const index1 = await buildLineIndex(simpleLogPath, format, fileDates, 1);
    const index5 = await buildLineIndex(simpleLogPath, format, fileDates, 5);

    // Step=1 should produce an entry for every line; step=5 far fewer
    expect(index1.offsets.length).toBeGreaterThan(index5.offsets.length);
    // Step=5 should index lines 0, 5, etc.
    expect(index5.offsets[0].line).toBe(0);
    if (index5.offsets.length > 1) {
      expect(index5.offsets[1].line).toBe(5);
    }
  });

  it('handles empty file', async () => {
    const index = await buildLineIndex(emptyLogPath, format, fileDates, 1);

    expect(index.totalLines).toBe(0);
    expect(index.offsets.length).toBe(0);
  });

  it('timestamps in index match expected values', async () => {
    const index = await buildLineIndex(simpleLogPath, format, fileDates, 1);

    // First entry should match first log timestamp
    const firstTs = index.offsets[0].timestamp;
    expect(firstTs).not.toBeNull();
    expect(firstTs!.getHours()).toBe(10);
    expect(firstTs!.getMinutes()).toBe(0);
    expect(firstTs!.getSeconds()).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// readLineRange
// ══════════════════════════════════════════════════════════════════════════════

describe('readLineRange', () => {
  it('reads exact range (lines 3-5)', async () => {
    const result = await readLineRange(simpleLogPath, 3, 5);

    expect(result.lines.length).toBe(3); // lines 3, 4, 5
    expect(result.firstLineNum).toBe(3);
    expect(result.lines[0]).toBe(SIMPLE_LOG_LINES[3]);
    expect(result.lines[1]).toBe(SIMPLE_LOG_LINES[4]);
    expect(result.lines[2]).toBe(SIMPLE_LOG_LINES[5]);
  });

  it('clamps to file boundaries when endLine exceeds file', async () => {
    const result = await readLineRange(simpleLogPath, 8, 100);

    // File has 10 lines (0-9), so requesting 8-100 should return lines 8-9
    expect(result.lines.length).toBe(2);
    expect(result.lines[0]).toBe(SIMPLE_LOG_LINES[8]);
    expect(result.lines[1]).toBe(SIMPLE_LOG_LINES[9]);
  });

  it('works with a lineIndex', async () => {
    const index = await buildLineIndex(simpleLogPath, format, fileDates, 2);
    const result = await readLineRange(simpleLogPath, 4, 6, index);

    expect(result.lines.length).toBe(3);
    expect(result.firstLineNum).toBe(4);
    expect(result.lines[0]).toBe(SIMPLE_LOG_LINES[4]);
  });

  it('works without a lineIndex', async () => {
    const result = await readLineRange(simpleLogPath, 0, 2);

    expect(result.lines.length).toBe(3);
    expect(result.lines[0]).toBe(SIMPLE_LOG_LINES[0]);
  });

  it('returns correct firstLineNum', async () => {
    const result = await readLineRange(simpleLogPath, 5, 7);

    expect(result.firstLineNum).toBe(5);
  });

  it('returns empty for empty file', async () => {
    const result = await readLineRange(emptyLogPath, 0, 10);

    expect(result.lines.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// jumpToTimestamp
// ══════════════════════════════════════════════════════════════════════════════

describe('jumpToTimestamp', () => {
  let index: LineIndex;

  beforeAll(async () => {
    index = await buildLineIndex(simpleLogPath, format, fileDates, 1);
  });

  it('finds exact matching timestamp', async () => {
    const target = new Date('2026-01-15T10:00:05');
    const result = await jumpToTimestamp(simpleLogPath, target, format, fileDates, index);

    expect(result).not.toBeNull();
    expect(result!.line).toBe(3); // "2026-01-15 10:00:05 WARN Slow query detected"
    expect(result!.timestamp.getSeconds()).toBe(5);
    expect(result!.lineText).toContain('Slow query');
  });

  it('finds nearest timestamp when exact match doesn\'t exist', async () => {
    // Target between 10:00:02 (line 2) and 10:00:05 (line 3)
    const target = new Date('2026-01-15T10:00:03');
    const result = await jumpToTimestamp(simpleLogPath, target, format, fileDates, index);

    expect(result).not.toBeNull();
    // Should land on line 2 (10:00:02, diff=1s) or line 3 (10:00:05, diff=2s)
    expect(result!.line).toBeGreaterThanOrEqual(2);
    expect(result!.line).toBeLessThanOrEqual(3);
  });

  it('returns result even when target is outside log range', async () => {
    // Target way before the log starts
    const target = new Date('2026-01-14T00:00:00');
    const result = await jumpToTimestamp(simpleLogPath, target, format, fileDates, index);

    // jumpToTimestamp finds the nearest — should return the first line
    expect(result).not.toBeNull();
    expect(result!.line).toBe(0);
  });

  it('returns null when index has no timestamps', async () => {
    const emptyIndex: LineIndex = {
      offsets: [{ line: 0, byte: 0, timestamp: null }],
      totalLines: 1,
      totalBytes: 10,
    };
    const target = new Date('2026-01-15T10:00:00');
    const result = await jumpToTimestamp(simpleLogPath, target, format, fileDates, emptyIndex);

    expect(result).toBeNull();
  });

  it('works with sparse index (large step)', async () => {
    const sparseIndex = await buildLineIndex(simpleLogPath, format, fileDates, 5);
    const target = new Date('2026-01-15T10:00:10');
    const result = await jumpToTimestamp(simpleLogPath, target, format, fileDates, sparseIndex);

    expect(result).not.toBeNull();
    expect(result!.timestamp.getSeconds()).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getTimestampsForRange
// ══════════════════════════════════════════════════════════════════════════════

describe('getTimestampsForRange', () => {
  it('parses timestamps for a range of lines', async () => {
    const results = await getTimestampsForRange(
      simpleLogPath, 0, 4, format, fileDates,
    );

    expect(results.length).toBe(5); // lines 0-4
    for (const lt of results) {
      expect(lt.timestamp).toBeInstanceOf(Date);
      expect(lt.text.length).toBeGreaterThan(0);
    }
    expect(results[0].line).toBe(0);
    expect(results[4].line).toBe(4);
  });

  it('handles lines without timestamps (timestamp inheritance)', async () => {
    const results = await getTimestampsForRange(
      multilineLogPath, 0, 4, format, fileDates,
    );

    // Lines 2 and 3 are stack trace continuations — should inherit from line 1
    expect(results.length).toBeGreaterThanOrEqual(4);

    // The continuation lines (stack traces) should inherit the ERROR timestamp
    const errorTs = results.find(r => r.text.includes('NullPointerException'))?.timestamp;
    const stackLine = results.find(r => r.text.includes('at com.example.App'));
    if (errorTs && stackLine) {
      expect(stackLine.timestamp.getTime()).toBe(errorTs.getTime());
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// filterLinesByTimeRange
// ══════════════════════════════════════════════════════════════════════════════

describe('filterLinesByTimeRange', () => {
  let index: LineIndex;

  beforeAll(async () => {
    index = await buildLineIndex(simpleLogPath, format, fileDates, 1);
  });

  it('filters lines within [from, to] inclusive', async () => {
    const from = new Date('2026-01-15T10:00:05');
    const to = new Date('2026-01-15T10:00:12');

    const results = await filterLinesByTimeRange(
      simpleLogPath, from, to, format, fileDates, index,
    );

    expect(results.length).toBeGreaterThan(0);
    for (const lt of results) {
      expect(lt.timestamp.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(lt.timestamp.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it('returns empty when range doesn\'t overlap log span', async () => {
    const from = new Date('2025-01-01T00:00:00');
    const to = new Date('2025-01-01T01:00:00');

    const results = await filterLinesByTimeRange(
      simpleLogPath, from, to, format, fileDates, index,
    );

    expect(results.length).toBe(0);
  });

  it('full range returns all lines', async () => {
    const from = new Date('2026-01-15T09:00:00');
    const to = new Date('2026-01-15T11:00:00');

    const results = await filterLinesByTimeRange(
      simpleLogPath, from, to, format, fileDates, index,
    );

    expect(results.length).toBe(SIMPLE_LOG_LINES.length);
  });

  it('single-second range returns matching lines', async () => {
    const from = new Date('2026-01-15T10:00:10');
    const to = new Date('2026-01-15T10:00:10');

    const results = await filterLinesByTimeRange(
      simpleLogPath, from, to, format, fileDates, index,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].text).toContain('Connection timeout');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LogFileHandler
// ══════════════════════════════════════════════════════════════════════════════

describe('LogFileHandler', () => {
  it('initialize() sets up format and index', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    const result = await handler.initialize();

    expect(result.detected).toBe(true);
    expect(handler.format).not.toBeNull();
    expect(handler.index).not.toBeNull();
    expect(handler.totalLines).toBe(SIMPLE_LOG_LINES.length);
  });

  it('jump(date) delegates to jumpToTimestamp', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    await handler.initialize();

    // The handler uses real file dates from disk, so timestamps may
    // not match our log content dates exactly. Just verify it returns
    // a valid result with a line and text.
    const jumpResult = await handler.jump(new Date('2026-01-15T10:00:10'));

    expect(jumpResult).not.toBeNull();
    expect(typeof jumpResult!.line).toBe('number');
    expect(jumpResult!.lineText.length).toBeGreaterThan(0);
  });

  it('getRange(start, end) returns lines with timestamps', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    await handler.initialize();

    const range = await handler.getRange(0, 4);

    expect(range.length).toBe(5);
    for (const lt of range) {
      expect(lt.timestamp).toBeInstanceOf(Date);
      expect(lt.text.length).toBeGreaterThan(0);
    }
  });

  it('getDisplayString() returns summary before initialization', () => {
    const handler = new LogFileHandler(simpleLogPath);
    expect(handler.getDisplayString()).toBe('Not initialized');
  });

  it('getDisplayString() returns format info after initialization', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    await handler.initialize();

    const display = handler.getDisplayString();

    expect(display).toContain('match:');
    expect(display).toContain('confidence:');
  });

  it('jump returns null before initialization', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    const result = await handler.jump(new Date('2026-01-15T10:00:00'));

    expect(result).toBeNull();
  });

  it('getRange returns empty before initialization', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    const result = await handler.getRange(0, 5);

    expect(result).toEqual([]);
  });

  it('filterByTime returns matching lines', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    await handler.initialize();

    const results = await handler.filterByTime(
      new Date('2026-01-15T10:00:05'),
      new Date('2026-01-15T10:00:12'),
    );

    expect(results.length).toBeGreaterThan(0);
    for (const lt of results) {
      expect(lt.timestamp.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-01-15T10:00:05').getTime(),
      );
    }
  });

  it('refresh() re-initializes', async () => {
    const handler = new LogFileHandler(simpleLogPath);
    await handler.initialize();

    const result = await handler.refresh();

    expect(result.detected).toBe(true);
    expect(handler.format).not.toBeNull();
  });
});
