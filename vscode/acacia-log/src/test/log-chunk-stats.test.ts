/**
 * Unit tests for log-chunk-stats.ts
 * All tested functions are pure — no mocking needed.
 */

import {
  computeDescriptiveStats,
  extractAllGapsFromIndex,
  detectOutliers,
  DescriptiveStats,
} from '../utils/log-chunk-stats';
import { GapRecord } from '../utils/log-gap-finder';
import { LineIndex } from '../utils/log-file-reader';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a LineIndex from an array of { line, timestamp } entries */
function makeLineIndex(
  entries: Array<{ line: number; byte?: number; timestamp?: Date | null }>,
  totalLines = 100,
  totalBytes = 10000,
): LineIndex {
  return {
    offsets: entries.map((e) => ({
      line: e.line,
      byte: e.byte ?? e.line * 100,
      timestamp: e.timestamp === undefined ? null : (e.timestamp as Date | null) as any,
    })),
    totalLines,
    totalBytes,
  };
}

/** Build a GapRecord from minimal fields */
function makeGap(
  line: number,
  timestampMs: number,
  nextTimestampMs: number,
  text = '',
): GapRecord {
  return {
    line,
    timestamp: new Date(timestampMs),
    nextTimestamp: new Date(nextTimestampMs),
    durationMs: nextTimestampMs - timestampMs,
    text,
  };
}

/** Build N gap records with the given duration */
function makeUniformGaps(count: number, durationMs: number): GapRecord[] {
  const gaps: GapRecord[] = [];
  let ts = Date.UTC(2026, 0, 15, 10, 0, 0);
  for (let i = 0; i < count; i++) {
    gaps.push(makeGap(i, ts, ts + durationMs));
    ts += durationMs;
  }
  return gaps;
}

// ══════════════════════════════════════════════════════════════════════════════
// computeDescriptiveStats
// ══════════════════════════════════════════════════════════════════════════════

describe('computeDescriptiveStats — single value', () => {
  it('returns correct stats for [100]', () => {
    const s = computeDescriptiveStats([100]);

    expect(s.count).toBe(1);
    expect(s.mean).toBe(100);
    expect(s.median).toBe(100);
    expect(s.min).toBe(100);
    expect(s.max).toBe(100);
    expect(s.stdDev).toBe(0);
    expect(s.p90).toBe(100);
    expect(s.p95).toBe(100);
    expect(s.p99).toBe(100);
  });
});

describe('computeDescriptiveStats — two values', () => {
  it('computes mean and median for [10, 20]', () => {
    const s = computeDescriptiveStats([10, 20]);

    expect(s.count).toBe(2);
    expect(s.mean).toBe(15);
    expect(s.median).toBe(15);
    expect(s.min).toBe(10);
    expect(s.max).toBe(20);
  });
});

describe('computeDescriptiveStats — known distribution', () => {
  it('computes correct stats for [1..10]', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s = computeDescriptiveStats(data);

    expect(s.count).toBe(10);
    expect(s.mean).toBeCloseTo(5.5, 5);
    expect(s.median).toBeCloseTo(5.5, 5);
    expect(s.min).toBe(1);
    expect(s.max).toBe(10);

    // Population stdDev for 1..10 = sqrt(8.25) ≈ 2.8723
    expect(s.stdDev).toBeCloseTo(Math.sqrt(8.25), 3);

    // Skewness should be ~0 for a symmetric distribution
    expect(s.skewness).toBeCloseTo(0, 3);

    // Percentiles
    expect(s.p90).toBeGreaterThanOrEqual(9);
    expect(s.p95).toBeGreaterThanOrEqual(9);
    expect(s.p99).toBeGreaterThanOrEqual(9);
    expect(s.p90).toBeLessThanOrEqual(10);
  });
});

describe('computeDescriptiveStats — uniform values', () => {
  it('returns stdDev=0 and skewness=0 for [5,5,5,5]', () => {
    const s = computeDescriptiveStats([5, 5, 5, 5]);

    expect(s.count).toBe(4);
    expect(s.mean).toBe(5);
    expect(s.median).toBe(5);
    expect(s.min).toBe(5);
    expect(s.max).toBe(5);
    expect(s.stdDev).toBe(0);
    expect(s.skewness).toBe(0);
    expect(s.kurtosis).toBe(0);
  });
});

describe('computeDescriptiveStats — skewed distribution', () => {
  it('detects positive skewness for [1,1,1,1,100]', () => {
    const s = computeDescriptiveStats([1, 1, 1, 1, 100]);

    expect(s.count).toBe(5);
    expect(s.mean).toBeCloseTo(20.8, 1);
    expect(s.median).toBe(1);
    expect(s.skewness).toBeGreaterThan(0); // right-skewed
  });
});

describe('computeDescriptiveStats — percentiles', () => {
  it('computes p90, p95, p99 for sorted 1..100', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    const s = computeDescriptiveStats(data);

    // p90 ≈ 90.1, p95 ≈ 95.05, p99 ≈ 99.01 (linear interpolation)
    expect(s.p90).toBeCloseTo(90.1, 0);
    expect(s.p95).toBeCloseTo(95.05, 0);
    expect(s.p99).toBeCloseTo(99.01, 0);
  });

  it('percentiles equal min/max for single value', () => {
    const s = computeDescriptiveStats([42]);
    expect(s.p90).toBe(42);
    expect(s.p95).toBe(42);
    expect(s.p99).toBe(42);
  });
});

describe('computeDescriptiveStats — large dataset', () => {
  it('handles 1000+ values for numerical stability', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i + 1);
    const s = computeDescriptiveStats(data);

    expect(s.count).toBe(1000);
    expect(s.mean).toBeCloseTo(500.5, 5);
    expect(s.median).toBeCloseTo(500.5, 1);
    expect(s.min).toBe(1);
    expect(s.max).toBe(1000);
    expect(s.stdDev).toBeGreaterThan(0);
    expect(s.skewness).toBeCloseTo(0, 1); // symmetric
  });

  it('handles 10000 values', () => {
    const data = Array.from({ length: 10000 }, () => Math.random() * 1000);
    const s = computeDescriptiveStats(data);

    expect(s.count).toBe(10000);
    expect(s.mean).toBeGreaterThan(0);
    expect(s.stdDev).toBeGreaterThan(0);
    expect(s.min).toBeLessThanOrEqual(s.max);
    expect(s.p90).toBeLessThanOrEqual(s.p95);
    expect(s.p95).toBeLessThanOrEqual(s.p99);
  });
});

describe('computeDescriptiveStats — empty array', () => {
  it('returns zeroed stats for empty input', () => {
    const s = computeDescriptiveStats([]);

    expect(s.count).toBe(0);
    expect(s.mean).toBe(0);
    expect(s.median).toBe(0);
    expect(s.min).toBe(0);
    expect(s.max).toBe(0);
    expect(s.p90).toBe(0);
    expect(s.p95).toBe(0);
    expect(s.p99).toBe(0);
    expect(s.stdDev).toBe(0);
    expect(s.skewness).toBe(0);
    expect(s.kurtosis).toBe(0);
  });
});

describe('computeDescriptiveStats — kurtosis', () => {
  it('computes excess kurtosis (0 for normal-like)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s = computeDescriptiveStats(data);

    // Uniform-ish distribution has negative excess kurtosis
    expect(typeof s.kurtosis).toBe('number');
    expect(isFinite(s.kurtosis)).toBe(true);
  });

  it('computes kurtosis=0 for uniform values', () => {
    const s = computeDescriptiveStats([3, 3, 3, 3, 3]);
    expect(s.kurtosis).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// extractAllGapsFromIndex
// ══════════════════════════════════════════════════════════════════════════════

describe('extractAllGapsFromIndex — simple index', () => {
  it('extracts 2 gaps from 3 timestamped entries', () => {
    const t1 = new Date('2026-01-15T10:00:00');
    const t2 = new Date('2026-01-15T10:05:00');
    const t3 = new Date('2026-01-15T10:10:00');

    const index = makeLineIndex([
      { line: 0, timestamp: t1 },
      { line: 10, timestamp: t2 },
      { line: 20, timestamp: t3 },
    ]);

    const gaps = extractAllGapsFromIndex(index);

    expect(gaps).toHaveLength(2);
    expect(gaps[0].line).toBe(0);
    expect(gaps[0].timestamp).toEqual(t1);
    expect(gaps[0].nextTimestamp).toEqual(t2);
    expect(gaps[0].durationMs).toBe(5 * 60 * 1000); // 5 minutes
    expect(gaps[1].line).toBe(10);
    expect(gaps[1].durationMs).toBe(5 * 60 * 1000);
  });
});

describe('extractAllGapsFromIndex — missing timestamps', () => {
  it('skips entries without timestamps', () => {
    const t1 = new Date('2026-01-15T10:00:00');
    const t2 = new Date('2026-01-15T10:10:00');

    const index = makeLineIndex([
      { line: 0, timestamp: t1 },
      { line: 5, timestamp: null },
      { line: 10, timestamp: t2 },
    ]);

    const gaps = extractAllGapsFromIndex(index);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].line).toBe(0);
    expect(gaps[0].durationMs).toBe(10 * 60 * 1000); // 10 minutes
  });

  it('skips all entries if none have timestamps', () => {
    const index = makeLineIndex([
      { line: 0, timestamp: null },
      { line: 10, timestamp: null },
    ]);

    const gaps = extractAllGapsFromIndex(index);
    expect(gaps).toHaveLength(0);
  });
});

describe('extractAllGapsFromIndex — single entry', () => {
  it('returns empty for a single timestamped entry', () => {
    const index = makeLineIndex([
      { line: 0, timestamp: new Date('2026-01-15T10:00:00') },
    ]);

    const gaps = extractAllGapsFromIndex(index);
    expect(gaps).toHaveLength(0);
  });
});

describe('extractAllGapsFromIndex — empty index', () => {
  it('returns empty array for empty index', () => {
    const index = makeLineIndex([]);
    const gaps = extractAllGapsFromIndex(index);
    expect(gaps).toHaveLength(0);
  });
});

describe('extractAllGapsFromIndex — non-positive gaps', () => {
  it('excludes zero-duration gaps', () => {
    const t = new Date('2026-01-15T10:00:00');

    const index = makeLineIndex([
      { line: 0, timestamp: t },
      { line: 10, timestamp: t },  // same timestamp → 0 duration
      { line: 20, timestamp: new Date('2026-01-15T10:05:00') },
    ]);

    const gaps = extractAllGapsFromIndex(index);

    // Only the gap from t to t+5min should be present
    expect(gaps).toHaveLength(1);
    expect(gaps[0].durationMs).toBe(5 * 60 * 1000);
  });

  it('excludes negative-duration gaps (non-monotonic timestamps)', () => {
    const t1 = new Date('2026-01-15T10:10:00');
    const t2 = new Date('2026-01-15T10:05:00'); // earlier than t1
    const t3 = new Date('2026-01-15T10:15:00');

    const index = makeLineIndex([
      { line: 0, timestamp: t1 },
      { line: 10, timestamp: t2 },
      { line: 20, timestamp: t3 },
    ]);

    const gaps = extractAllGapsFromIndex(index);

    // t1→t2 is negative, excluded; t2→t3 is positive
    const positiveGaps = gaps.filter((g) => g.durationMs > 0);
    expect(positiveGaps.length).toBe(gaps.length);
  });
});

describe('extractAllGapsFromIndex — gap fields', () => {
  it('populates all fields correctly', () => {
    const t1 = new Date('2026-01-15T10:00:00');
    const t2 = new Date('2026-01-15T10:30:00');

    const index = makeLineIndex([
      { line: 42, byte: 5000, timestamp: t1 },
      { line: 84, byte: 10000, timestamp: t2 },
    ]);

    const gaps = extractAllGapsFromIndex(index);

    expect(gaps).toHaveLength(1);
    const g = gaps[0];
    expect(g.line).toBe(42);
    expect(g.timestamp).toEqual(t1);
    expect(g.nextTimestamp).toEqual(t2);
    expect(g.durationMs).toBe(30 * 60 * 1000);
    expect(g.text).toBe(''); // text is empty by default
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// detectOutliers
// ══════════════════════════════════════════════════════════════════════════════

describe('detectOutliers — no outliers', () => {
  it('returns empty for uniform-duration gaps', () => {
    const gaps = makeUniformGaps(10, 1000);
    const outliers = detectOutliers(gaps);

    expect(outliers).toHaveLength(0);
  });
});

describe('detectOutliers — clear outliers', () => {
  it('detects one very large gap among varied data', () => {
    // Use varied durations so IQR > 0
    const base = Date.UTC(2026, 0, 15, 10, 0, 0);
    const durations = [1000, 1200, 1100, 1300, 900, 1050, 950, 1150, 1250, 1000];
    const gaps: GapRecord[] = [];
    let ts = base;
    for (const d of durations) {
      gaps.push(makeGap(gaps.length, ts, ts + d));
      ts += d;
    }
    // Add a huge outlier
    const bigGap = makeGap(99, ts, ts + 86400000); // 24h gap
    gaps.push(bigGap);

    const outliers = detectOutliers(gaps);

    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].durationMs).toBe(bigGap.durationMs);
  });

  it('returns outliers sorted by duration descending', () => {
    const base = Date.UTC(2026, 0, 15, 10, 0, 0);
    const durations = [1000, 1200, 1100, 1300, 900, 1050, 950, 1150, 1250, 1000];
    const gaps: GapRecord[] = [];
    let ts = base;
    for (const d of durations) {
      gaps.push(makeGap(gaps.length, ts, ts + d));
      ts += d;
    }
    const big1 = makeGap(90, ts, ts + 3600000); // 1h
    const big2 = makeGap(91, ts + 3600000, ts + 3600000 + 82800000); // 23h
    gaps.push(big1, big2);

    const outliers = detectOutliers(gaps);

    if (outliers.length >= 2) {
      for (let i = 0; i < outliers.length - 1; i++) {
        expect(outliers[i].durationMs).toBeGreaterThanOrEqual(outliers[i + 1].durationMs);
      }
    }
  });
});

describe('detectOutliers — custom multiplier', () => {
  it('lower multiplier catches more outliers', () => {
    const gaps = makeUniformGaps(8, 1000);
    // Add moderate outliers
    gaps.push(makeGap(20, Date.UTC(2026, 0, 15, 11), Date.UTC(2026, 0, 15, 11, 0, 5))); // 5s
    gaps.push(makeGap(21, Date.UTC(2026, 0, 15, 12), Date.UTC(2026, 0, 15, 12, 0, 10))); // 10s

    const outliersDefault = detectOutliers(gaps, 1.5);
    const outliersStrict = detectOutliers(gaps, 0.5);

    // Stricter multiplier should catch at least as many outliers
    expect(outliersStrict.length).toBeGreaterThanOrEqual(outliersDefault.length);
  });

  it('higher multiplier catches fewer outliers', () => {
    const gaps = makeUniformGaps(8, 1000);
    gaps.push(makeGap(20, Date.UTC(2026, 0, 15, 11), Date.UTC(2026, 0, 15, 11, 0, 5)));

    const outliersDefault = detectOutliers(gaps, 1.5);
    const outliersLax = detectOutliers(gaps, 3.0);

    expect(outliersLax.length).toBeLessThanOrEqual(outliersDefault.length);
  });
});

describe('detectOutliers — all same values', () => {
  it('returns empty when all gaps have the same duration', () => {
    const gaps = makeUniformGaps(10, 5000);
    const outliers = detectOutliers(gaps);

    expect(outliers).toHaveLength(0);
  });
});

describe('detectOutliers — empty input', () => {
  it('returns empty for empty input', () => {
    const outliers = detectOutliers([]);
    expect(outliers).toHaveLength(0);
  });
});

describe('detectOutliers — small input', () => {
  it('returns empty for fewer than 4 gaps (insufficient for IQR)', () => {
    const gaps = makeUniformGaps(3, 1000);
    const outliers = detectOutliers(gaps);

    expect(outliers).toHaveLength(0);
  });

  it('handles exactly 4 gaps', () => {
    const gaps = [
      makeGap(0, 0, 1000),
      makeGap(1, 1000, 2000),
      makeGap(2, 2000, 3000),
      makeGap(3, 3000, 1000000), // big outlier
    ];
    const outliers = detectOutliers(gaps);

    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].durationMs).toBe(997000);
  });
});

describe('detectOutliers — integration with extractAllGapsFromIndex', () => {
  it('pipeline: extract gaps then detect outliers', () => {
    const base = Date.UTC(2026, 0, 15, 10, 0, 0);
    const entries = [];
    // 10 entries with varied gaps (so IQR > 0)
    const minuteGaps = [60000, 65000, 55000, 70000, 50000, 62000, 58000, 67000, 53000];
    let ts = base;
    entries.push({ line: 0, timestamp: new Date(ts) });
    for (let i = 0; i < minuteGaps.length; i++) {
      ts += minuteGaps[i];
      entries.push({ line: (i + 1) * 10, timestamp: new Date(ts) });
    }
    // Add 1 entry with a 1-hour gap (clear outlier)
    ts += 3600000;
    entries.push({ line: 100, timestamp: new Date(ts) });

    const index = makeLineIndex(entries);
    const gaps = extractAllGapsFromIndex(index);
    const outliers = detectOutliers(gaps);

    expect(gaps.length).toBe(10);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    // The outlier should be the 1-hour gap
    expect(outliers[0].durationMs).toBe(3600000);
  });
});
