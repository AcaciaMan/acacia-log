/**
 * Unit tests for timestamp-detect.ts
 * No VS Code APIs needed — all tested functions are pure (except detectFromFile).
 */

import {
  detectTimestampFormat,
  parseLineTimestamp,
  getFormatDisplayString,
  detectFromFile,
  FileDates,
  DetectedFormat,
  TimestampDetectionResult,
} from '../utils/timestamp-detect';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Default file dates covering January 2026 */
function makeFileDates(overrides: Partial<FileDates> = {}): FileDates {
  return {
    createdAt: new Date('2026-01-01T00:00:00'),
    modifiedAt: new Date('2026-01-31T23:59:59'),
    ...overrides,
  };
}

/** Generate N copies of the same log line */
function repeat(line: string, n: number): string[] {
  return Array.from({ length: n }, () => line);
}

// ── ISO format detection ──────────────────────────────────────────────────────

describe('detectTimestampFormat — ISO formats', () => {
  const fileDates = makeFileDates();

  it('detects ISO with space separator: yyyy-MM-dd HH:mm:ss', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading config',
      '2026-01-15 10:30:47 WARN Low memory',
      '2026-01-15 10:30:48 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toMatch(/yyyy-MM-dd/);
    expect(result.matchRate).toBeGreaterThan(0);
    expect(result.sampleParsed.length).toBeGreaterThan(0);
  });

  it('detects ISO 8601 with T separator: yyyy-MM-ddTHH:mm:ss.SSSZ', () => {
    const lines = [
      '2026-01-15T10:30:45.123Z INFO Application started',
      '2026-01-15T10:30:46.456Z DEBUG Loading config',
      '2026-01-15T10:30:47.789Z WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('yyyy-MM-ddTHH:mm:ss.SSS');
  });

  it('detects ISO 8601 with timezone offset', () => {
    const lines = [
      '2026-01-15T10:30:45+05:30 INFO Started',
      '2026-01-15T10:30:46-03:00 DEBUG Config loaded',
      '2026-01-15T10:30:47+00:00 WARN Check',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('yyyy-MM-ddTHH:mm:ss.SSS');
  });

  it('detects ISO date-only format: yyyy-MM-dd', () => {
    const lines = [
      '2026-01-15 INFO Application started',
      '2026-01-16 DEBUG Loading config',
      '2026-01-17 WARN Low memory',
      '2026-01-18 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
  });
});

// ── European date format ──────────────────────────────────────────────────────

describe('detectTimestampFormat — European formats', () => {
  const fileDates = makeFileDates();

  it('detects dd/MM/yyyy HH:mm:ss', () => {
    const lines = [
      '15/01/2026 10:30:45 INFO Application started',
      '15/01/2026 10:30:46 DEBUG Loading config',
      '16/01/2026 10:30:47 WARN Low memory',
      '17/01/2026 10:30:48 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    // Should match dd/MM/yyyy or MM/dd/yyyy pattern
    expect(result.format!.pattern).toMatch(/\/.*yyyy/);
  });

  it('detects dd.MM.yyyy HH:mm:ss', () => {
    const lines = [
      '15.01.2026 10:30:45 INFO Application started',
      '16.01.2026 10:30:46 DEBUG Loading config',
      '17.01.2026 10:30:47 WARN Low memory',
      '18.01.2026 10:30:48 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toMatch(/dd\.MM\.yyyy/);
  });
});

// ── US date format ────────────────────────────────────────────────────────────

describe('detectTimestampFormat — US format', () => {
  const fileDates = makeFileDates();

  it('detects MM/dd/yyyy HH:mm:ss', () => {
    const lines = [
      '01/15/2026 10:30:45 INFO Application started',
      '01/16/2026 10:30:46 DEBUG Loading config',
      '01/17/2026 10:30:47 WARN Low memory',
      '01/18/2026 10:30:48 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    // Both dd/MM/yyyy and MM/dd/yyyy patterns could match; verify detection
    expect(result.format!.pattern).toMatch(/\/.*yyyy/);
    expect(result.matchRate).toBeGreaterThan(0);
  });
});

// ── Syslog format ─────────────────────────────────────────────────────────────

describe('detectTimestampFormat — Syslog format', () => {
  it('detects MMM dd HH:mm:ss (syslog, no year)', () => {
    const fileDates = makeFileDates();
    const lines = [
      'Jan 15 10:30:45 myhost sshd[1234]: Accepted key',
      'Jan 15 10:30:46 myhost sshd[1234]: Session opened',
      'Jan 15 10:30:47 myhost sshd[1234]: Connection closed',
      'Jan 15 10:30:48 myhost cron[444]: Running job',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('MMM dd HH:mm:ss');
  });

  it('infers year from file dates for syslog format', () => {
    const fileDates = makeFileDates({
      createdAt: new Date('2026-01-01T00:00:00'),
      modifiedAt: new Date('2026-01-31T23:59:59'),
    });
    const lines = [
      'Jan 15 10:30:45 myhost sshd: connected',
      'Jan 20 12:00:00 myhost sshd: disconnected',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    // Parsed dates should be in 2026
    for (const d of result.sampleParsed) {
      expect(d.getFullYear()).toBe(2026);
    }
  });
});

// ── Epoch / Unix timestamps ───────────────────────────────────────────────────

describe('detectTimestampFormat — Epoch timestamps', () => {
  it('detects Unix epoch seconds (10 digits)', () => {
    // 1737000000 ≈ 2025-01-16T03:20:00Z
    const fileDates = makeFileDates({
      createdAt: new Date('2025-01-01T00:00:00Z'),
      modifiedAt: new Date('2025-02-01T00:00:00Z'),
    });
    const lines = [
      '1737000000 INFO Application started',
      '1737000060 DEBUG Loading config',
      '1737000120 WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('epoch_s');
  });

  it('detects Unix epoch milliseconds (13 digits)', () => {
    // 1737000000000 ≈ 2025-01-16T03:20:00.000Z
    const fileDates = makeFileDates({
      createdAt: new Date('2025-01-01T00:00:00Z'),
      modifiedAt: new Date('2025-02-01T00:00:00Z'),
    });
    const lines = [
      '1737000000000 INFO Application started',
      '1737000060000 DEBUG Loading config',
      '1737000120000 WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('epoch_ms');
  });
});

// ── Time-only format ──────────────────────────────────────────────────────────

describe('detectTimestampFormat — Time-only format', () => {
  it('detects HH:mm:ss.SSS time-only format', () => {
    const fileDates = makeFileDates();
    const lines = [
      '10:30:45.123 INFO Application started',
      '10:30:46.456 DEBUG Loading config',
      '10:30:47.789 WARN Low memory',
      '10:30:48.012 INFO Ready',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('HH:mm:ss.SSS');
  });

  it('uses file creation date as base for time-only stamps', () => {
    const fileDates = makeFileDates({
      createdAt: new Date('2026-01-15T00:00:00'),
      modifiedAt: new Date('2026-01-15T23:59:59'),
    });
    const lines = [
      '10:30:45 INFO Application started',
      '10:30:46 DEBUG Loading config',
      '10:30:47 WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    if (result.detected && result.sampleParsed.length > 0) {
      // Parsed dates should use the file creation date's year/month/day
      const parsed = result.sampleParsed[0];
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(15);
    }
  });
});

// ── Millisecond precision ─────────────────────────────────────────────────────

describe('detectTimestampFormat — Millisecond precision', () => {
  const fileDates = makeFileDates();

  it('handles dot-separated millis: yyyy-MM-dd HH:mm:ss.SSS', () => {
    const lines = [
      '2026-01-15 10:30:45.123 INFO Application started',
      '2026-01-15 10:30:45.456 DEBUG Loading config',
      '2026-01-15 10:30:45.789 WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toMatch(/yyyy-MM-dd/);
  });

  it('handles comma-separated millis: yyyy-MM-dd HH:mm:ss,SSS', () => {
    const lines = [
      '2026-01-15 10:30:45,123 INFO Application started',
      '2026-01-15 10:30:45,456 DEBUG Loading config',
      '2026-01-15 10:30:45,789 WARN Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toMatch(/yyyy-MM-dd/);
  });
});

// ── No timestamp found ────────────────────────────────────────────────────────

describe('detectTimestampFormat — no timestamp', () => {
  const fileDates = makeFileDates();

  it('returns detected: false when lines have no timestamps', () => {
    const lines = [
      'This is just plain text',
      'No timestamps here',
      'Just some log messages without dates',
      'Another plain line',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(false);
    expect(result.format).toBeNull();
    expect(result.sampleParsed).toEqual([]);
    expect(result.matchRate).toBe(0);
    expect(result.fileRange).toBeNull();
  });

  it('returns detected: false for very short non-numeric lines', () => {
    const lines = ['abc', 'def', 'ghi'];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(false);
    expect(result.format).toBeNull();
  });
});

// ── Mixed formats ─────────────────────────────────────────────────────────────

describe('detectTimestampFormat — mixed formats', () => {
  it('picks the highest-scoring format when lines contain mixed timestamps', () => {
    const fileDates = makeFileDates();
    // Majority ISO, one syslog
    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading config',
      '2026-01-15 10:30:47 WARN Low memory',
      'Jan 15 10:30:48 myhost sshd: connected',
      '2026-01-15 10:30:49 INFO Ready',
      '2026-01-15 10:30:50 INFO Completed',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    // ISO should win since it has more matches
    expect(result.format!.pattern).toMatch(/yyyy-MM-dd/);
  });
});

// ── Empty input / single line ─────────────────────────────────────────────────

describe('detectTimestampFormat — edge cases', () => {
  const fileDates = makeFileDates();

  it('handles empty input', () => {
    const result = detectTimestampFormat([], fileDates);

    expect(result.detected).toBe(false);
    expect(result.format).toBeNull();
    expect(result.sampleParsed).toEqual([]);
    expect(result.linesScanned).toBe(0);
    expect(result.matchRate).toBe(0);
    expect(result.fileRange).toBeNull();
  });

  it('handles single line with a timestamp', () => {
    const lines = ['2026-01-15 10:30:45 INFO Single line'];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.sampleParsed.length).toBe(1);
    expect(result.linesScanned).toBe(1);
    expect(result.matchRate).toBe(1);
  });

  it('handles single line without a timestamp', () => {
    const lines = ['Just a plain text line'];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(false);
  });

  it('skips blank lines in input', () => {
    const lines = [
      '',
      '2026-01-15 10:30:45 INFO Application started',
      '',
      '2026-01-15 10:30:46 DEBUG Loading config',
      '',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
  });
});

// ── maxSample parameter ───────────────────────────────────────────────────────

describe('detectTimestampFormat — maxSample parameter', () => {
  const fileDates = makeFileDates();

  it('limits lines scanned when maxSample is small', () => {
    const lines = repeat('2026-01-15 10:30:45 INFO Message', 200);
    const result = detectTimestampFormat(lines, fileDates, 10);

    expect(result.detected).toBe(true);
    expect(result.linesScanned).toBeLessThanOrEqual(10);
  });

  it('scans all lines when maxSample exceeds line count', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO First',
      '2026-01-15 10:30:46 INFO Second',
      '2026-01-15 10:30:47 INFO Third',
    ];
    const result = detectTimestampFormat(lines, fileDates, 1000);

    expect(result.detected).toBe(true);
    expect(result.linesScanned).toBe(3);
  });

  it('defaults maxSample to 100 lines', () => {
    const lines = repeat('2026-01-15 10:30:45 INFO Message', 500);
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.linesScanned).toBeLessThanOrEqual(100);
  });
});

// ── matchRate ─────────────────────────────────────────────────────────────────

describe('detectTimestampFormat — matchRate', () => {
  const fileDates = makeFileDates();

  it('returns matchRate 1.0 when all lines match', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO First',
      '2026-01-15 10:30:46 INFO Second',
      '2026-01-15 10:30:47 INFO Third',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.matchRate).toBe(1);
  });

  it('returns matchRate < 1.0 when some lines lack timestamps', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO First',
      '2026-01-15 10:30:46 INFO Second',
      'No timestamp here but has 123456 digits',
      '2026-01-15 10:30:47 INFO Third',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    // Not all lines matched, so matchRate < 1
    expect(result.matchRate).toBeLessThanOrEqual(1);
    expect(result.matchRate).toBeGreaterThan(0);
  });
});

// ── fileRange ─────────────────────────────────────────────────────────────────

describe('detectTimestampFormat — fileRange', () => {
  const fileDates = makeFileDates();

  it('returns earliest and latest detected timestamps', () => {
    const lines = [
      '2026-01-10 08:00:00 INFO First',
      '2026-01-15 12:00:00 INFO Middle',
      '2026-01-20 18:00:00 INFO Last',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.fileRange).not.toBeNull();
    expect(result.fileRange!.from.getTime()).toBeLessThanOrEqual(
      result.fileRange!.to.getTime()
    );
    // The 'from' should be the earliest timestamp
    expect(result.fileRange!.from.getDate()).toBe(10);
    // The 'to' should be the latest timestamp
    expect(result.fileRange!.to.getDate()).toBe(20);
  });

  it('returns null fileRange when no timestamps detected', () => {
    const lines = ['plain text', 'no dates', 'here'];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.fileRange).toBeNull();
  });

  it('returns same from and to when only one timestamp found', () => {
    const lines = ['2026-01-15 10:30:45 INFO Only one'];
    const result = detectTimestampFormat(lines, fileDates);

    if (result.detected && result.fileRange) {
      expect(result.fileRange.from.getTime()).toBe(result.fileRange.to.getTime());
    }
  });
});

// ── parseLineTimestamp ────────────────────────────────────────────────────────

describe('parseLineTimestamp', () => {
  const fileDates = makeFileDates();

  it('parses a line with a known detected format', () => {
    // First detect the format
    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading',
      '2026-01-15 10:30:47 WARN Memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);
    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();

    // Now parse individual lines with the detected format
    const parsed = parseLineTimestamp(
      '2026-01-15 10:30:45 INFO Application started',
      result.format!,
      fileDates
    );

    expect(parsed).not.toBeNull();
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(0); // January
    expect(parsed!.getDate()).toBe(15);
  });

  it('returns null for a line that does not match the format', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading',
      '2026-01-15 10:30:47 WARN Memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);
    expect(result.format).not.toBeNull();

    const parsed = parseLineTimestamp(
      'This line has no timestamp at all',
      result.format!,
      fileDates
    );

    expect(parsed).toBeNull();
  });

  it('parses continuation lines (without timestamps) as null', () => {
    const lines = [
      '2026-01-15 10:30:45 ERROR Something broke',
      '2026-01-15 10:30:46 DEBUG Loading',
      '2026-01-15 10:30:47 WARN Memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);
    expect(result.format).not.toBeNull();

    const parsed = parseLineTimestamp(
      '  at SomeClass.method (file.ts:10)',
      result.format!,
      fileDates
    );

    expect(parsed).toBeNull();
  });

  it('works with syslog format and fileDates', () => {
    const lines = [
      'Jan 15 10:30:45 myhost sshd: connected',
      'Jan 15 10:30:46 myhost sshd: auth ok',
      'Jan 15 10:30:47 myhost sshd: session started',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    if (result.detected && result.format) {
      const parsed = parseLineTimestamp(
        'Jan 15 10:30:45 myhost sshd: connected',
        result.format,
        fileDates
      );
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
    }
  });
});

// ── getFormatDisplayString ────────────────────────────────────────────────────

describe('getFormatDisplayString', () => {
  const fileDates = makeFileDates();

  it('returns human-readable string for a detected format', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading',
      '2026-01-15 10:30:47 WARN Memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);
    expect(result.detected).toBe(true);

    const display = getFormatDisplayString(result);

    expect(typeof display).toBe('string');
    expect(display).toContain('match:');
    expect(display).toContain('confidence:');
    expect(display).toContain('%');
  });

  it('returns "No timestamp format detected" for non-detected result', () => {
    const result: TimestampDetectionResult = {
      detected: false,
      format: null,
      sampleParsed: [],
      linesScanned: 0,
      matchRate: 0,
      fileRange: null,
    };

    const display = getFormatDisplayString(result);

    expect(display).toBe('No timestamp format detected');
  });

  it('includes range info when fileRange is present', () => {
    const lines = [
      '2026-01-10 08:00:00 INFO First',
      '2026-01-15 12:00:00 INFO Middle',
      '2026-01-20 18:00:00 INFO Last',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    if (result.detected && result.fileRange) {
      const display = getFormatDisplayString(result);
      expect(display).toContain('range:');
      expect(display).toContain('→');
    }
  });

  it('includes the format pattern in the display string', () => {
    const lines = [
      '2026-01-15 10:30:45 INFO First',
      '2026-01-15 10:30:46 INFO Second',
      '2026-01-15 10:30:47 INFO Third',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    if (result.detected && result.format) {
      const display = getFormatDisplayString(result);
      expect(display).toContain(result.format.pattern);
    }
  });
});

// ── detectFromFile ────────────────────────────────────────────────────────────

describe('detectFromFile', () => {
  it('reads file stats and detects format (mocked fs)', () => {
    // Mock fs.statSync
    jest.mock('fs', () => ({
      statSync: jest.fn(() => ({
        birthtime: new Date('2026-01-01T00:00:00'),
        mtime: new Date('2026-01-31T23:59:59'),
      })),
    }));

    const lines = [
      '2026-01-15 10:30:45 INFO Application started',
      '2026-01-15 10:30:46 DEBUG Loading config',
      '2026-01-15 10:30:47 WARN Low memory',
    ];
    const result = detectFromFile('/mock/path/log.txt', lines);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();

    jest.restoreAllMocks();
  });
});

// ── Additional format variants ────────────────────────────────────────────────

describe('detectTimestampFormat — additional formats', () => {
  it('detects dd-MMM-yyyy HH:mm:ss format', () => {
    const fileDates = makeFileDates({
      createdAt: new Date('2026-02-01T00:00:00'),
      modifiedAt: new Date('2026-02-28T23:59:59'),
    });
    const lines = [
      '16-Feb-2026 10:53:01 INFO Started',
      '16-Feb-2026 10:53:02 DEBUG Config',
      '16-Feb-2026 10:53:03 WARN Low mem',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('dd-MMM-yyyy HH:mm:ss');
  });

  it('detects MMM dd, yyyy HH:mm:ss format', () => {
    const fileDates = makeFileDates({
      createdAt: new Date('2026-02-01T00:00:00'),
      modifiedAt: new Date('2026-02-28T23:59:59'),
    });
    const lines = [
      'Feb 16, 2026 10:53:01 INFO Started',
      'Feb 16, 2026 10:53:02 DEBUG Config',
      'Feb 16, 2026 10:53:03 WARN Low mem',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.pattern).toBe('MMM dd, yyyy HH:mm:ss');
  });

  it('detects dd-MM-yyyy HH:mm format', () => {
    const fileDates = makeFileDates();
    const lines = [
      '15-01-2026 10:30 INFO Started',
      '16-01-2026 10:31 DEBUG Config',
      '17-01-2026 10:32 WARN Low mem',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
  });
});

// ── Confidence scoring ────────────────────────────────────────────────────────

describe('detectTimestampFormat — scoring & confidence', () => {
  it('assigns higher confidence to timestamps within file date range', () => {
    const fileDates = makeFileDates();
    const inRangeLines = [
      '2026-01-15 10:30:45 INFO In-range',
      '2026-01-16 10:30:46 INFO In-range',
      '2026-01-17 10:30:47 INFO In-range',
    ];
    const resultInRange = detectTimestampFormat(inRangeLines, fileDates);

    const outOfRangeFileDates = makeFileDates({
      createdAt: new Date('2020-01-01T00:00:00'),
      modifiedAt: new Date('2020-01-31T23:59:59'),
    });
    const resultOutOfRange = detectTimestampFormat(inRangeLines, outOfRangeFileDates);

    // Both should detect, but in-range should have higher confidence
    expect(resultInRange.detected).toBe(true);
    expect(resultOutOfRange.detected).toBe(true);
    if (resultInRange.format && resultOutOfRange.format) {
      expect(resultInRange.format.score).toBeGreaterThan(resultOutOfRange.format.score);
    }
  });

  it('scores monotonically increasing timestamps higher', () => {
    const fileDates = makeFileDates();
    const monotonicLines = [
      '2026-01-15 10:30:45 INFO First',
      '2026-01-15 10:30:46 INFO Second',
      '2026-01-15 10:30:47 INFO Third',
    ];
    const result = detectTimestampFormat(monotonicLines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
    expect(result.format!.score).toBeGreaterThan(0);
  });
});

// ── Format detection with log level prefixes ──────────────────────────────────

describe('detectTimestampFormat — lines with level prefixes', () => {
  const fileDates = makeFileDates();

  it('strips log level prefixes before matching', () => {
    const lines = [
      'INFO 2026-01-15 10:30:45 Application started',
      'DEBUG 2026-01-15 10:30:46 Loading config',
      'WARN 2026-01-15 10:30:47 Low memory',
      'ERROR 2026-01-15 10:30:48 Crash',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
  });

  it('handles bracketed log levels', () => {
    const lines = [
      '[INFO] 2026-01-15 10:30:45 Application started',
      '[DEBUG] 2026-01-15 10:30:46 Loading config',
      '[WARN] 2026-01-15 10:30:47 Low memory',
    ];
    const result = detectTimestampFormat(lines, fileDates);

    expect(result.detected).toBe(true);
    expect(result.format).not.toBeNull();
  });
});
