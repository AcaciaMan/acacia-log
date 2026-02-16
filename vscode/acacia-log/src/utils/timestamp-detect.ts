/**
 * Log timestamp auto-detection for acacia-log.
 * Uses file creation and modification dates as anchors to disambiguate formats.
 */

export interface DetectedFormat {
  pattern: string;
  regex: RegExp;
  groupIndex: number;
  parseFunc: (match: string, fileDates: FileDates) => Date | null;
  score: number;
}

/** File date range anchor — lines should fall within [createdAt, modifiedAt] */
export interface FileDates {
  createdAt: Date;   // fs.statSync(path).birthtime
  modifiedAt: Date;  // fs.statSync(path).mtime
}

interface CandidateFormat {
  pattern: string;
  regex: RegExp;
  parseFunc: (match: string, fileDates: FileDates) => Date | null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseMonthName(s: string): number | null {
  const key = s.toLowerCase().substring(0, 3);
  return MONTH_NAMES[key] ?? null;
}

// ── Candidate formats, ordered by specificity ──────────────────────────

const CANDIDATE_FORMATS: CandidateFormat[] = [
  // ISO 8601 with T separator and optional millis/micros/tz
  {
    pattern: "yyyy-MM-ddTHH:mm:ss.SSS",
    regex: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)/,
    parseFunc: (m) => {
      const d = new Date(m.replace(",", "."));
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // ISO 8601 with space separator
  {
    pattern: "yyyy-MM-dd HH:mm:ss.SSS",
    regex: /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?(?:\s*[+-]\d{2}:?\d{2})?)/,
    parseFunc: (m) => {
      const d = new Date(m.replace(",", ".").trim().replace(" ", "T"));
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // ISO date only
  {
    pattern: "yyyy-MM-dd",
    regex: /^(\d{4}-\d{2}-\d{2})(?:\s|$|[,\]\[|])/,
    parseFunc: (m) => {
      const d = new Date(m.trim() + "T00:00:00");
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // dd/MM/yyyy HH:mm:ss (European)
  {
    pattern: "dd/MM/yyyy HH:mm:ss",
    regex: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m) => {
      const p = m.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/);
      if (!p) {
        return null;
      }
      const d = new Date(`${p[3]}-${p[2]}-${p[1]}T${p[4].replace(",", ".")}`);
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // MM/dd/yyyy HH:mm:ss (US)
  {
    pattern: "MM/dd/yyyy HH:mm:ss",
    regex: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m) => {
      const p = m.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/);
      if (!p) {
        return null;
      }
      const d = new Date(`${p[3]}-${p[1]}-${p[2]}T${p[4].replace(",", ".")}`);
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // dd.MM.yyyy HH:mm:ss (dot-separated, EU)
  {
    pattern: "dd.MM.yyyy HH:mm:ss",
    regex: /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m) => {
      const p = m.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/);
      if (!p) {
        return null;
      }
      const d = new Date(`${p[3]}-${p[2]}-${p[1]}T${p[4].replace(",", ".")}`);
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // dd-MMM-yyyy HH:mm:ss (e.g. 16-Feb-2026 10:53:01)
  {
    pattern: "dd-MMM-yyyy HH:mm:ss",
    regex: /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m) => {
      const p = m.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/);
      if (!p) {
        return null;
      }
      const month = parseMonthName(p[2]);
      if (month === null) {
        return null;
      }
      const d = new Date(parseInt(p[3]), month, parseInt(p[1]));
      const tp = p[4].replace(",", ".").split(/[:.]/);
      d.setHours(parseInt(tp[0]), parseInt(tp[1]), parseInt(tp[2]));
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // MMM dd, yyyy HH:mm:ss (e.g. Feb 16, 2026 10:53:01)
  {
    pattern: "MMM dd, yyyy HH:mm:ss",
    regex: /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m) => {
      const p = m.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/);
      if (!p) {
        return null;
      }
      const month = parseMonthName(p[1]);
      if (month === null) {
        return null;
      }
      const d = new Date(parseInt(p[3]), month, parseInt(p[2]));
      const tp = p[4].replace(",", ".").split(/[:.]/);
      d.setHours(parseInt(tp[0]), parseInt(tp[1]), parseInt(tp[2]));
      return isNaN(d.getTime()) ? null : d;
    },
  },
  // Syslog: MMM dd HH:mm:ss (no year — infer from file dates)
  {
    pattern: "MMM dd HH:mm:ss",
    regex: /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/,
    parseFunc: (m, fileDates) => {
      const p = m.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/);
      if (!p) {
        return null;
      }
      const month = parseMonthName(p[1]);
      if (month === null) {
        return null;
      }
      // Try year from creation date first, fall back to modification date
      const candidateYears = [
        fileDates.createdAt.getFullYear(),
        fileDates.modifiedAt.getFullYear(),
      ];
      // Deduplicate
      const years = [...new Set(candidateYears)];
      const tp = p[3].split(":");
      let bestDate: Date | null = null;
      let bestScore = -1;
      for (const year of years) {
        const d = new Date(year, month, parseInt(p[2]),
          parseInt(tp[0]), parseInt(tp[1]), parseInt(tp[2]));
        if (isNaN(d.getTime())) {
          continue;
        }
        const s = scoreDateInRange(d, fileDates);
        if (s > bestScore) {
          bestScore = s;
          bestDate = d;
        }
      }
      return bestDate;
    },
  },
  // Unix epoch seconds (10 digits)
  {
    pattern: "epoch_s",
    regex: /^(\d{10})(?:\b)/,
    parseFunc: (m) => {
      const d = new Date(parseInt(m) * 1000);
      return d.getFullYear() >= 2000 && d.getFullYear() <= 2100 ? d : null;
    },
  },
  // Unix epoch millis (13 digits)
  {
    pattern: "epoch_ms",
    regex: /^(\d{13})(?:\b)/,
    parseFunc: (m) => {
      const d = new Date(parseInt(m));
      return d.getFullYear() >= 2000 && d.getFullYear() <= 2100 ? d : null;
    },
  },
  // Time only: HH:mm:ss.SSS (attach file creation/mod date)
  {
    pattern: "HH:mm:ss.SSS",
    regex: /^(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)/,
    parseFunc: (m, fileDates) => {
      const tp = m.replace(",", ".").split(/[:.]/);
      if (tp.length < 3) {
        return null;
      }
      // Use creation date as the base date for time-only stamps
      const d = new Date(fileDates.createdAt);
      d.setHours(parseInt(tp[0]), parseInt(tp[1]), parseInt(tp[2]), 0);
      // If that puts us after modifiedAt, try modifiedAt as base
      if (d.getTime() > fileDates.modifiedAt.getTime() + 86400000) {
        const d2 = new Date(fileDates.modifiedAt);
        d2.setHours(parseInt(tp[0]), parseInt(tp[1]), parseInt(tp[2]), 0);
        return isNaN(d2.getTime()) ? null : d2;
      }
      return isNaN(d.getTime()) ? null : d;
    },
  },
];


// ── Utility helpers ────────────────────────────────────────────────────

function countDigits(s: string): number {
  let count = 0;
  for (const c of s) {
    if (c >= "0" && c <= "9") {
      count++;
    }
  }
  return count;
}

function extractCandidatePrefix(line: string, maxLen = 60): string {
  const stripped = line.replace(
    /^\s*[\[(<]?(?:TRACE|DEBUG|INFO|WARN|ERROR|FATAL|SEVERE|WARNING|NOTICE)[\]>)]?\s*/i,
    ""
  );
  return stripped.substring(0, maxLen);
}

function daysDiff(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}


// ── Scoring: date must fall within [createdAt, modifiedAt] range ───────

/**
 * Score a parsed date against the file date range.
 *
 * The ideal timestamp falls between file creation and modification dates.
 * Timestamps outside that range are penalized proportionally.
 *
 *   created ──────────── modified
 *       |  perfect zone  |
 *   ◄── penalty          penalty ──►
 */
function scoreDateInRange(parsed: Date, fileDates: FileDates): number {
  const created = fileDates.createdAt.getTime();
  const modified = fileDates.modifiedAt.getTime();
  const p = parsed.getTime();

  // Allow a small tolerance: 1 day before creation, 1 hour after modification
  const toleranceBefore = 24 * 60 * 60 * 1000; // 1 day
  const toleranceAfter = 60 * 60 * 1000;        // 1 hour

  const rangeStart = created - toleranceBefore;
  const rangeEnd = modified + toleranceAfter;

  if (p >= rangeStart && p <= rangeEnd) {
    // Inside the valid range — score by how centered it is
    // Dates closer to the range midpoint get a small bonus, but all in-range
    // dates score well
    const rangeMs = rangeEnd - rangeStart || 1;
    return 1.0;
  }

  // Outside range — penalize by distance
  const distMs = p < rangeStart
    ? rangeStart - p
    : p - rangeEnd;
  const distDays = distMs / (1000 * 60 * 60 * 24);

  if (distDays > 365 * 2) {
    return 0;
  }
  return 1 / (1 + distDays);
}

/**
 * Stricter scoring: bonus if timestamps are monotonically increasing
 * AND they span a subset of [createdAt → modifiedAt].
 */
function scoreTimestampSpan(parsedDates: Date[], fileDates: FileDates): number {
  if (parsedDates.length === 0) {
    return 0;
  }

  const first = parsedDates[0].getTime();
  const last = parsedDates[parsedDates.length - 1].getTime();
  const created = fileDates.createdAt.getTime();
  const modified = fileDates.modifiedAt.getTime();
  const fileSpan = modified - created || 1;

  // How well do the timestamps span the file date range?
  // Perfect: first ≈ created, last ≈ modified
  const startDist = Math.abs(first - created) / (1000 * 60 * 60 * 24);
  const endDist = Math.abs(last - modified) / (1000 * 60 * 60 * 24);

  const startScore = 1 / (1 + startDist);
  const endScore = 1 / (1 + endDist);

  return (startScore + endScore) / 2;
}


// ── Main detection ─────────────────────────────────────────────────────

export interface TimestampDetectionResult {
  detected: boolean;
  format: DetectedFormat | null;
  sampleParsed: Date[];
  linesScanned: number;
  matchRate: number;
  fileRange: { from: Date; to: Date } | null;  // detected timestamp range
}

/**
 * Detect timestamp format from log lines using file creation and modification
 * dates as a validity window.
 *
 * @param lines       Array of log lines (or first N lines of the file)
 * @param fileDates   File creation and modification timestamps
 * @param maxSample   Max lines to sample (default 100)
 */
export function detectTimestampFormat(
  lines: string[],
  fileDates: FileDates,
  maxSample = 100
): TimestampDetectionResult {

  // Sample lines evenly across the file
  const sampleIndices: number[] = [];
  const step = Math.max(1, Math.floor(lines.length / maxSample));
  for (let i = 0; i < lines.length && sampleIndices.length < maxSample; i += step) {
    if (lines[i].trim().length > 0) {
      sampleIndices.push(i);
    }
  }

  // Pre-filter: ≥6 digits in prefix
  const candidateLines: string[] = [];
  for (const idx of sampleIndices) {
    const prefix = extractCandidatePrefix(lines[idx]);
    if (countDigits(prefix) >= 6) {
      candidateLines.push(prefix);
    }
  }

  if (candidateLines.length === 0) {
    return {
      detected: false, format: null, sampleParsed: [],
      linesScanned: sampleIndices.length, matchRate: 0, fileRange: null,
    };
  }

  // Score each candidate format
  const formatScores = CANDIDATE_FORMATS.map((fmt) => ({
    fmt,
    totalScore: 0,
    matchCount: 0,
    inRangeCount: 0,
    parsedDates: [] as Date[],
  }));

  for (const prefix of candidateLines) {
    for (const entry of formatScores) {
      const match = prefix.match(entry.fmt.regex);
      if (!match) {
        continue;
      }

      const parsed = entry.fmt.parseFunc(match[0], fileDates);
      if (!parsed) {
        continue;
      }

      const s = scoreDateInRange(parsed, fileDates);
      if (s > 0) {
        entry.totalScore += s;
        entry.matchCount++;
        if (s >= 1.0) {
          entry.inRangeCount++;
        }
        entry.parsedDates.push(parsed);
      }
    }
  }

  // Rank: prefer in-range count → match count → total score
  formatScores.sort((a, b) => {
    const inRangeDiff = b.inRangeCount - a.inRangeCount;
    if (inRangeDiff !== 0) {
      return inRangeDiff;
    }
    const matchDiff = b.matchCount - a.matchCount;
    if (matchDiff !== 0) {
      return matchDiff;
    }
    return b.totalScore - a.totalScore;
  });

  const best = formatScores[0];
  if (best.matchCount === 0) {
    return {
      detected: false, format: null, sampleParsed: [],
      linesScanned: sampleIndices.length, matchRate: 0, fileRange: null,
    };
  }

  // Monotonicity check
  let monoCount = 0;
  for (let i = 1; i < best.parsedDates.length; i++) {
    if (best.parsedDates[i].getTime() >= best.parsedDates[i - 1].getTime()) {
      monoCount++;
    }
  }
  const monoRatio = best.parsedDates.length > 1
    ? monoCount / (best.parsedDates.length - 1)
    : 1;

  // Span score: do timestamps cover the file's lifetime?
  const spanScore = scoreTimestampSpan(best.parsedDates, fileDates);

  const matchRate = best.matchCount / candidateLines.length;
  const inRangeRate = best.inRangeCount / Math.max(best.matchCount, 1);

  // Combined confidence
  const confidence =
    best.totalScore
    * matchRate
    * (0.3 + 0.35 * monoRatio + 0.35 * inRangeRate)
    * (0.7 + 0.3 * spanScore);

  // Detected range
  const sortedDates = [...best.parsedDates].sort((a, b) => a.getTime() - b.getTime());
  const fileRange = sortedDates.length > 0
    ? { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] }
    : null;

  return {
    detected: true,
    format: {
      pattern: best.fmt.pattern,
      regex: best.fmt.regex,
      groupIndex: 1,
      parseFunc: best.fmt.parseFunc,
      score: confidence,
    },
    sampleParsed: best.parsedDates,
    linesScanned: sampleIndices.length,
    matchRate,
    fileRange,
  };
}


// ── Line-level timestamp extractor ─────────────────────────────────────

export function parseLineTimestamp(
  line: string,
  format: DetectedFormat,
  fileDates: FileDates
): Date | null {
  const prefix = extractCandidatePrefix(line);
  const match = prefix.match(format.regex);
  if (!match) {
    return null;
  }
  return format.parseFunc(match[0], fileDates);
}


// ── Display helper ─────────────────────────────────────────────────────

export function getFormatDisplayString(result: TimestampDetectionResult): string {
  if (!result.detected || !result.format) {
    return "No timestamp format detected";
  }
  const f = result.format;
  const rangeStr = result.fileRange
    ? ` | range: ${result.fileRange.from.toISOString()} → ${result.fileRange.to.toISOString()}`
    : "";
  return (
    `${f.pattern} — match: ${(result.matchRate * 100).toFixed(1)}%, ` +
    `confidence: ${f.score.toFixed(3)}${rangeStr}`
  );
}


// ── VS Code integration helper ─────────────────────────────────────────

/**
 * Convenience wrapper for VS Code: reads file stats and detects format.
 *
 * Usage:
 *   import * as vscode from 'vscode';
 *   import * as fs from 'fs';
 *   const result = detectFromFile(filePath, lines);
 */
export function detectFromFile(
  filePath: string,
  lines: string[],
  maxSample = 100
): TimestampDetectionResult {
  // Note: require('fs') at runtime to avoid bundling issues
  const fs = require("fs");
  const stat = fs.statSync(filePath);

  const fileDates: FileDates = {
    createdAt: stat.birthtime,  // file creation time
    modifiedAt: stat.mtime,     // file modification time
  };

  return detectTimestampFormat(lines, fileDates, maxSample);
}
