/**
 * Unit tests for the pure grouping helper in log-to-jsonl.ts
 * No VS Code APIs needed — runs directly in Jest.
 */

import {
  groupLinesToJsonEntries,
  LogToJsonOptions,
  TimestampMatch,
  MessageMode,
} from '../utils/log-to-jsonl';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Simple ISO-like timestamp regex: YYYY-MM-DD HH:MM:SS */
const ISO_REGEX = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

function makeOptions(overrides: Partial<LogToJsonOptions> = {}): LogToJsonOptions {
  return {
    timestampRegex: ISO_REGEX,
    extractTimestamp: (line: string): TimestampMatch | null => {
      const m = line.match(ISO_REGEX);
      if (!m || m.index === undefined) { return null; }
      return { raw: m[0], start: m.index, end: m.index + m[0].length };
    },
    parseTimestamp: (raw: string): string | null => {
      // Convert "YYYY-MM-DD HH:MM:SS" → ISO-8601
      const d = new Date(raw.replace(' ', 'T') + 'Z');
      return isNaN(d.getTime()) ? null : d.toISOString();
    },
    ...overrides,
  };
}

// ── Basic grouping ────────────────────────────────────────────────────────────

describe('groupLinesToJsonEntries — basic grouping', () => {
  it('produces a single entry from a single start line', () => {
    const lines = ['2026-01-01 10:00:00 INFO startup complete'];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2026-01-01T10:00:00.000Z');
    expect(result[0].text).toBe(lines[0]);
  });

  it('produces two entries from two start lines', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO first',
      '2026-01-01 10:00:01 WARN second',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe(lines[0]);
    expect(result[1].text).toBe(lines[1]);
  });

  it('groups continuation lines into the preceding entry', () => {
    const lines = [
      '2026-01-01 10:00:00 ERROR something broke',
      '  at SomeClass.method (file.ts:10)',
      '  at anotherMethod (file.ts:20)',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(lines.join('\n'));
    expect(result[0].timestamp).toBe('2026-01-01T10:00:00.000Z');
  });

  it('attaches continuation lines to the correct entry when multiple entries exist', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO first',
      'continuation of first',
      '2026-01-01 10:00:01 WARN second',
      'continuation of second',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('2026-01-01 10:00:00 INFO first\ncontinuation of first');
    expect(result[1].text).toBe('2026-01-01 10:00:01 WARN second\ncontinuation of second');
  });
});

// ── No timestamps ─────────────────────────────────────────────────────────────

describe('groupLinesToJsonEntries — no timestamps', () => {
  it('returns a single entry with timestamp=null when no line matches', () => {
    const lines = ['first line', 'second line', 'third line'];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBeNull();
    expect(result[0].message).toBe('first line');
    expect(result[0].text).toBe('first line\nsecond line\nthird line');
  });

  it('returns empty array for empty input', () => {
    const result = groupLinesToJsonEntries([], makeOptions());
    expect(result).toHaveLength(0);
  });

  it('handles a single non-matching line', () => {
    const result = groupLinesToJsonEntries(['just a line'], makeOptions());
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBeNull();
    expect(result[0].text).toBe('just a line');
  });
});

// ── Last entry is multiline ───────────────────────────────────────────────────

describe('groupLinesToJsonEntries — last entry is multiline', () => {
  it('flushes multiline last entry after loop', () => {
    const lines = [
      '2026-01-01 10:00:00 ERROR crash',
      'stack frame 1',
      'stack frame 2',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(
      '2026-01-01 10:00:00 ERROR crash\nstack frame 1\nstack frame 2'
    );
  });
});

// ── Whitespace and empty lines ────────────────────────────────────────────────

describe('groupLinesToJsonEntries — empty / whitespace lines', () => {
  it('appends empty lines as continuation if current entry exists', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO block start',
      '',
      '  ',
      '2026-01-01 10:00:01 INFO block end',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('2026-01-01 10:00:00 INFO block start\n\n  ');
  });

  it('creates a null-timestamp entry for leading empty line before first match', () => {
    const lines = [
      '',
      '2026-01-01 10:00:00 INFO after blank',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());
    // The empty line creates a null-timestamp entry; then the timestamp line makes a new entry
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBeNull();
    expect(result[0].text).toBe('');
    expect(result[1].timestamp).not.toBeNull();
  });
});

// ── maxMultilineSize ──────────────────────────────────────────────────────────

describe('groupLinesToJsonEntries — maxMultilineSize', () => {
  it('appends truncation marker when line count reaches the limit', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO start',  // lineCount = 1
      'extra line 1',                     // lineCount = 2
      'extra line 2',                     // lineCount = 3 → at limit (maxMultilineSize=3)
      'should be truncated',              // beyond limit
      'also truncated',                   // beyond limit
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions({ maxMultilineSize: 3 }));

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('[... truncated ...]');
    // Truncated lines must not appear in text
    expect(result[0].text).not.toContain('should be truncated');
    expect(result[0].text).not.toContain('also truncated');
  });

  it('appends the truncation marker exactly once', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO start',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions({ maxMultilineSize: 2 }));
    const markerCount = (result[0].text.match(/\[... truncated ...\]/g) ?? []).length;
    expect(markerCount).toBe(1);
  });

  it('maxMultilineSize=1 means only the start line ends up in the entry', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO only this',
      'this gets truncated immediately',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions({ maxMultilineSize: 1 }));

    expect(result).toHaveLength(1);
    // text should be the start line + marker
    expect(result[0].text).toBe(
      '2026-01-01 10:00:00 INFO only this\n[... truncated ...]'
    );
    expect(result[0].text).not.toContain('this gets truncated');
  });

  it('a new timestamp line after a truncated block starts a fresh entry', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO first',
      'overflow 1',
      'overflow 2',
      '2026-01-01 10:00:01 INFO second',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions({ maxMultilineSize: 1 }));

    expect(result).toHaveLength(2);
    expect(result[1].timestamp).toBe('2026-01-01T10:00:01.000Z');
    expect(result[1].text).toBe('2026-01-01 10:00:01 INFO second');
  });
});

// ── parseTimestamp returning null ─────────────────────────────────────────────

describe('groupLinesToJsonEntries — parseTimestamp returns null', () => {
  it('sets timestamp=null when parseTimestamp cannot parse the raw value', () => {
    const opts = makeOptions({ parseTimestamp: () => null });
    const lines = ['2026-01-01 10:00:00 INFO valid regex, unparseable value'];
    const result = groupLinesToJsonEntries(lines, opts);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBeNull();
    // text and message should still be populated
    expect(result[0].text).toBe(lines[0]);
  });
});

// ── messageMode ───────────────────────────────────────────────────────────────

describe('groupLinesToJsonEntries — messageMode', () => {
  it('"firstLineMinusTimestamp" strips the timestamp from the message', () => {
    const lines = ['2026-01-01 10:00:00 INFO application started'];
    const result = groupLinesToJsonEntries(lines, makeOptions({ messageMode: 'firstLineMinusTimestamp' }));

    expect(result[0].message).toBe('INFO application started');
    expect(result[0].text).toBe(lines[0]);
  });

  it('"firstLineMinusTimestamp" strips leading punctuation after removing timestamp', () => {
    // e.g. "2026-01-01 10:00:00 - INFO message"
    const lines = ['2026-01-01 10:00:00 - INFO dash-separated'];
    const result = groupLinesToJsonEntries(lines, makeOptions({ messageMode: 'firstLineMinusTimestamp' }));

    expect(result[0].message).toBe('INFO dash-separated');
  });

  it('"firstLineMinusTimestamp" falls back to full line when stripping leaves empty string', () => {
    // A line that IS the timestamp and nothing else
    const lines = ['2026-01-01 10:00:00'];
    const result = groupLinesToJsonEntries(lines, makeOptions({ messageMode: 'firstLineMinusTimestamp' }));

    expect(result[0].message).toBe('2026-01-01 10:00:00');
  });

  it('"firstLineMinusTimestamp" falls back to full line when stripping leaves only punctuation', () => {
    const lines = ['2026-01-01 10:00:00 ---'];
    const result = groupLinesToJsonEntries(lines, makeOptions({ messageMode: 'firstLineMinusTimestamp' }));

    expect(result[0].message).toBe('2026-01-01 10:00:00 ---');
  });

  it('"firstLineAsIs" keeps the whole line as the message', () => {
    const lines = ['2026-01-01 10:00:00 INFO do not strip'];
    const result = groupLinesToJsonEntries(lines, makeOptions({ messageMode: 'firstLineAsIs' }));

    expect(result[0].message).toBe(lines[0]);
  });

  it('defaults to "firstLineMinusTimestamp" when messageMode is omitted', () => {
    const opts = makeOptions();
    delete (opts as Partial<LogToJsonOptions>).messageMode;
    const lines = ['2026-01-01 10:00:00 INFO default mode'];
    const result = groupLinesToJsonEntries(lines, opts);

    expect(result[0].message).toBe('INFO default mode');
  });
});

// ── Lines that resemble timestamps but fail the regex ─────────────────────────

describe('groupLinesToJsonEntries — near-miss timestamp lines', () => {
  it('treats a line that looks like a timestamp but fails the regex as continuation', () => {
    const lines = [
      '2026-01-01 10:00:00 INFO entry',
      '2026-13-99 25:99:99 not a real date but just a string', // fails ISO_REGEX digit ranges conceptually
      // Note: ISO_REGEX only checks digit structure not value validity, so let's use a custom regex test
    ];
    // Use a regex that also validates numeric ranges via more specific pattern
    const strictRegex = /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]) (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d/;
    const opts: LogToJsonOptions = {
      timestampRegex: strictRegex,
      extractTimestamp: (line) => {
        const m = line.match(strictRegex);
        if (!m || m.index === undefined) { return null; }
        return { raw: m[0], start: m.index, end: m.index + m[0].length };
      },
      parseTimestamp: (raw) => {
        const d = new Date(raw.replace(' ', 'T') + 'Z');
        return isNaN(d.getTime()) ? null : d.toISOString();
      },
    };
    const invalidTs = '2026-13-99 25:99:99 invalid date digits';
    const result = groupLinesToJsonEntries(
      ['2026-01-01 10:00:00 INFO entry', invalidTs],
      opts
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('2026-01-01 10:00:00 INFO entry\n' + invalidTs);
  });
});

// ── Multi-entry with mixed null / non-null timestamps ─────────────────────────

describe('groupLinesToJsonEntries — mixed null / valid timestamps', () => {
  it('leading non-matching lines create null-timestamp entry followed by timestamped entries', () => {
    const lines = [
      'preamble line 1',
      'preamble line 2',
      '2026-01-01 10:00:00 INFO first real entry',
      '2026-01-01 10:00:01 INFO second real entry',
    ];
    const result = groupLinesToJsonEntries(lines, makeOptions());

    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBeNull();
    expect(result[0].text).toBe('preamble line 1\npreamble line 2');
    expect(result[1].timestamp).toBe('2026-01-01T10:00:00.000Z');
    expect(result[2].timestamp).toBe('2026-01-01T10:00:01.000Z');
  });
});
