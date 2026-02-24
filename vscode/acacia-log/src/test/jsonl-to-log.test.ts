/**
 * Unit tests for jsonl-to-log.ts
 * Tests the JSONL-to-log conversion command with field detection and selection.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Track mock state ──────────────────────────────────────────────────────────

let quickPickCallIndex = 0;
let quickPickResponses: any[] = [];

const mockShowQuickPick = jest.fn().mockImplementation((items: any[], _opts?: any) => {
  const response = quickPickResponses[quickPickCallIndex++];
  if (response === null) { return Promise.resolve(undefined); } // simulate cancel
  if (Array.isArray(response)) {
    // Multi-select: return matching items
    return Promise.resolve(items.filter((it: any) => response.includes(it.label)));
  }
  // Single-select: find matching item by label or fieldName
  const found = items.find((it: any) => it.label === response || it.fieldName === response);
  return Promise.resolve(found);
});

const mockShowInformationMessage = jest.fn().mockResolvedValue(undefined);
const mockShowErrorMessage = jest.fn();
const mockShowWarningMessage = jest.fn().mockResolvedValue('Overwrite');
const mockShowTextDocument = jest.fn();
const mockOpenTextDocument = jest.fn().mockResolvedValue({});

jest.mock('vscode', () => ({
  window: {
    showQuickPick: (...args: any[]) => mockShowQuickPick(...args),
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
    showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
    showWarningMessage: (...args: any[]) => mockShowWarningMessage(...args),
    showTextDocument: (...args: any[]) => mockShowTextDocument(...args),
    withProgress: jest.fn().mockImplementation((_opts: any, task: any) => task({ report: jest.fn() })),
  },
  workspace: {
    openTextDocument: (...args: any[]) => mockOpenTextDocument(...args),
  },
  ProgressLocation: { Notification: 15 },
  Uri: { file: (p: string) => ({ fsPath: p }) },
}), { virtual: true });

import { convertJsonlToLog } from '../utils/jsonl-to-log';

// ── Test fixtures ─────────────────────────────────────────────────────────────

let tmpDir: string;

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function readOutput(jsonlPath: string): string {
  const ext = path.extname(jsonlPath);
  const base = path.basename(jsonlPath, ext);
  const outPath = path.join(path.dirname(jsonlPath), `${base}.log`);
  if (!fs.existsSync(outPath)) { return ''; }
  return fs.readFileSync(outPath, 'utf-8');
}

function cleanOutput(jsonlPath: string): void {
  const ext = path.extname(jsonlPath);
  const base = path.basename(jsonlPath, ext);
  const outPath = path.join(path.dirname(jsonlPath), `${base}.log`);
  if (fs.existsSync(outPath)) { fs.unlinkSync(outPath); }
}

/**
 * Set up QuickPick responses for the 4-step field selection:
 * 1. Timestamp field
 * 2. Level field
 * 3. Message field
 * 4. Extra fields (multi-select — provide array or empty array [])
 */
function setQuickPickSequence(
  tsField: string | null,
  lvlField: string | null,
  msgField: string | null,
  extras: string[] | null = []
) {
  quickPickCallIndex = 0;
  quickPickResponses = [tsField, lvlField, msgField, extras];
}

const STANDARD_JSONL = [
  '{"timestamp":"2026-01-15T10:00:00.000Z","message":"INFO startup","text":"2026-01-15 10:00:00 INFO startup"}',
  '{"timestamp":"2026-01-15T10:00:01.000Z","message":"ERROR failed","text":"2026-01-15 10:00:01 ERROR failed"}',
  '{"timestamp":"2026-01-15T10:00:02.000Z","message":"INFO done","text":"2026-01-15 10:00:02 INFO done"}',
].join('\n');

const VARIED_JSONL = [
  '{"level":"info","msg":"started","host":"server1"}',
  '{"level":"error","msg":"crashed","host":"server2"}',
].join('\n');

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-to-log-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('convertJsonlToLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quickPickCallIndex = 0;
    quickPickResponses = [];
    // Restore withProgress after clearAllMocks
    const vscode = require('vscode');
    vscode.window.withProgress = jest.fn().mockImplementation((_opts: any, task: any) => task({ report: jest.fn() }));
  });

  // ── Field detection ───────────────────────────────────────────────────────

  describe('field detection', () => {
    it('detects all fields and presents them in QuickPick', async () => {
      const filePath = writeTempFile('detect.jsonl', STANDARD_JSONL);
      // Select text field for all, cancel at extras
      setQuickPickSequence('timestamp', '$(circle-slash) (none)', 'text', []);

      await convertJsonlToLog(filePath);

      // showQuickPick should have been called 4 times (ts, level, msg, extras)
      expect(mockShowQuickPick).toHaveBeenCalledTimes(4);

      // First QuickPick call should contain all detected field names
      const firstCallItems = mockShowQuickPick.mock.calls[0][0];
      const labels = firstCallItems.map((it: any) => it.label);
      expect(labels).toContain('timestamp');
      expect(labels).toContain('message');
      expect(labels).toContain('text');

      cleanOutput(filePath);
    });

    it('detects union of fields across lines with different schemas', async () => {
      const mixed = [
        '{"a":"1","b":"2"}',
        '{"b":"3","c":"4"}',
      ].join('\n');
      const filePath = writeTempFile('mixed-fields.jsonl', mixed);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'a', []);

      await convertJsonlToLog(filePath);

      // QuickPick items should include a, b, c
      const firstCallItems = mockShowQuickPick.mock.calls[0][0];
      const labels = firstCallItems.map((it: any) => it.label);
      expect(labels).toContain('a');
      expect(labels).toContain('b');
      expect(labels).toContain('c');

      cleanOutput(filePath);
    });
  });

  // ── Field selection ─────────────────────────────────────────────────────

  describe('field selection', () => {
    it('extracts text field when user selects it as message', async () => {
      const filePath = writeTempFile('select-text.jsonl', STANDARD_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'text', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      expect(output).toContain('2026-01-15 10:00:00 INFO startup');
      expect(output).toContain('2026-01-15 10:00:01 ERROR failed');

      cleanOutput(filePath);
    });

    it('extracts message field when user selects it', async () => {
      const filePath = writeTempFile('select-msg.jsonl', STANDARD_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'message', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      expect(output).toContain('INFO startup');
      expect(output).toContain('ERROR failed');

      cleanOutput(filePath);
    });

    it('aborts gracefully when user cancels QuickPick', async () => {
      const filePath = writeTempFile('cancel.jsonl', STANDARD_JSONL);
      // Cancel at the first pick (timestamp)
      quickPickCallIndex = 0;
      quickPickResponses = [null]; // null = cancel

      await convertJsonlToLog(filePath);

      // Output file should NOT be created
      const outPath = filePath.replace('.jsonl', '.log');
      expect(fs.existsSync(outPath)).toBe(false);
    });

    it('combines timestamp, level, and message fields', async () => {
      const filePath = writeTempFile('combine.jsonl', VARIED_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', 'level', 'msg', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      const lines = output.split('\n').filter(l => l.trim());

      // level should be uppercased in brackets
      expect(lines[0]).toContain('[INFO]');
      expect(lines[0]).toContain('started');
      expect(lines[1]).toContain('[ERROR]');
      expect(lines[1]).toContain('crashed');

      cleanOutput(filePath);
    });

    it('includes extra fields when selected', async () => {
      const filePath = writeTempFile('extras.jsonl', VARIED_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'msg', ['host']);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      expect(output).toContain('host=server1');
      expect(output).toContain('host=server2');

      cleanOutput(filePath);
    });
  });

  // ── Output ──────────────────────────────────────────────────────────────

  describe('output', () => {
    it('writes output to .log file alongside source', async () => {
      const filePath = writeTempFile('output.jsonl', STANDARD_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'text', []);

      await convertJsonlToLog(filePath);

      const outPath = filePath.replace('.jsonl', '.log');
      expect(fs.existsSync(outPath)).toBe(true);

      cleanOutput(filePath);
    });

    it('preserves JSONL line order in output', async () => {
      const filePath = writeTempFile('order.jsonl', STANDARD_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'message', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      const lines = output.split('\n').filter(l => l.trim());
      expect(lines[0]).toContain('INFO startup');
      expect(lines[1]).toContain('ERROR failed');
      expect(lines[2]).toContain('INFO done');

      cleanOutput(filePath);
    });

    it('shows completion message with line count', async () => {
      const filePath = writeTempFile('done-msg.jsonl', STANDARD_JSONL);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'text', []);

      await convertJsonlToLog(filePath);

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('3'),
        expect.anything()
      );

      cleanOutput(filePath);
    });

    it('builds line from timestamp + level + message fields', async () => {
      const filePath = writeTempFile('full-build.jsonl', STANDARD_JSONL);
      setQuickPickSequence('timestamp', '$(circle-slash) (none)', 'message', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      const lines = output.split('\n').filter(l => l.trim());
      // Should have timestamp then message
      expect(lines[0]).toContain('2026-01-15T10:00:00.000Z');
      expect(lines[0]).toContain('INFO startup');

      cleanOutput(filePath);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('shows error for empty JSONL file', async () => {
      const filePath = writeTempFile('empty.jsonl', '');

      await convertJsonlToLog(filePath);

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('No JSON object keys')
      );
    });

    it('passes non-JSON lines through unchanged', async () => {
      const content = [
        '{"message":"valid line"}',
        'this is not json',
        '{"message":"another valid"}',
      ].join('\n');
      const filePath = writeTempFile('invalid-lines.jsonl', content);
      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'message', []);

      await convertJsonlToLog(filePath);

      const output = readOutput(filePath);
      expect(output).toContain('valid line');
      expect(output).toContain('this is not json');
      expect(output).toContain('another valid');

      cleanOutput(filePath);
    });

    it('handles file with only whitespace lines', async () => {
      const filePath = writeTempFile('whitespace.jsonl', '   \n  \n   ');

      await convertJsonlToLog(filePath);

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('No JSON object keys')
      );
    });

    it('handles non-existent file', async () => {
      const filePath = path.join(tmpDir, 'nonexistent.jsonl');

      await convertJsonlToLog(filePath);

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read')
      );
    });

    it('prompts for overwrite when output file exists', async () => {
      const filePath = writeTempFile('overwrite.jsonl', STANDARD_JSONL);
      const outPath = filePath.replace('.jsonl', '.log');
      fs.writeFileSync(outPath, 'old content');

      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'text', []);
      mockShowWarningMessage.mockResolvedValue('Overwrite');

      await convertJsonlToLog(filePath);

      expect(mockShowWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
        expect.anything(),
        expect.anything()
      );

      // Should have overwritten
      const newOutput = readOutput(filePath);
      expect(newOutput).not.toBe('old content');

      cleanOutput(filePath);
    });

    it('aborts when user declines overwrite', async () => {
      const filePath = writeTempFile('no-overwrite.jsonl', STANDARD_JSONL);
      const outPath = filePath.replace('.jsonl', '.log');
      fs.writeFileSync(outPath, 'old content');

      setQuickPickSequence('$(circle-slash) (none)', '$(circle-slash) (none)', 'text', []);
      mockShowWarningMessage.mockResolvedValue(undefined);

      await convertJsonlToLog(filePath);

      // Old content preserved
      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toBe('old content');

      fs.unlinkSync(outPath);
    });
  });
});
