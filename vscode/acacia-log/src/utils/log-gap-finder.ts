/**
 * Find the longest-duration log record using the in-memory timestamp index.
 *
 * A log record's "duration" = the time gap between its timestamp and the
 * next record's timestamp. The longest gap indicates the slowest operation.
 */

import { LineIndex } from "./log-file-reader";
import { DetectedFormat, FileDates } from "./timestamp-detect";

// ── Result types ───────────────────────────────────────────────────────

export interface GapRecord {
  /** Line number where the slow record starts */
  line: number;
  /** Timestamp of this record */
  timestamp: Date;
  /** Timestamp of the next record */
  nextTimestamp: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** The log line text */
  text: string;
}

export interface TopGapsResult {
  gaps: GapRecord[];
  totalRecords: number;
  /** Time span of entire log file */
  logSpanMs: number;
}

// ── Find top N longest gaps from sparse index ──────────────────────────

/**
 * Scan the in-memory line index for the N largest time gaps.
 * O(n) single pass with a min-heap of size topN.
 *
 * Since the index is sparse (every Nth line), this gives approximate
 * results fast. Use refineLargestGap() to pinpoint the exact line.
 * Note: text is empty at this stage — refinement fills it in.
 */
export function findTopGapsFromIndex(
  lineIndex: LineIndex,
  topN = 10
): TopGapsResult {
  const entries = lineIndex.offsets.filter(
    (e) => e.timestamp !== null
  ) as { line: number; byte: number; timestamp: Date }[];

  if (entries.length < 2) {
    return { gaps: [], totalRecords: entries.length, logSpanMs: 0 };
  }

  const logSpanMs =
    entries[entries.length - 1].timestamp.getTime() -
    entries[0].timestamp.getTime();

  // Min-heap by durationMs, capped at topN
  const heap: GapRecord[] = [];

  function heapPush(rec: GapRecord): void {
    if (heap.length < topN) {
      heap.push(rec);
      bubbleUp(heap.length - 1);
    } else if (rec.durationMs > heap[0].durationMs) {
      heap[0] = rec;
      sinkDown(0);
    }
  }

  function bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].durationMs <= heap[i].durationMs) {
        break;
      }
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  function sinkDown(i: number): void {
    const n = heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && heap[l].durationMs < heap[smallest].durationMs) {
        smallest = l;
      }
      if (r < n && heap[r].durationMs < heap[smallest].durationMs) {
        smallest = r;
      }
      if (smallest === i) {
        break;
      }
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }

  for (let i = 0; i < entries.length - 1; i++) {
    const curr = entries[i];
    const next = entries[i + 1];
    const durationMs = next.timestamp.getTime() - curr.timestamp.getTime();

    if (durationMs <= 0) {
      continue;
    }

    heapPush({
      line: curr.line,
      timestamp: curr.timestamp,
      nextTimestamp: next.timestamp,
      durationMs,
      text: "",  // filled in during refinement
    });
  }

  const sorted = heap.sort((a, b) => b.durationMs - a.durationMs);
  return { gaps: sorted, totalRecords: entries.length, logSpanMs };
}


// ── Refine: pinpoint exact line within a sparse index chunk ────────────

import * as fs from "fs";
import * as readline from "readline";

/**
 * Given an approximate gap from the sparse index, read the actual lines
 * between the two index entries and find the exact longest gap.
 * Returns the GapRecord with the actual line text filled in.
 */
export async function refineLargestGap(
  filePath: string,
  approxGap: GapRecord,
  lineIndex: LineIndex,
  format: DetectedFormat,
  fileDates: FileDates
): Promise<GapRecord> {
  let startByte = 0;
  let startLine = approxGap.line;
  let endLine = startLine + 1000;

  for (let i = 0; i < lineIndex.offsets.length; i++) {
    const entry = lineIndex.offsets[i];
    if (entry.line === approxGap.line) {
      startByte = entry.byte;
      if (i + 1 < lineIndex.offsets.length) {
        endLine = lineIndex.offsets[i + 1].line;
      }
      break;
    }
  }

  const stream = fs.createReadStream(filePath, {
    encoding: "utf-8",
    start: startByte,
  });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let currentLine = startLine;
  let prevTs: Date | null = null;
  let prevLine = startLine;
  let prevText = "";
  let bestGap: GapRecord = approxGap;

  for await (const line of rl) {
    if (currentLine > endLine) {
      break;
    }

    const prefix = line.substring(0, 60);
    const match = prefix.match(format.regex);
    if (match) {
      const ts = format.parseFunc(match[0], fileDates);
      if (ts && prevTs) {
        const dur = ts.getTime() - prevTs.getTime();
        if (dur > bestGap.durationMs) {
          bestGap = {
            line: prevLine,
            timestamp: prevTs,
            nextTimestamp: ts,
            durationMs: dur,
            text: prevText,
          };
        }
      }
      if (ts) {
        prevTs = ts;
        prevLine = currentLine;
        prevText = line;
        
        // If this matches the approximate gap line, fill in the text
        if (currentLine === approxGap.line && !bestGap.text) {
          bestGap = { ...bestGap, text: line };
        }
      }
    }
    currentLine++;
  }

  // If we still don't have text, use prevText if available
  if (!bestGap.text && prevText) {
    bestGap = { ...bestGap, text: prevText };
  }

  rl.close();
  stream.destroy();
  return bestGap;
}


// ── Convenience: full pipeline ─────────────────────────────────────────

/**
 * Find the top N slowest log records with line-level precision.
 *
 * 1. Fast pass: scan sparse index in memory → approximate gaps
 * 2. Refine: read only the relevant chunks from disk → exact lines + text
 */
export async function findSlowestRecords(
  filePath: string,
  lineIndex: LineIndex,
  format: DetectedFormat,
  fileDates: FileDates,
  topN = 10
): Promise<TopGapsResult> {
  const approx = findTopGapsFromIndex(lineIndex, topN);

  if (approx.gaps.length === 0) {
    return approx;
  }

  const refined = await Promise.all(
    approx.gaps.map((gap) =>
      refineLargestGap(filePath, gap, lineIndex, format, fileDates)
    )
  );

  refined.sort((a, b) => b.durationMs - a.durationMs);

  return {
    gaps: refined,
    totalRecords: approx.totalRecords,
    logSpanMs: approx.logSpanMs,
  };
}


// ── Formatting helpers ─────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3_600_000) {
    const min = Math.floor(ms / 60_000);
    const sec = ((ms % 60_000) / 1000).toFixed(1);
    return `${min}m ${sec}s`;
  }
  const hrs = Math.floor(ms / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  return `${hrs}h ${min}m`;
}

export function formatGapRecord(gap: GapRecord): string {
  const header =
    `Line ${gap.line + 1}: ${formatDuration(gap.durationMs)} gap ` +
    `(${gap.timestamp.toISOString()} → ${gap.nextTimestamp.toISOString()})`;
  return `${header}\n  >> ${gap.text}`;
}
