/**
 * Unit tests for createLogPatterns.ts
 * Tests creation of logPatterns.json in the .vscode folder.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockShowErrorMessage = jest.fn();
const mockShowInformationMessage = jest.fn();

jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
  },
  window: {
    showErrorMessage: mockShowErrorMessage,
    showInformationMessage: mockShowInformationMessage,
  },
}), { virtual: true });

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      access: jest.fn(),
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  };
});

import { createLogPatterns } from '../utils/createLogPatterns';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createLogPatterns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error message when no workspace folders', async () => {
    // Temporarily override workspaceFolders
    const vscode = require('vscode');
    const original = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = undefined;

    await createLogPatterns();

    expect(mockShowErrorMessage).toHaveBeenCalledWith('No workspace folder found');

    vscode.workspace.workspaceFolders = original;
  });

  it('creates .vscode folder if it does not exist', async () => {
    (fs.promises.access as jest.Mock)
      .mockRejectedValueOnce(new Error('ENOENT'))   // .vscode folder does not exist
      .mockRejectedValueOnce(new Error('ENOENT'));   // logPatterns.json does not exist

    await createLogPatterns();

    expect(fs.promises.mkdir).toHaveBeenCalledWith(
      path.join('/mock/workspace', '.vscode'),
      { recursive: true }
    );
  });

  it('does not create .vscode folder if it already exists', async () => {
    (fs.promises.access as jest.Mock)
      .mockResolvedValueOnce(undefined)    // .vscode folder exists
      .mockRejectedValueOnce(new Error('ENOENT'));  // logPatterns.json does not exist

    await createLogPatterns();

    expect(fs.promises.mkdir).not.toHaveBeenCalled();
  });

  it('writes logPatterns.json with default patterns when file does not exist', async () => {
    (fs.promises.access as jest.Mock)
      .mockResolvedValueOnce(undefined)    // .vscode folder exists
      .mockRejectedValueOnce(new Error('ENOENT'));  // logPatterns.json does not exist

    await createLogPatterns();

    const expectedPath = path.join('/mock/workspace', '.vscode', 'logPatterns.json');
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expectedPath,
      expect.any(String)
    );

    // Verify the written content contains expected patterns
    const writtenContent = (fs.promises.writeFile as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.logPatterns).toBeDefined();
    expect(parsed.logPatterns.error).toBeDefined();
    expect(parsed.logPatterns.error.regexp).toBe('ERROR');
    expect(parsed.logPatterns.warn).toBeDefined();
    expect(parsed.logPatterns.warn.regexp).toBe('WARN');
    expect(parsed.logPatterns.info).toBeDefined();
    expect(parsed.logPatterns.info.regexp).toBe('INFO');
  });

  it('shows information message after creating logPatterns.json', async () => {
    (fs.promises.access as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'));

    await createLogPatterns();

    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      'logPatterns.json created in .vscode folder'
    );
  });

  it('does not overwrite logPatterns.json if it already exists', async () => {
    (fs.promises.access as jest.Mock)
      .mockResolvedValueOnce(undefined)    // .vscode folder exists
      .mockResolvedValueOnce(undefined);   // logPatterns.json exists

    await createLogPatterns();

    expect(fs.promises.writeFile).not.toHaveBeenCalled();
    expect(mockShowInformationMessage).not.toHaveBeenCalled();
  });

  it('default patterns have correct structure', async () => {
    (fs.promises.access as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'));

    await createLogPatterns();

    const writtenContent = (fs.promises.writeFile as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);

    // Check error pattern structure
    expect(parsed.logPatterns.error).toEqual({
      regexp: 'ERROR',
      regexpoptions: 'ig',
      bSearch: true,
      lensEnabled: true,
      lensCategory: 'level',
      lensLabel: 'Error',
      lensColor: '#ff4d4f',
      lensPriority: 100,
      lensShowInStatusBar: true,
    });

    // Check warn pattern structure
    expect(parsed.logPatterns.warn).toEqual({
      regexp: 'WARN',
      regexpoptions: 'ig',
      bSearch: true,
      lensEnabled: true,
      lensCategory: 'level',
      lensLabel: 'Warning',
      lensColor: '#faad14',
      lensPriority: 90,
      lensShowInStatusBar: true,
    });

    // Check info pattern structure
    expect(parsed.logPatterns.info).toEqual({
      regexp: 'INFO',
      regexpoptions: 'ig',
      bSearch: true,
      lensEnabled: true,
      lensCategory: 'level',
      lensLabel: 'Info',
      lensColor: '#40a9ff',
      lensPriority: 80,
      lensShowInStatusBar: true,
    });
  });
});
