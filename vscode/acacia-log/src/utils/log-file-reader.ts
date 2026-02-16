/**
 * File-based log reader for acacia-log tree view.
 *
 * Reads only the lines needed — no full file load into VS Code editor.
 * Uses streaming and seek-based access for large log files.
 */

import * as fs from "fs";
import * as readline from "readline";
import {
  FileDates,
  DetectedFormat,
  TimestampDetectionResult,
  detectTimestampFormat,
  getFormatDisplayString,
} from "./timestamp-detect";

// ── File date helper ───────────────────────────────────────────────────

export function getFileDates(filePath: string): FileDates {
  const stat = fs.statSync(filePath);
  return {
    createdAt: stat.birthtime,
    modifiedAt: stat.mtime,
  };
}

// ── Sparse line reader: read only sampled lines for detection ──────────

/**
 * Read evenly-spaced sample lines from a file without loading it entirely.
 * Reads the file in one stream pass, picking every Nth line.
 */
export async function readSampleLines(
  filePath: string,
  maxSample = 100
): Promise<string[]> {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // For small files (< 1MB), just read everything
  if (fileSize < 1_000_000) {
    const all = fs.readFileSync(filePath, "utf-8").split("\n");
    if (all.length <= maxSample) {
      return all;
    }
    const step = Math.floor(all.length / maxSample);
    return all.filter((_, i) => i % step === 0).slice(0, maxSample);
  }

  // For large files, estimate line count from first chunk, then sample
  const lines: string[] = [];

  // Read first 64KB to estimate avg line length
  const probeSize = Math.min(65536, fileSize);
  const probeBuf = Buffer.alloc(probeSize);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, probeBuf, 0, probeSize, 0);
  fs.closeSync(fd);

  const probeStr = probeBuf.toString("utf-8");
  const probeLines = probeStr.split("\n");
  const avgLineLen = probeSize / Math.max(probeLines.length, 1);
  const estimatedTotalLines = Math.floor(fileSize / avgLineLen);

  // Calculate byte offsets to sample from
  const sampleCount = Math.min(maxSample, estimatedTotalLines);
  const byteStep = Math.floor(fileSize / sampleCount);
  const offsets: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    offsets.push(i * byteStep);
  }

  // Read a line at each offset
  const readFd = fs.openSync(filePath, "r");
  const chunkSize = Math.min(4096, Math.max(512, Math.ceil(avgLineLen * 3)));

  for (const offset of offsets) {
    const buf = Buffer.alloc(chunkSize);
    const bytesRead = fs.readSync(readFd, buf, 0, chunkSize, offset);
    if (bytesRead === 0) {
      continue;
    }

    const chunk = buf.toString("utf-8", 0, bytesRead);
    // Skip partial first line (unless offset is 0)
    const firstNewline = offset === 0 ? 0 : chunk.indexOf("\n");
    if (firstNewline === -1) {
      continue;
    }

    const start = offset === 0 ? 0 : firstNewline + 1;
    const rest = chunk.substring(start);
    const nextNewline = rest.indexOf("\n");
    const line = nextNewline === -1 ? rest : rest.substring(0, nextNewline);

    if (line.trim().length > 0) {
      lines.push(line);
    }
  }

  fs.closeSync(readFd);
  return lines;
}


// ── Detect format from file path (no editor needed) ────────────────────

export async function detectFromFilePath(
  filePath: string,
  maxSample = 100
): Promise<{ result: TimestampDetectionResult; fileDates: FileDates }> {
  const fileDates = getFileDates(filePath);
  const lines = await readSampleLines(filePath, maxSample);
  const result = detectTimestampFormat(lines, fileDates, maxSample);
  return { result, fileDates };
}


// ── Line index for byte-offset based seeking ───────────────────────────

export interface LineIndex {
  /** Byte offsets of line starts, sampled at regular intervals */
  offsets: { line: number; byte: number; timestamp: Date | null }[];
  totalLines: number;
  totalBytes: number;
}

/**
 * Build a sparse line index: maps every Nth line to its byte offset
 * and parsed timestamp. Used for binary search in jumpToTimestamp.
 *
 * For a 500MB log with 5M lines and indexStep=1000, this produces
 * ~5000 entries — small enough to keep in memory.
 */
export async function buildLineIndex(
  filePath: string,
  format: DetectedFormat,
  fileDates: FileDates,
  indexStep = 1000
): Promise<LineIndex> {
  const offsets: LineIndex["offsets"] = [];
  let lineNum = 0;
  let byteOffset = 0;

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (lineNum % indexStep === 0) {
      let ts: Date | null = null;
      const prefix = line.substring(0, 60);
      const match = prefix.match(format.regex);
      if (match) {
        ts = format.parseFunc(match[0], fileDates);
      }
      offsets.push({ line: lineNum, byte: byteOffset, timestamp: ts });
    }
    byteOffset += Buffer.byteLength(line, "utf-8") + 1; // +1 for \n
    lineNum++;
  }

  return { offsets, totalLines: lineNum, totalBytes: byteOffset };
}


// ── Read specific line range from file ─────────────────────────────────

/**
 * Read lines [startLine, endLine] from a file efficiently.
 * Uses the line index to seek to the nearest known byte offset,
 * then streams forward.
 */
export async function readLineRange(
  filePath: string,
  startLine: number,
  endLine: number,
  lineIndex?: LineIndex
): Promise<{ lines: string[]; firstLineNum: number }> {
  let seekByte = 0;
  let seekLine = 0;

  // Use index to jump near the target
  if (lineIndex && lineIndex.offsets.length > 0) {
    // Find the largest indexed offset that is <= startLine
    for (const entry of lineIndex.offsets) {
      if (entry.line <= startLine) {
        seekByte = entry.byte;
        seekLine = entry.line;
      } else {
        break;
      }
    }
  }

  const lines: string[] = [];
  const stream = fs.createReadStream(filePath, {
    encoding: "utf-8",
    start: seekByte,
  });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let currentLine = seekLine;
  for await (const line of rl) {
    if (currentLine > endLine) {
      break;
    }
    if (currentLine >= startLine) {
      lines.push(line);
    }
    currentLine++;
  }

  rl.close();
  stream.destroy();
  return { lines, firstLineNum: startLine };
}


// ── Jump to timestamp: binary search on the line index ─────────────────

export interface JumpResult {
  line: number;
  timestamp: Date;
  lineText: string;
}

/**
 * Find the log line closest to a target timestamp using binary search
 * on the sparse line index, then refines within the local chunk.
 */
export async function jumpToTimestamp(
  filePath: string,
  targetDate: Date,
  format: DetectedFormat,
  fileDates: FileDates,
  lineIndex: LineIndex
): Promise<JumpResult | null> {
  const indexed = lineIndex.offsets.filter((e) => e.timestamp !== null) as {
    line: number;
    byte: number;
    timestamp: Date;
  }[];

  if (indexed.length === 0) {
    return null;
  }

  // Binary search on indexed timestamps
  let lo = 0;
  let hi = indexed.length - 1;
  let bestIdx = 0;
  let bestDiff = Infinity;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const ts = indexed[mid].timestamp;
    const diff = Math.abs(ts.getTime() - targetDate.getTime());

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = mid;
    }

    if (ts.getTime() < targetDate.getTime()) {
      lo = mid + 1;
    } else if (ts.getTime() > targetDate.getTime()) {
      hi = mid - 1;
    } else {
      break; // exact match
    }
  }

  // Refine: read the chunk around the best indexed entry
  const chunkStart = indexed[Math.max(0, bestIdx - 1)]?.line ?? 0;
  const chunkEnd =
    indexed[Math.min(indexed.length - 1, bestIdx + 1)]?.line ??
    lineIndex.totalLines - 1;

  const { lines } = await readLineRange(
    filePath,
    chunkStart,
    chunkEnd,
    lineIndex
  );

  // Linear scan within chunk for the closest line
  let closestLine = indexed[bestIdx].line;
  let closestTs = indexed[bestIdx].timestamp;
  let closestDiff = bestDiff;
  let closestText = "";

  for (let i = 0; i < lines.length; i++) {
    const lineNum = chunkStart + i;
    const prefix = lines[i].substring(0, 60);
    const match = prefix.match(format.regex);
    if (!match) {
      continue;
    }

    const ts = format.parseFunc(match[0], fileDates);
    if (!ts) {
      continue;
    }

    const diff = Math.abs(ts.getTime() - targetDate.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestLine = lineNum;
      closestTs = ts;
      closestText = lines[i];
    }
  }

  if (!closestText && lines.length > 0) {
    closestText = lines[closestLine - chunkStart] ?? lines[0];
  }

  return {
    line: closestLine,
    timestamp: closestTs,
    lineText: closestText,
  };
}


// ── Get timestamps for a visible range (tree view / virtual scroll) ────

export interface LineTimestamp {
  line: number;
  timestamp: Date;
  text: string;
}

/**
 * Parse timestamps for a range of lines. Reads only the requested range
 * from disk. Continuation lines inherit the previous timestamp.
 */
export async function getTimestampsForRange(
  filePath: string,
  startLine: number,
  endLine: number,
  format: DetectedFormat,
  fileDates: FileDates,
  lineIndex?: LineIndex
): Promise<LineTimestamp[]> {
  const { lines } = await readLineRange(
    filePath,
    startLine,
    endLine,
    lineIndex
  );

  const results: LineTimestamp[] = [];
  let lastTs: Date | null = null;

  // If startLine > 0, we may need the previous timestamp for inheritance.
  // Read a few lines before startLine to seed lastTs.
  if (startLine > 0) {
    const lookback = Math.max(0, startLine - 20);
    const { lines: prevLines } = await readLineRange(
      filePath,
      lookback,
      startLine - 1,
      lineIndex
    );
    for (const pLine of prevLines) {
      const prefix = pLine.substring(0, 60);
      const match = prefix.match(format.regex);
      if (match) {
        const ts = format.parseFunc(match[0], fileDates);
        if (ts) {
          lastTs = ts;
        }
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = startLine + i;
    const prefix = lines[i].substring(0, 60);
    const match = prefix.match(format.regex);

    if (match) {
      const ts = format.parseFunc(match[0], fileDates);
      if (ts) {
        lastTs = ts;
        results.push({ line: lineNum, timestamp: ts, text: lines[i] });
        continue;
      }
    }

    // Continuation line — inherit previous timestamp
    if (lastTs) {
      results.push({ line: lineNum, timestamp: lastTs, text: lines[i] });
    }
  }

  return results;
}


// ── Filter lines by time range (streaming, for large files) ────────────

/**
 * Find all lines within [from, to] time range.
 * Uses the line index to skip large sections of the file.
 */
export async function filterLinesByTimeRange(
  filePath: string,
  from: Date,
  to: Date,
  format: DetectedFormat,
  fileDates: FileDates,
  lineIndex: LineIndex
): Promise<LineTimestamp[]> {
  const indexed = lineIndex.offsets.filter((e) => e.timestamp !== null) as {
    line: number;
    byte: number;
    timestamp: Date;
  }[];

  if (indexed.length === 0) {
    return [];
  }

  // Find the index range that overlaps [from, to]
  let startIdx = 0;
  let endIdx = indexed.length - 1;

  // First entry whose timestamp could be >= from
  for (let i = 0; i < indexed.length; i++) {
    if (i + 1 < indexed.length && indexed[i + 1].timestamp < from) {
      startIdx = i + 1;
    } else {
      startIdx = i;
      break;
    }
  }

  // Last entry whose timestamp could be <= to
  for (let i = indexed.length - 1; i >= 0; i--) {
    if (i - 1 >= 0 && indexed[i - 1].timestamp > to) {
      endIdx = i - 1;
    } else {
      endIdx = i;
      break;
    }
  }

  // Back up one chunk for safety
  startIdx = Math.max(0, startIdx - 1);
  endIdx = Math.min(indexed.length - 1, endIdx + 1);

  const rangeStart = indexed[startIdx].line;
  const rangeEnd =
    endIdx + 1 < indexed.length
      ? indexed[endIdx + 1].line
      : lineIndex.totalLines - 1;

  // Read only the relevant portion and filter
  return (
    await getTimestampsForRange(
      filePath,
      rangeStart,
      rangeEnd,
      format,
      fileDates,
      lineIndex
    )
  ).filter((lt) => lt.timestamp >= from && lt.timestamp <= to);
}


// ── High-level controller for the tree view ────────────────────────────

export class LogFileHandler {
  private filePath: string;
  private fileDates: FileDates;
  private detection: TimestampDetectionResult | null = null;
  private lineIndex: LineIndex | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.fileDates = getFileDates(filePath);
  }

  /** Run detection + build index. Call once when file is selected. */
  async initialize(): Promise<TimestampDetectionResult> {
    const { result, fileDates } = await detectFromFilePath(this.filePath);
    this.detection = result;
    this.fileDates = fileDates;

    if (result.detected && result.format) {
      this.lineIndex = await buildLineIndex(
        this.filePath,
        result.format,
        this.fileDates
      );
    }

    return result;
  }

  /** Invalidate cache — call when file changes on disk. */
  async refresh(): Promise<TimestampDetectionResult> {
    this.detection = null;
    this.lineIndex = null;
    return this.initialize();
  }

  get format(): DetectedFormat | null {
    return this.detection?.format ?? null;
  }

  get index(): LineIndex | null {
    return this.lineIndex;
  }

  get totalLines(): number {
    return this.lineIndex?.totalLines ?? 0;
  }

  async jump(targetDate: Date): Promise<JumpResult | null> {
    if (!this.detection?.format || !this.lineIndex) {
      return null;
    }
    return jumpToTimestamp(
      this.filePath,
      targetDate,
      this.detection.format,
      this.fileDates,
      this.lineIndex
    );
  }

  async getRange(
    startLine: number,
    endLine: number
  ): Promise<LineTimestamp[]> {
    if (!this.detection?.format) {
      return [];
    }
    return getTimestampsForRange(
      this.filePath,
      startLine,
      endLine,
      this.detection.format,
      this.fileDates,
      this.lineIndex ?? undefined
    );
  }

  async filterByTime(from: Date, to: Date): Promise<LineTimestamp[]> {
    if (!this.detection?.format || !this.lineIndex) {
      return [];
    }
    return filterLinesByTimeRange(
      this.filePath,
      from,
      to,
      this.detection.format,
      this.fileDates,
      this.lineIndex
    );
  }

  getDisplayString(): string {
    return this.detection
      ? getFormatDisplayString(this.detection)
      : "Not initialized";
  }
}
