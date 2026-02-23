/**
 * Pure grouping helper: plain log lines → LogJsonEntry[].
 * No VS Code or Luxon dependencies — safe to import in Jest without mocking.
 */

export type MessageMode = "firstLineMinusTimestamp" | "firstLineAsIs";

/** Position of the matched timestamp within the original line. */
export interface TimestampMatch {
  raw: string;    // the matched substring
  start: number;  // match.index in the original line
  end: number;    // start + raw.length
}

export interface LogToJsonOptions {
  timestampRegex: RegExp;
  /** Return position-aware match for the timestamp in `line`, or null if no match. */
  extractTimestamp: (line: string) => TimestampMatch | null;
  /** Parse a raw timestamp string to ISO-8601, or return null on failure. */
  parseTimestamp: (raw: string) => string | null;
  messageMode?: MessageMode;       // default "firstLineMinusTimestamp"
  maxMultilineSize?: number;       // default 1000
}

export interface LogJsonEntry {
  timestamp: string | null;
  message: string;
  text: string;
}

// ── Internal working state ─────────────────────────────────────────────────────

interface WorkingEntry {
  timestamp: string | null;
  message: string;
  text: string;
  lineCount: number;
  truncated: boolean;
}

// ── Message extraction helper ──────────────────────────────────────────────────

/**
 * For "firstLineMinusTimestamp": remove the timestamp match from the line,
 * then strip leading/trailing whitespace and [-|:]+ punctuation.
 * Falls back to the full line if the result is empty.
 */
function extractMessage(
  line: string,
  match: TimestampMatch,
  mode: MessageMode
): string {
  if (mode === "firstLineAsIs") {
    return line;
  }

  // "firstLineMinusTimestamp"
  const stripped = (line.slice(0, match.start) + line.slice(match.end))
    .replace(/^[\s\-|:]+/, "")
    .replace(/[\s\-|:]+$/, "");

  return stripped.length > 0 ? stripped : line;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function groupLinesToJsonEntries(
  lines: string[],
  options: LogToJsonOptions
): LogJsonEntry[] {
  const {
    timestampRegex,
    extractTimestamp,
    parseTimestamp,
    messageMode = "firstLineMinusTimestamp",
    maxMultilineSize = 1000,
  } = options;

  const results: LogJsonEntry[] = [];
  let current: WorkingEntry | null = null;

  for (const line of lines) {
    const isStartLine = timestampRegex.test(line);

    if (isStartLine) {
      // Flush the previous entry
      if (current !== null) {
        results.push({
          timestamp: current.timestamp,
          message: current.message,
          text: current.text,
        });
      }

      const tsMatch = extractTimestamp(line);
      const isoTimestamp = tsMatch ? parseTimestamp(tsMatch.raw) : null;
      const message = tsMatch
        ? extractMessage(line, tsMatch, messageMode)
        : line;

      current = {
        timestamp: isoTimestamp,
        message,
        text: line,
        lineCount: 1,
        truncated: false,
      };
    } else {
      // Continuation / non-matching line
      if (current !== null) {
        if (current.lineCount >= maxMultilineSize) {
          // Append the truncation marker exactly once
          if (!current.truncated) {
            current.text += "\n[... truncated ...]";
            current.truncated = true;
          }
          // Do not append the line and do not increment lineCount
        } else {
          current.text += "\n" + line;
          current.lineCount++;
        }
      } else {
        // No current entry yet — create one with null timestamp
        current = {
          timestamp: null,
          message: line,
          text: line,
          lineCount: 1,
          truncated: false,
        };
      }
    }
  }

  // Flush the final entry
  if (current !== null) {
    results.push({
      timestamp: current.timestamp,
      message: current.message,
      text: current.text,
    });
  }

  return results;
}
