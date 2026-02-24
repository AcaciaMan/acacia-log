/**
 * Unit tests for similar-lines-analyzer.ts
 * Tests grouping, counting, sorting, and edge cases via temp log files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findTopSimilarLines, SimilarLinesResult } from '../utils/similar-lines-analyzer';
import { detectTimestampFormat, DetectedFormat, FileDates } from '../utils/timestamp-detect';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const fileDates: FileDates = {
  createdAt: new Date('2026-01-01'),
  modifiedAt: new Date('2026-01-31'),
};

let tmpDir: string;

function writeTempLog(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function detectFormat(filePath: string): DetectedFormat {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const result = detectTimestampFormat(lines, fileDates);
  if (!result.format) {
    throw new Error('Could not detect timestamp format');
  }
  return result.format;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'similar-lines-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Main fixture ──────────────────────────────────────────────────────────────

const MAIN_LOG = [
  '2026-01-15 10:00:00 INFO User 12345 logged in',
  '2026-01-15 10:00:01 INFO User 67890 logged in',
  '2026-01-15 10:00:02 ERROR Connection to 192.168.1.100 failed',
  '2026-01-15 10:00:03 INFO User 11111 logged in',
  '2026-01-15 10:00:04 ERROR Connection to 10.0.0.50 failed',
  '2026-01-15 10:00:05 WARN Slow query took 1234ms',
  '2026-01-15 10:00:06 WARN Slow query took 5678ms',
  '2026-01-15 10:00:07 INFO Processing batch 42',
  '2026-01-15 10:00:08 INFO Processing batch 43',
  '2026-01-15 10:00:09 INFO Processing batch 44',
].join('\n');

// ── Basic grouping ────────────────────────────────────────────────────────────

describe('findTopSimilarLines — basic grouping', () => {
  let result: SimilarLinesResult;
  let filePath: string;

  beforeAll(async () => {
    filePath = writeTempLog('main.log', MAIN_LOG);
    const format = detectFormat(filePath);
    result = await findTopSimilarLines(filePath, format, fileDates);
  });

  it('groups similar lines correctly', () => {
    // "User NNN logged in" should be grouped → count 3
    const userPattern = result.lines.find(r => r.pattern.includes('User') && r.pattern.includes('logged in'));
    expect(userPattern).toBeDefined();
    expect(userPattern!.count).toBe(3);
  });

  it('groups "Processing batch" lines together', () => {
    const batchPattern = result.lines.find(r => r.pattern.includes('Processing batch'));
    expect(batchPattern).toBeDefined();
    expect(batchPattern!.count).toBe(3);
  });

  it('groups "Connection" error lines together', () => {
    const connPattern = result.lines.find(r => r.pattern.includes('Connection') && r.pattern.includes('failed'));
    expect(connPattern).toBeDefined();
    expect(connPattern!.count).toBe(2);
  });

  it('groups "Slow query" lines together', () => {
    const slowPatterns = result.lines.filter(r => r.pattern.includes('Slow query'));
    expect(slowPatterns.length).toBeGreaterThanOrEqual(1);
    const totalSlowCount = slowPatterns.reduce((sum, p) => sum + p.count, 0);
    expect(totalSlowCount).toBe(2);
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('findTopSimilarLines — sorting', () => {
  it('returns most frequent patterns first', async () => {
    const filePath = writeTempLog('sorted.log', MAIN_LOG);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates);

    for (let i = 1; i < result.lines.length; i++) {
      expect(result.lines[i - 1].count).toBeGreaterThanOrEqual(result.lines[i].count);
    }
  });
});

// ── topN parameter ────────────────────────────────────────────────────────────

describe('findTopSimilarLines — topN', () => {
  it('limits results to topN patterns', async () => {
    const filePath = writeTempLog('topn.log', MAIN_LOG);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates, 2);

    expect(result.lines.length).toBeLessThanOrEqual(2);
    // totalUniquePatterns should still reflect the full count
    expect(result.totalUniquePatterns).toBeGreaterThanOrEqual(2);
  });
});

// ── Totals ────────────────────────────────────────────────────────────────────

describe('findTopSimilarLines — totals', () => {
  it('totalLinesAnalyzed matches actual line count', async () => {
    const filePath = writeTempLog('totals.log', MAIN_LOG);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates);

    expect(result.totalLinesAnalyzed).toBe(10);
  });

  it('totalUniquePatterns matches number of distinct normalized patterns', async () => {
    const filePath = writeTempLog('unique.log', MAIN_LOG);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates);

    // At least 4 distinct patterns (Slow query may split into 2 due to NNNNms normalization)
    expect(result.totalUniquePatterns).toBeGreaterThanOrEqual(4);
    expect(result.totalUniquePatterns).toBeLessThanOrEqual(5);
  });
});

// ── Timestamps and line numbers ───────────────────────────────────────────────

describe('findTopSimilarLines — timestamps and line numbers', () => {
  let result: SimilarLinesResult;

  beforeAll(async () => {
    const filePath = writeTempLog('timestamps.log', MAIN_LOG);
    const format = detectFormat(filePath);
    result = await findTopSimilarLines(filePath, format, fileDates);
  });

  it('captures first and last timestamps for grouped pattern', () => {
    const userPattern = result.lines.find(r => r.pattern.includes('User') && r.pattern.includes('logged in'));
    expect(userPattern).toBeDefined();
    expect(userPattern!.firstTimestamp).toBeInstanceOf(Date);
    expect(userPattern!.lastTimestamp).toBeInstanceOf(Date);
    expect(userPattern!.firstTimestamp.getTime()).toBeLessThanOrEqual(userPattern!.lastTimestamp.getTime());
  });

  it('captures correct first and last line numbers', () => {
    const userPattern = result.lines.find(r => r.pattern.includes('User') && r.pattern.includes('logged in'));
    expect(userPattern).toBeDefined();
    // "User logged in" appears on lines 1, 2, 4 (1-based)
    expect(userPattern!.firstLine).toBe(1);
    expect(userPattern!.lastLine).toBe(4);
  });

  it('exampleLine is an actual line from the file', () => {
    const lines = MAIN_LOG.split('\n');
    for (const record of result.lines) {
      expect(lines).toContain(record.exampleLine);
    }
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('findTopSimilarLines — edge cases', () => {
  it('returns empty results for empty file', async () => {
    const filePath = writeTempLog('empty.log', '');
    // No timestamp can be detected from an empty file, create a synthetic format
    const format: DetectedFormat = {
      pattern: 'yyyy-MM-dd HH:mm:ss',
      regex: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      groupIndex: 0,
      parseFunc: (match: string) => {
        const d = new Date(match.replace(' ', 'T') + 'Z');
        return isNaN(d.getTime()) ? null : d;
      },
      score: 10,
    };

    const result = await findTopSimilarLines(filePath, format, fileDates);
    expect(result.lines).toHaveLength(0);
    expect(result.totalLinesAnalyzed).toBe(0);
    expect(result.totalUniquePatterns).toBe(0);
  });

  it('handles single line file', async () => {
    const content = '2026-01-15 10:00:00 INFO Single log entry';
    const filePath = writeTempLog('single.log', content);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].count).toBe(1);
    expect(result.totalLinesAnalyzed).toBe(1);
    expect(result.totalUniquePatterns).toBe(1);
  });

  it('handles all identical lines', async () => {
    const line = '2026-01-15 10:00:00 INFO Heartbeat check ok';
    const content = Array(5).fill(line).join('\n');
    const filePath = writeTempLog('identical.log', content);
    const format = detectFormat(filePath);
    const result = await findTopSimilarLines(filePath, format, fileDates);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].count).toBe(5);
    expect(result.totalLinesAnalyzed).toBe(5);
    expect(result.totalUniquePatterns).toBe(1);
  });

  it('handles lines with no timestamps gracefully', async () => {
    // Lines without timestamps are skipped by the analyzer
    const content = [
      'no timestamp here',
      'also no timestamp',
      '2026-01-15 10:00:00 INFO Valid log line',
    ].join('\n');
    const filePath = writeTempLog('notime.log', content);
    // Use a synthetic format since detection may not work well with mostly non-timestamped lines
    const format: DetectedFormat = {
      pattern: 'yyyy-MM-dd HH:mm:ss',
      regex: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      groupIndex: 0,
      parseFunc: (match: string) => {
        const d = new Date(match.replace(' ', 'T') + 'Z');
        return isNaN(d.getTime()) ? null : d;
      },
      score: 10,
    };
    const result = await findTopSimilarLines(filePath, format, fileDates);

    // Only the one timestamped line should be analyzed
    expect(result.totalLinesAnalyzed).toBe(1);
  });
});
