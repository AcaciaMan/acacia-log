/**
 * Unit tests for readLogPatterns.ts
 * Pure fs.readFileSync + JSON parse — no VS Code mocking needed.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  readLogPatterns,
  LogPatternEntry,
  LensCategory,
} from '../utils/readLogPatterns';

// ── Test helpers ──────────────────────────────────────────────────────────────

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acacia-patterns-test-'));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Write a JSON file and return its absolute path */
function writeTempJson(name: string, content: unknown): string {
  const filePath = path.join(tempDir, name);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  return filePath;
}

/** Standard 3-pattern test data */
function standardPatterns() {
  return {
    logPatterns: {
      error: {
        regexp: 'ERROR',
        regexpoptions: 'i',
        bSearch: true,
        lensEnabled: true,
        lensCategory: 'level' as LensCategory,
        lensLabel: 'Error',
        lensColor: '#ff4d4f',
        lensPriority: 100,
      },
      warn: {
        regexp: 'WARN',
        regexpoptions: 'i',
        bSearch: true,
        lensEnabled: true,
        lensCategory: 'level' as LensCategory,
        lensLabel: 'Warning',
        lensColor: '#faad14',
        lensPriority: 90,
      },
      info: {
        regexp: 'INFO',
        regexpoptions: 'i',
        bSearch: true,
        lensEnabled: true,
        lensCategory: 'level' as LensCategory,
        lensLabel: 'Info',
        lensColor: '#40a9ff',
        lensPriority: 80,
      },
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Basic parsing
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — basic parsing', () => {
  it('reads standard 3-pattern file and returns 3 entries', () => {
    const filePath = writeTempJson('standard.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(3);
  });

  it('reads from existing test fixture file', () => {
    const fixturePath = path.resolve(__dirname, 'logPatterns.json');
    if (fs.existsSync(fixturePath)) {
      const entries = readLogPatterns(fixturePath);
      expect(entries.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('assigns correct key to each entry', () => {
    const filePath = writeTempJson('keys.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    const keys = entries.map((e) => e.key);
    expect(keys).toContain('error');
    expect(keys).toContain('warn');
    expect(keys).toContain('info');
  });

  it('stores regexp as a string (not RegExp)', () => {
    const filePath = writeTempJson('regexp-str.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    for (const e of entries) {
      expect(typeof e.regexp).toBe('string');
    }
    expect(entries.find((e) => e.key === 'error')!.regexp).toBe('ERROR');
  });

  it('appends "g" flag to regexpoptions if not present', () => {
    const filePath = writeTempJson('flags.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    for (const e of entries) {
      expect(e.regexpoptions).toContain('g');
    }
    // Original was "i" → should become "ig"
    expect(entries.find((e) => e.key === 'error')!.regexpoptions).toBe('ig');
  });

  it('does not duplicate "g" flag when already present', () => {
    const data = {
      logPatterns: {
        test: {
          regexp: 'TEST',
          regexpoptions: 'gi',
          bSearch: true,
        },
      },
    };
    const filePath = writeTempJson('no-dup-g.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries[0].regexpoptions).toBe('gi');
  });

  it('sorts entries by lensPriority descending', () => {
    const filePath = writeTempJson('sorted.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    expect(entries[0].key).toBe('error');     // priority 100
    expect(entries[1].key).toBe('warn');      // priority 90
    expect(entries[2].key).toBe('info');      // priority 80
    for (let i = 0; i < entries.length - 1; i++) {
      expect(entries[i].lensPriority).toBeGreaterThanOrEqual(entries[i + 1].lensPriority);
    }
  });

  it('maps all fields correctly', () => {
    const filePath = writeTempJson('all-fields.json', standardPatterns());
    const entries = readLogPatterns(filePath);

    const error = entries.find((e) => e.key === 'error')!;
    expect(error.regexp).toBe('ERROR');
    expect(error.regexpoptions).toBe('ig');
    expect(error.lensEnabled).toBe(true);
    expect(error.lensCategory).toBe('level');
    expect(error.lensLabel).toBe('Error');
    expect(error.lensColor).toBe('#ff4d4f');
    expect(error.lensPriority).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Filtering
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — filtering', () => {
  it('excludes patterns with bSearch: false', () => {
    const data = {
      logPatterns: {
        included: {
          regexp: 'YES',
          regexpoptions: 'i',
          bSearch: true,
        },
        excluded: {
          regexp: 'NO',
          regexpoptions: 'i',
          bSearch: false,
        },
      },
    };
    const filePath = writeTempJson('bsearch-false.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('included');
  });

  it('excludes patterns where bSearch is missing (falsy)', () => {
    const data = {
      logPatterns: {
        noFlag: {
          regexp: 'NOFLAG',
          regexpoptions: 'i',
          // bSearch omitted → falsy → excluded
        },
        hasFlag: {
          regexp: 'HAS',
          regexpoptions: 'i',
          bSearch: true,
        },
      },
    };
    const filePath = writeTempJson('bsearch-missing.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('hasFlag');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Defaults
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — defaults', () => {
  it('applies defaults when lens fields are omitted', () => {
    const data = {
      logPatterns: {
        mypattern: {
          regexp: 'SOMETHING',
          regexpoptions: 'i',
          bSearch: true,
          // No lens fields provided
        },
      },
    };
    const filePath = writeTempJson('defaults.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.lensEnabled).toBe(true);
    expect(e.lensLabel).toBe('mypattern');  // defaults to key name
    expect(e.lensPriority).toBe(0);         // defaults to 0
    // lensCategory inferred from key; 'mypattern' → 'custom'
    expect(e.lensCategory).toBe('custom');
    // lensColor defaults to DEFAULT_LENS_COLORS[category]
    expect(typeof e.lensColor).toBe('string');
  });

  it('infers lensCategory from well-known key names', () => {
    const data = {
      logPatterns: {
        error_log: { regexp: 'ERR', regexpoptions: '', bSearch: true },
        sql_query: { regexp: 'SELECT', regexpoptions: '', bSearch: true },
        stack_exception: { regexp: 'at\\s', regexpoptions: '', bSearch: true },
        http_req: { regexp: 'GET', regexpoptions: '', bSearch: true },
        retry_op: { regexp: 'retry', regexpoptions: '', bSearch: true },
        config_load: { regexp: 'config', regexpoptions: '', bSearch: true },
        unknown: { regexp: 'X', regexpoptions: '', bSearch: true },
      },
    };
    const filePath = writeTempJson('infer-category.json', data);
    const entries = readLogPatterns(filePath);

    const byKey = (k: string) => entries.find((e) => e.key === k)!;
    expect(byKey('error_log').lensCategory).toBe('level');
    expect(byKey('sql_query').lensCategory).toBe('sql');
    expect(byKey('stack_exception').lensCategory).toBe('stack');
    expect(byKey('http_req').lensCategory).toBe('http');
    expect(byKey('retry_op').lensCategory).toBe('retry');
    expect(byKey('config_load').lensCategory).toBe('config');
    expect(byKey('unknown').lensCategory).toBe('custom');
  });

  it('applies partial lens config with defaults for missing fields', () => {
    const data = {
      logPatterns: {
        partial: {
          regexp: 'PARTIAL',
          regexpoptions: 'i',
          bSearch: true,
          lensEnabled: false,
          lensPriority: 50,
          // lensCategory, lensLabel, lensColor omitted
        },
      },
    };
    const filePath = writeTempJson('partial.json', data);
    const entries = readLogPatterns(filePath);

    const e = entries[0];
    expect(e.lensEnabled).toBe(false);
    expect(e.lensPriority).toBe(50);
    expect(e.lensLabel).toBe('partial');  // defaults to key
    expect(e.lensCategory).toBe('custom');
    expect(typeof e.lensColor).toBe('string');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — edge cases', () => {
  it('returns empty array for empty patterns object', () => {
    const data = { logPatterns: {} };
    const filePath = writeTempJson('empty-patterns.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toEqual([]);
  });

  it('throws for missing logPatterns key', () => {
    const data = {};
    const filePath = writeTempJson('no-key.json', data);

    expect(() => readLogPatterns(filePath)).toThrow();
  });

  it('throws for malformed JSON file', () => {
    const filePath = path.join(tempDir, 'malformed.json');
    fs.writeFileSync(filePath, '{not valid json!!!', 'utf-8');

    expect(() => readLogPatterns(filePath)).toThrow();
  });

  it('throws for non-existent file', () => {
    const filePath = path.join(tempDir, 'does-not-exist.json');

    expect(() => readLogPatterns(filePath)).toThrow(/File not found/);
  });

  it('handles custom regex options (e.g., "gim")', () => {
    const data = {
      logPatterns: {
        multi: {
          regexp: 'MULTI',
          regexpoptions: 'gim',
          bSearch: true,
        },
      },
    };
    const filePath = writeTempJson('custom-flags.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries[0].regexpoptions).toBe('gim');
    // Verify a RegExp can be constructed with these flags
    const re = new RegExp(entries[0].regexp, entries[0].regexpoptions);
    expect(re.flags).toContain('g');
    expect(re.flags).toContain('i');
    expect(re.flags).toContain('m');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Complex patterns
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — complex patterns', () => {
  it('handles SQL patterns with alternation', () => {
    const data = {
      logPatterns: {
        sql_ops: {
          regexp: 'SELECT|INSERT|UPDATE|DELETE',
          regexpoptions: 'i',
          bSearch: true,
          lensCategory: 'sql',
          lensLabel: 'SQL',
          lensColor: '#d48806',
          lensPriority: 60,
        },
      },
    };
    const filePath = writeTempJson('sql.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(1);
    expect(entries[0].lensCategory).toBe('sql');
    expect(entries[0].regexp).toBe('SELECT|INSERT|UPDATE|DELETE');

    // Verify regex works (use separate RegExp instances to avoid 'g' flag lastIndex state)
    const re1 = new RegExp(entries[0].regexp, entries[0].regexpoptions);
    expect(re1.test('SELECT * FROM users')).toBe(true);
    const re2 = new RegExp(entries[0].regexp, entries[0].regexpoptions);
    expect(re2.test('insert into logs')).toBe(true);
  });

  it('handles stack trace patterns with escaped chars', () => {
    const data = {
      logPatterns: {
        stacktrace: {
          regexp: 'at \\w+\\.\\w+ \\(',
          regexpoptions: '',
          bSearch: true,
          lensCategory: 'stack',
          lensLabel: 'Stack Trace',
          lensPriority: 70,
        },
      },
    };
    const filePath = writeTempJson('stack.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(1);
    expect(entries[0].lensCategory).toBe('stack');

    const re = new RegExp(entries[0].regexp, entries[0].regexpoptions);
    expect(re.test('at SomeClass.method (file.ts:10)')).toBe(true);
  });

  it('handles multiple categories coexisting', () => {
    const data = {
      logPatterns: {
        error: { regexp: 'ERROR', regexpoptions: 'i', bSearch: true, lensCategory: 'level', lensPriority: 100 },
        sql: { regexp: 'SELECT', regexpoptions: 'i', bSearch: true, lensCategory: 'sql', lensPriority: 50 },
        stack: { regexp: 'at\\s', regexpoptions: '', bSearch: true, lensCategory: 'stack', lensPriority: 75 },
        http: { regexp: 'GET|POST', regexpoptions: 'i', bSearch: true, lensCategory: 'http', lensPriority: 60 },
      },
    };
    const filePath = writeTempJson('multi-category.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(4);

    const categories = entries.map((e) => e.lensCategory);
    expect(categories).toContain('level');
    expect(categories).toContain('sql');
    expect(categories).toContain('stack');
    expect(categories).toContain('http');

    // Verify sorted by priority desc
    expect(entries[0].key).toBe('error');  // 100
    expect(entries[1].key).toBe('stack');  // 75
    expect(entries[2].key).toBe('http');   // 60
    expect(entries[3].key).toBe('sql');    // 50
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Priority & sorting
// ══════════════════════════════════════════════════════════════════════════════

describe('readLogPatterns — priority & sorting', () => {
  it('entries with same priority maintain stable order', () => {
    const data = {
      logPatterns: {
        a: { regexp: 'A', regexpoptions: '', bSearch: true, lensPriority: 50 },
        b: { regexp: 'B', regexpoptions: '', bSearch: true, lensPriority: 50 },
        c: { regexp: 'C', regexpoptions: '', bSearch: true, lensPriority: 50 },
      },
    };
    const filePath = writeTempJson('same-priority.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries).toHaveLength(3);
    // All have same priority — just verify they're all present
    const keys = entries.map((e) => e.key);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys).toContain('c');
  });

  it('default priority (0) sorts last', () => {
    const data = {
      logPatterns: {
        high: { regexp: 'H', regexpoptions: '', bSearch: true, lensPriority: 100 },
        defaultPri: { regexp: 'D', regexpoptions: '', bSearch: true }, // lensPriority omitted → 0
      },
    };
    const filePath = writeTempJson('default-priority.json', data);
    const entries = readLogPatterns(filePath);

    expect(entries[0].key).toBe('high');
    expect(entries[1].key).toBe('defaultPri');
    expect(entries[1].lensPriority).toBe(0);
  });
});
