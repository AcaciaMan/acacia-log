/**
 * Descriptive statistics for log file indexed chunk durations.
 *
 * A "chunk" is the time interval between two consecutive timestamped entries
 * in the sparse line index. Durations are expressed in milliseconds.
 */

import { GapRecord } from './log-gap-finder';
import { LineIndex } from './log-file-reader';

// ── Public interfaces ──────────────────────────────────────────────────

export interface DescriptiveStats {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
  skewness: number;
  kurtosis: number; // excess kurtosis (0 == normal)
}

export interface ChunkStatsResult {
  stats: DescriptiveStats;
  minChunk: GapRecord;
  maxChunk: GapRecord;
  /** Outliers determined by the IQR method (Tukey fences), sorted by duration desc */
  outliers: GapRecord[];
  /** All positive gap durations extracted from the index (ms) */
  allDurations: number[];
}

// ── Internal helpers ───────────────────────────────────────────────────

/**
 * Linear interpolation percentile over a pre-sorted ascending array.
 * p is in [0, 100].
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) {
    return sorted[lo];
  }
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ── Exported functions ─────────────────────────────────────────────────

/**
 * Walk the sparse line index and extract every positive inter-entry gap as a
 * {@link GapRecord} (text field is left empty — fill it via refinement if needed).
 *
 * The index is sampled (step N lines), so results are approximate but fast.
 */
export function extractAllGapsFromIndex(lineIndex: LineIndex): GapRecord[] {
  const entries = lineIndex.offsets.filter(
    (e): e is { line: number; byte: number; timestamp: Date } => e.timestamp !== null
  );

  if (entries.length < 2) {
    return [];
  }

  const gaps: GapRecord[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const curr = entries[i];
    const next = entries[i + 1];
    const durationMs = next.timestamp.getTime() - curr.timestamp.getTime();
    if (durationMs > 0) {
      gaps.push({
        line: curr.line,
        timestamp: curr.timestamp,
        nextTimestamp: next.timestamp,
        durationMs,
        text: '' // populated during optional refinement step
      });
    }
  }
  return gaps;
}

/**
 * Compute full descriptive statistics from an array of duration values (ms).
 * Returns a zeroed-out object when the array is empty.
 */
export function computeDescriptiveStats(durations: number[]): DescriptiveStats {
  const count = durations.length;
  if (count === 0) {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, p99: 0, stdDev: 0, skewness: 0, kurtosis: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = durations.reduce((s, v) => s + v, 0) / count;
  const median = percentile(sorted, 50);
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  // Population variance & standard deviation
  const variance = durations.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  // Fisher–Pearson skewness (standardised 3rd central moment)
  let skewness = 0;
  if (stdDev > 0) {
    skewness = durations.reduce((s, v) => s + ((v - mean) / stdDev) ** 3, 0) / count;
  }

  // Excess kurtosis (4th central moment − 3; 0 for a normal distribution)
  let kurtosis = 0;
  if (stdDev > 0) {
    kurtosis = durations.reduce((s, v) => s + ((v - mean) / stdDev) ** 4, 0) / count - 3;
  }

  return { count, mean, median, min, max, p90, p95, p99, stdDev, skewness, kurtosis };
}

/**
 * Identify outlier gaps using Tukey's IQR fences.
 *
 * An observation is an outlier when it falls outside
 * [ Q1 − multiplier×IQR,  Q3 + multiplier×IQR ].
 *
 * The default multiplier is 1.5 (standard) but 3.0 ("far outliers") is also common.
 * Returns gaps sorted by duration descending.
 */
export function detectOutliers(gaps: GapRecord[], multiplier = 1.5): GapRecord[] {
  if (gaps.length < 4) {
    return [];
  }

  const sorted = [...gaps.map(g => g.durationMs)].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  // When IQR is zero (all values identical) there are no outliers.
  if (iqr === 0) {
    return [];
  }

  const upperFence = q3 + multiplier * iqr;
  const lowerFence = q1 - multiplier * iqr;

  return gaps
    .filter(g => g.durationMs > upperFence || g.durationMs < lowerFence)
    .sort((a, b) => b.durationMs - a.durationMs);
}
