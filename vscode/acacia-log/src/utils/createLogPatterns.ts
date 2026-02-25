import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function createLogPatterns(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const vscodeFolderPath = path.join(workspacePath, '.vscode');
  const logPatternsFilePath = path.join(vscodeFolderPath, 'logPatterns.json');

  if (!(await pathExists(vscodeFolderPath))) {
    await fs.promises.mkdir(vscodeFolderPath, { recursive: true });
  }

  if (!(await pathExists(logPatternsFilePath))) {
    const defaultLogPatterns = {
      logPatterns: {
        error: {
          regexp: 'ERROR',
          regexpoptions: 'ig',
          bSearch: true,
          lensEnabled: true,
          lensCategory: 'level',
          lensLabel: 'Error',
          lensColor: '#ff4d4f',
          lensPriority: 100,
          lensShowInStatusBar: true
        },
        warn: {
          regexp: 'WARN',
          regexpoptions: 'ig',
          bSearch: true,
          lensEnabled: true,
          lensCategory: 'level',
          lensLabel: 'Warning',
          lensColor: '#faad14',
          lensPriority: 90,
          lensShowInStatusBar: true
        },
        info: {
          regexp: 'INFO',
          regexpoptions: 'ig',
          bSearch: true,
          lensEnabled: true,
          lensCategory: 'level',
          lensLabel: 'Info',
          lensColor: '#40a9ff',
          lensPriority: 80,
          lensShowInStatusBar: true
        }
      }
    };

    await fs.promises.writeFile(logPatternsFilePath, JSON.stringify(defaultLogPatterns, null, 2));
    vscode.window.showInformationMessage('logPatterns.json created in .vscode folder');
  }
}