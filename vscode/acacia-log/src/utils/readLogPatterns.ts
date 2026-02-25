import * as fs from 'fs';
import * as path from 'path';

/** Known grouping categories for lens entries. */
export type LensCategory = 'level' | 'sql' | 'stack' | 'config' | 'http' | 'retry' | 'custom';

export interface LogPattern {
  regexp: string;
  regexpoptions: string;
  bSearch: boolean;
  // Lens fields — all optional for backward compatibility
  lensEnabled?: boolean;
  lensCategory?: LensCategory;
  lensLabel?: string;
  lensColor?: string;
  lensPriority?: number;
  lensShowInStatusBar?: boolean;
}

interface LogPatterns {
  [key: string]: LogPattern;
}

interface LogPatternsFile {
  logPatterns: LogPatterns;
}

/** Fields shared with callers that only need search behaviour. */
export interface LogPatternEntry {
  key: string;
  regexp: string;
  regexpoptions: string;
  // Resolved lens fields (defaults applied)
  lensEnabled: boolean;
  lensCategory: LensCategory;
  lensLabel: string;
  lensColor: string | undefined;
  lensPriority: number;
  lensShowInStatusBar: boolean;
}

/** Default colour palette used when lensColor is absent, keyed by lensCategory. */
const DEFAULT_LENS_COLORS: Record<LensCategory, string> = {
  level:  '#8888ff',
  sql:    '#d48806',
  stack:  '#cf1322',
  config: '#08979c',
  http:   '#389e0d',
  retry:  '#c41d7f',
  custom: '#597ef7',
};

/** Infer a default lensCategory for well-known keys; fall back to 'custom'. */
function inferCategory(key: string): LensCategory {
  const levelKeys = ['error', 'warn', 'warning', 'info', 'debug', 'trace', 'fatal', 'critical'];
  const lower = key.toLowerCase();
  if (levelKeys.some(k => lower.includes(k))) { return 'level'; }
  if (lower.includes('sql') || lower.includes('query')) { return 'sql'; }
  if (lower.includes('stack') || lower.includes('exception')) { return 'stack'; }
  if (lower.includes('config')) { return 'config'; }
  if (lower.includes('http') || lower.includes('request') || lower.includes('response')) { return 'http'; }
  if (lower.includes('retry')) { return 'retry'; }
  return 'custom';
}

export function readLogPatterns(filePath: string): LogPatternEntry[] {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  const logPatternsFile: LogPatternsFile = JSON.parse(fileContent);

  return Object.entries(logPatternsFile.logPatterns)
    .filter(([_, pattern]) => pattern.bSearch)
    .map(([key, pattern]) => {
      // Ensure the global flag is present for search use
      const regexpoptions = pattern.regexpoptions.includes('g')
        ? pattern.regexpoptions
        : pattern.regexpoptions + 'g';

      const lensCategory: LensCategory =
        pattern.lensCategory ?? inferCategory(key);

      return {
        key,
        regexp: pattern.regexp,
        regexpoptions,
        lensEnabled:  pattern.lensEnabled  ?? true,
        lensCategory,
        lensLabel:    pattern.lensLabel    ?? key,
        lensColor:    pattern.lensColor    ?? DEFAULT_LENS_COLORS[lensCategory],
        lensPriority: pattern.lensPriority ?? 0,
        lensShowInStatusBar: pattern.lensShowInStatusBar ?? true,
      };
    })
    .sort((a, b) => b.lensPriority - a.lensPriority);
}