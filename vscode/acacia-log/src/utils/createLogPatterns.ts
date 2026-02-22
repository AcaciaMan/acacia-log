import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function createLogPatterns() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const vscodeFolderPath = path.join(workspacePath, '.vscode');
  const logPatternsFilePath = path.join(vscodeFolderPath, 'logPatterns.json');

  if (!fs.existsSync(vscodeFolderPath)) {
    fs.mkdirSync(vscodeFolderPath);
  }

  if (!fs.existsSync(logPatternsFilePath)) {
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
          lensPriority: 100
        },
        warn: {
          regexp: 'WARN',
          regexpoptions: 'ig',
          bSearch: true,
          lensEnabled: true,
          lensCategory: 'level',
          lensLabel: 'Warning',
          lensColor: '#faad14',
          lensPriority: 90
        },
        info: {
          regexp: 'INFO',
          regexpoptions: 'ig',
          bSearch: true,
          lensEnabled: true,
          lensCategory: 'level',
          lensLabel: 'Info',
          lensColor: '#40a9ff',
          lensPriority: 80
        }
      }
    };

    fs.writeFileSync(logPatternsFilePath, JSON.stringify(defaultLogPatterns, null, 2));
    vscode.window.showInformationMessage('logPatterns.json created in .vscode folder');
  }
}