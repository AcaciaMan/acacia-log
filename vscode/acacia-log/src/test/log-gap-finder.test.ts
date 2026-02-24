/**
 * Unit tests for log-gap-finder.ts
 * Pure functions tested directly; file I/O functions use temp files.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findTopGapsFromIndex,
  formatDuration,
  formatGapRecord,
  refineLargestGap,
  findSlowestRecords,
  GapRecord,
  TopGapsResult,
} from '../utils/log-gap-finder';
import { LineIndex } from '../utils/log-file-reader';
import { DetectedFormat, FileDates } from '../utils/timestamp-detect';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a LineIndex from an array of entries */
function makeLineIndex(
  entries: Array<{ line: number; byte?: number; timestamp?: Date | null }>,
  totalLines = 100,
  totalBytes = 10000,
): LineIndex {
  return {
    offsets: entries.map((e) => ({
      line: e.line,
      byte: e.byte ?? e.line * 100,
      timestamp: e.timestamp === undefined ? null : (e.timestamp as any),
    })),
    totalLines,
    totalBytes,
  };
}

/** Build a GapRecord */
function makeGap(
  line: number,
  timestamp: Date,
  nextTimestamp: Date,
  text = '',
): GapRecord {
  return {
    line,
    timestamp,
    nextTimestamp,
    durationMs: nextTimestamp.getTime() - timestamp.getTime(),
    text,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// formatDuration
// ══════════════════════════════════════════════════════════════════════════════

describe('formatDuration — milliseconds', () => {
  it('formats 0 as "0ms"', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('formats 500 as "500ms"', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats 999 as "999ms"', () => {
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats 1 as "1ms"', () => {
    expect(formatDuration(1)).toBe('1ms');
  });
});

describe('formatDuration — seconds', () => {
  it('formats 1000 as seconds', () => {
    // 1000ms = 1.00s
    expect(formatDuration(1000)).toBe('1.00s');
  });

  it('formats 1500 as seconds', () => {
    expect(formatDuration(1500)).toBe('1.50s');
  });

  it('formats 59999 as seconds', () => {
    // 59999 / 1000 = 59.999 → toFixed(2) = "60.00"
    expect(formatDuration(59999)).toBe('60.00s');
  });

  it('formats 30000 as seconds', () => {
    expect(formatDuration(30000)).toBe('30.00s');
  });
});

describe('formatDuration — minutes', () => {
  it('formats 60000 as 1m 0.0s', () => {
    expect(formatDuration(60000)).toBe('1m 0.0s');
  });

  it('formats 90000 as 1m 30.0s', () => {
    expect(formatDuration(90000)).toBe('1m 30.0s');
  });

  it('formats 120000 as 2m 0.0s', () => {
    expect(formatDuration(120000)).toBe('2m 0.0s');
  });

  it('formats 150500 as 2m 30.5s', () => {
    expect(formatDuration(150500)).toBe('2m 30.5s');
  });
});

describe('formatDuration — hours', () => {
  it('formats 3600000 as 1h 0m', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
  });

  it('formats 7200000 as 2h 0m', () => {
    expect(formatDuration(7200000)).toBe('2h 0m');
  });

  it('formats 5400000 as 1h 30m', () => {
    expect(formatDuration(5400000)).toBe('1h 30m');
  });

  it('formats 86400000 (24h) as 24h 0m', () => {
    expect(formatDuration(86400000)).toBe('24h 0m');
  });
});

describe('formatDuration — edge cases', () => {
  it('handles negative input as milliseconds', () => {
    // Negative < 1000, so falls into ms branch
    expect(formatDuration(-5)).toBe('-5ms');
  });

  it('handles very large values', () => {
    // 100 hours = 360000000ms
    const result = formatDuration(360000000);
    expect(result).toBe('100h 0m');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// formatGapRecord
// ══════════════════════════════════════════════════════════════════════════════

describe('formatGapRecord', () => {
  it('includes 1-based line number, duration, and text', () => {
    const gap = makeGap(
      9, // 0-based line 9 → displayed as line 10
      new Date('2026-01-15T10:00:00.000Z'),
      new Date('2026-01-15T10:00:05.000Z'),
      '2026-01-15 10:00:00 INFO Slow operation',
    );

    const result = formatGapRecord(gap);

    expect(result).toContain('Line 10');
    expect(result).toContain('5.00s');
    expect(result).toContain('2026-01-15');
    expect(result).toContain('>> 2026-01-15 10:00:00 INFO Slow operation');
  });

  it('includes ISO timestamps with arrow', () => {
    const gap = makeGap(
      0,
      new Date('2026-01-15T10:00:00.000Z'),
      new Date('2026-01-15T10:01:00.000Z'),
      'some text',
    );

    const result = formatGapRecord(gap);

    expect(result).toContain('→');
    expect(result).toContain('2026-01-15T10:00:00.000Z');
    expect(result).toContain('2026-01-15T10:01:00.000Z');
  });

  it('handles very short duration (millisecond gap)', () => {
    const gap = makeGap(
      0,
      new Date('2026-01-15T10:00:00.000Z'),
      new Date('2026-01-15T10:00:00.050Z'),
      'fast line',
    );

    const result = formatGapRecord(gap);

    expect(result).toContain('50ms');
    expect(result).toContain('>> fast line');
  });

  it('formats gap with empty text', () => {
    const gap = makeGap(
      0,
      new Date('2026-01-15T10:00:00.000Z'),
      new Date('2026-01-15T10:00:01.000Z'),
      '',
    );

    const result = formatGapRecord(gap);

    expect(result).toContain('Line 1');
    expect(result).toContain('>>');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// findTopGapsFromIndex
// ══════════════════════════════════════════════════════════════════════════════

describe('findTopGapsFromIndex — simple index', () => {
  it('finds top gaps from 5 timestamps, sorted descending', () => {
    const t = (min: number) => new Date(`2026-01-15T10:${String(min).padStart(2, '0')}:00.000Z`);

    const index = makeLineIndex([
      { line: 0, timestamp: t(0) },   // gap: 1 min
      { line: 10, timestamp: t(1) },  // gap: 5 min
      { line: 20, timestamp: t(6) },  // gap: 2 min
      { line: 30, timestamp: t(8) },  // gap: 10 min
      { line: 40, timestamp: t(18) },
    ]);

    const result = findTopGapsFromIndex(index);

    expect(result.gaps.length).toBe(4);
    // Should be sorted by duration descending
    expect(result.gaps[0].durationMs).toBe(10 * 60000); // 10 min
    expect(result.gaps[1].durationMs).toBe(5 * 60000);  // 5 min
    expect(result.gaps[2].durationMs).toBe(2 * 60000);  // 2 min
    expect(result.gaps[3].durationMs).toBe(1 * 60000);  // 1 min
  });
});

describe('findTopGapsFromIndex — topN parameter', () => {
  it('topN=2 returns only 2 largest gaps', () => {
    const base = new Date('2026-01-15T10:00:00.000Z').getTime();

    const index = makeLineIndex([
      { line: 0, timestamp: new Date(base) },
      { line: 10, timestamp: new Date(base + 1000) },    // 1s gap
      { line: 20, timestamp: new Date(base + 5000) },    // 4s gap
      { line: 30, timestamp: new Date(base + 6000) },    // 1s gap
      { line: 40, timestamp: new Date(base + 20000) },   // 14s gap
    ]);

    const result = findTopGapsFromIndex(index, 2);

    expect(result.gaps.length).toBe(2);
    expect(result.gaps[0].durationMs).toBe(14000); // 14s
    expect(result.gaps[1].durationMs).toBe(4000);  // 4s
  });

  it('topN larger than gap count returns all gaps', () => {
    const base = new Date('2026-01-15T10:00:00.000Z').getTime();

    const index = makeLineIndex([
      { line: 0, timestamp: new Date(base) },
      { line: 10, timestamp: new Date(base + 1000) },
      { line: 20, timestamp: new Date(base + 2000) },
    ]);

    const result = findTopGapsFromIndex(index, 100);

    expect(result.gaps.length).toBe(2);
  });
});

describe('findTopGapsFromIndex — single entry', () => {
  it('returns empty gaps for a single entry', () => {
    const index = makeLineIndex([
      { line: 0, timestamp: new Date('2026-01-15T10:00:00.000Z') },
    ]);

    const result = findTopGapsFromIndex(index);

    expect(result.gaps).toHaveLength(0);
    expect(result.totalRecords).toBe(1);
    expect(result.logSpanMs).toBe(0);
  });
});

describe('findTopGapsFromIndex — empty index', () => {
  it('handles empty index gracefully', () => {
    const index = makeLineIndex([]);

    const result = findTopGapsFromIndex(index);

    expect(result.gaps).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
    expect(result.logSpanMs).toBe(0);
  });
});

describe('findTopGapsFromIndex — totalRecords', () => {
  it('totalRecords matches count of entries with timestamps', () => {
    const base = new Date('2026-01-15T10:00:00.000Z').getTime();

    const index = makeLineIndex([
      { line: 0, timestamp: new Date(base) },
      { line: 10, timestamp: null },
      { line: 20, timestamp: new Date(base + 1000) },
      { line: 30, timestamp: null },
      { line: 40, timestamp: new Date(base + 2000) },
    ]);

    const result = findTopGapsFromIndex(index);

    expect(result.totalRecords).toBe(3); // only entries with timestamps
  });
});

describe('findTopGapsFromIndex — logSpanMs', () => {
  it('equals last timestamp minus first timestamp', () => {
    const t1 = new Date('2026-01-15T10:00:00.000Z');
    const t2 = new Date('2026-01-15T10:05:00.000Z');
    const t3 = new Date('2026-01-15T10:30:00.000Z');

    const index = makeLineIndex([
      { line: 0, timestamp: t1 },
      { line: 10, timestamp: t2 },
      { line: 20, timestamp: t3 },
    ]);

    const result = findTopGapsFromIndex(index);

    expect(result.logSpanMs).toBe(t3.getTime() - t1.getTime()); // 30 min
    expect(result.logSpanMs).toBe(30 * 60 * 1000);
  });
});

describe('findTopGapsFromIndex — entries without timestamps', () => {
  it('skips entries with null timestamps', () => {
    const base = new Date('2026-01-15T10:00:00.000Z').getTime();

    const index = makeLineIndex([
      { line: 0, timestamp: new Date(base) },
      { line: 5, timestamp: null },
      { line: 10, timestamp: new Date(base + 60000) },
    ]);

    const result = findTopGapsFromIndex(index);

    // Null-timestamp entry skipped; one gap between line 0 and line 10
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].durationMs).toBe(60000);
    expect(result.gaps[0].line).toBe(0);
  });
});

describe('findTopGapsFromIndex — all same timestamps', () => {
  it('returns no gaps when all timestamps are identical (0ms gaps)', () => {
    const t = new Date('2026-01-15T10:00:00.000Z');

    const index = makeLineIndex([
      { line: 0, timestamp: t },
      { line: 10, timestamp: t },
      { line: 20, timestamp: t },
    ]);

    const result = findTopGapsFromIndex(index);

    // 0ms gaps are skipped (durationMs <= 0)
    expect(result.gaps).toHaveLength(0);
  });
});

describe('findTopGapsFromIndex — gap text is empty', () => {
  it('gap text is empty at this stage (pre-refinement)', () => {
    const base = new Date('2026-01-15T10:00:00.000Z').getTime();

    const index = makeLineIndex([
      { line: 0, timestamp: new Date(base) },
      { line: 10, timestamp: new Date(base + 1000) },
    ]);

    const result = findTopGapsFromIndex(index);

    expect(result.gaps[0].text).toBe('');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// refineLargestGap and findSlowestRecords (file I/O)
// ══════════════════════════════════════════════════════════════════════════════

describe('refineLargestGap and findSlowestRecords — file I/O', () => {
  let tmpFile: string;
  let fileDates: FileDates;
  let format: DetectedFormat;
  let lines: string[];

  beforeAll(() => {
    // Create a temp log file with known ISO timestamps
    lines = [
      '2026-01-15 10:00:00 INFO Starting application',
      '2026-01-15 10:00:01 DEBUG Loading module A',
      '2026-01-15 10:00:02 DEBUG Loading module B',
      '2026-01-15 10:00:10 INFO Modules loaded',        // 8s gap from line 2
      '2026-01-15 10:00:11 DEBUG Connecting to DB',
      '2026-01-15 10:00:41 INFO DB connected',           // 30s gap from line 4
      '2026-01-15 10:00:42 INFO Ready',
    ];

    tmpFile = path.join(os.tmpdir(), `log-gap-finder-test-${Date.now()}.log`);
    fs.writeFileSync(tmpFile, lines.join('\n'), 'utf-8');

    fileDates = {
      createdAt: new Date('2026-01-15T10:00:00'),
      modifiedAt: new Date('2026-01-15T10:01:00'),
    };

    // Simple ISO format detector
    const regex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/;
    format = {
      pattern: 'yyyy-MM-dd HH:mm:ss',
      regex,
      groupIndex: 1,
      parseFunc: (m: string) => {
        const d = new Date(m.trim().replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
      },
      score: 1.0,
    };
  });

  afterAll(() => {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it('refineLargestGap returns a gap with text filled in', async () => {
    // Build a sparse index: just the start and 2 coarse entries
    const index = makeLineIndex([
      { line: 0, byte: 0, timestamp: new Date('2026-01-15T10:00:00') },
      { line: 3, byte: byteOffset(lines, 3), timestamp: new Date('2026-01-15T10:00:10') },
      { line: 6, byte: byteOffset(lines, 6), timestamp: new Date('2026-01-15T10:00:42') },
    ], lines.length, Buffer.byteLength(lines.join('\n')));

    const approxGap = makeGap(
      0,
      new Date('2026-01-15T10:00:00'),
      new Date('2026-01-15T10:00:10'),
      '',
    );

    const refined = await refineLargestGap(tmpFile, approxGap, index, format, fileDates);

    expect(refined).toBeDefined();
    expect(refined.durationMs).toBeGreaterThan(0);
    // The refined gap should have text filled in
    expect(refined.text.length).toBeGreaterThan(0);
  });

  it('findSlowestRecords returns gaps in descending duration order', async () => {
    // Build a sparse index matching the file
    const index = makeLineIndex([
      { line: 0, byte: 0, timestamp: new Date('2026-01-15T10:00:00') },
      { line: 3, byte: byteOffset(lines, 3), timestamp: new Date('2026-01-15T10:00:10') },
      { line: 5, byte: byteOffset(lines, 5), timestamp: new Date('2026-01-15T10:00:41') },
      { line: 6, byte: byteOffset(lines, 6), timestamp: new Date('2026-01-15T10:00:42') },
    ], lines.length, Buffer.byteLength(lines.join('\n')));

    const result = await findSlowestRecords(tmpFile, index, format, fileDates, 10);

    expect(result.gaps.length).toBeGreaterThan(0);
    // Verify descending order
    for (let i = 0; i < result.gaps.length - 1; i++) {
      expect(result.gaps[i].durationMs).toBeGreaterThanOrEqual(result.gaps[i + 1].durationMs);
    }
    expect(result.totalRecords).toBe(4);
    expect(result.logSpanMs).toBe(42000); // 42 seconds span
  });

  it('findSlowestRecords handles empty index', async () => {
    const index = makeLineIndex([]);

    const result = await findSlowestRecords(tmpFile, index, format, fileDates, 10);

    expect(result.gaps).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
  });
});

// ── Helper: compute byte offset of line N in an array of lines ────────

function byteOffset(lines: string[], lineNum: number): number {
  let offset = 0;
  for (let i = 0; i < lineNum; i++) {
    offset += Buffer.byteLength(lines[i], 'utf-8') + 1; // +1 for \n
  }
  return offset;
}
