/**
 * Unit tests for navigateToLine.ts
 * Tests opening a file and navigating to a specific line.
 */

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockRevealRange = jest.fn();
const mockEditor = {
  selection: null as any,
  revealRange: mockRevealRange,
};

const mockShowTextDocument = jest.fn().mockResolvedValue(mockEditor);
const mockOpenTextDocument = jest.fn().mockResolvedValue({});

jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((p: string) => ({ fsPath: p, toString: () => `file://${p}`, scheme: 'file' })),
  },
  workspace: {
    openTextDocument: mockOpenTextDocument,
  },
  window: {
    showTextDocument: mockShowTextDocument,
  },
  Position: jest.fn().mockImplementation((line: number, char: number) => ({ line, character: char })),
  Selection: jest.fn().mockImplementation((anchor: any, active: any) => ({ anchor, active })),
  Range: jest.fn().mockImplementation((start: any, end: any) => ({ start, end })),
  ViewColumn: { One: 1, Beside: 2 },
  TextEditorRevealType: { InCenter: 2 },
}), { virtual: true });

import { navigateToLine } from '../utils/navigateToLine';

const vscode = require('vscode');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('navigateToLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEditor.selection = null;
  });

  it('opens the file and navigates to the specified line', async () => {
    await navigateToLine('/path/to/file.log', 42);

    expect(vscode.Uri.file).toHaveBeenCalledWith('/path/to/file.log');
    expect(mockOpenTextDocument).toHaveBeenCalled();
    expect(mockShowTextDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ viewColumn: 1, preview: false })
    );
  });

  it('sets the cursor position to the correct line (0-based)', async () => {
    await navigateToLine('/path/to/file.log', 10);

    // Position should be created with line 9 (1-based → 0-based)
    expect(vscode.Position).toHaveBeenCalledWith(9, 0);
  });

  it('creates a selection at the target position', async () => {
    await navigateToLine('/path/to/file.log', 5);

    expect(vscode.Selection).toHaveBeenCalled();
    expect(mockEditor.selection).not.toBeNull();
  });

  it('reveals the range in the center of the editor', async () => {
    await navigateToLine('/path/to/file.log', 5);

    expect(vscode.Range).toHaveBeenCalled();
    expect(mockRevealRange).toHaveBeenCalledWith(
      expect.anything(),
      2 // TextEditorRevealType.InCenter
    );
  });

  it('clamps line number to 0 when line is 0', async () => {
    await navigateToLine('/path/to/file.log', 0);

    // Math.max(0, 0 - 1) = 0
    expect(vscode.Position).toHaveBeenCalledWith(0, 0);
  });

  it('clamps line number to 0 when line is negative', async () => {
    await navigateToLine('/path/to/file.log', -5);

    // Math.max(0, -5 - 1) = 0
    expect(vscode.Position).toHaveBeenCalledWith(0, 0);
  });

  it('handles line 1 correctly (first line)', async () => {
    await navigateToLine('/path/to/file.log', 1);

    // Math.max(0, 1 - 1) = 0
    expect(vscode.Position).toHaveBeenCalledWith(0, 0);
  });
});
