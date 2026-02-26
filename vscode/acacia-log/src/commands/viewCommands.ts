import * as vscode from 'vscode';
import { ResultDocumentProvider } from '../utils/resultDocumentProvider';

export function registerViewCommands(
    context: vscode.ExtensionContext,
    resultProvider: ResultDocumentProvider
): void {
    // ── Load more context above current chunk ──────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.loadMoreAbove', async () => {
            const resultProvider = ResultDocumentProvider.getInstance();
            const state = resultProvider.getChunkState();
            if (!state) {
                vscode.window.showWarningMessage('[Acacia Log] No chunk loaded yet.');
                return;
            }

            const STEP = 100;
            const newCtxStart = Math.max(0, state.ctxStart - STEP);
            if (newCtxStart === state.ctxStart) {
                vscode.window.showInformationMessage('[Acacia Log] Already at the start of file.');
                return;
            }

            const { readLineRange } = require('../utils/log-file-reader');
            const { lines } = await readLineRange(
                state.filePath, newCtxStart, state.ctxEnd, state.lineIndex
            );

            const padWidth = String(state.ctxEnd + 1).length;
            const header =
                `// File: ${state.filePath}\n` +
                `// Matched line: ${state.matchedLine + 1}\n` +
                `// Showing lines ${newCtxStart + 1}\u2013${state.ctxEnd + 1} of ${state.totalLines}\n`;
            const body = lines
                .map((line: string, i: number) => {
                    const realLineNum = newCtxStart + i + 1;
                    return `${String(realLineNum).padStart(padWidth, ' ')}: ${line}`;
                })
                .join('\n');

            const resultEditor = await resultProvider.openLogChunkResult(header + body);

            // Keep matched line visible
            const lineInChunk = state.matchedLine - newCtxStart;
            const virtualLine = 3 + lineInChunk;
            const pos = new vscode.Position(virtualLine, 0);
            resultEditor.selection = new vscode.Selection(pos, pos);
            resultEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

            resultProvider.setChunkState({ ...state, ctxStart: newCtxStart });
        })
    );

    // ── Load more context below current chunk ──────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.loadMoreBelow', async () => {
            const resultProvider = ResultDocumentProvider.getInstance();
            const state = resultProvider.getChunkState();
            if (!state) {
                vscode.window.showWarningMessage('[Acacia Log] No chunk loaded yet.');
                return;
            }

            const STEP = 100;
            const newCtxEnd = Math.min(state.totalLines - 1, state.ctxEnd + STEP);
            if (newCtxEnd === state.ctxEnd) {
                vscode.window.showInformationMessage('[Acacia Log] Already at the end of file.');
                return;
            }

            const { readLineRange } = require('../utils/log-file-reader');
            const { lines } = await readLineRange(
                state.filePath, state.ctxStart, newCtxEnd, state.lineIndex
            );

            const padWidth = String(newCtxEnd + 1).length;
            const header =
                `// File: ${state.filePath}\n` +
                `// Matched line: ${state.matchedLine + 1}\n` +
                `// Showing lines ${state.ctxStart + 1}\u2013${newCtxEnd + 1} of ${state.totalLines}\n`;
            const body = lines
                .map((line: string, i: number) => {
                    const realLineNum = state.ctxStart + i + 1;
                    return `${String(realLineNum).padStart(padWidth, ' ')}: ${line}`;
                })
                .join('\n');

            const resultEditor = await resultProvider.openLogChunkResult(header + body);

            // Keep matched line visible
            const lineInChunk = state.matchedLine - state.ctxStart;
            const virtualLine = 3 + lineInChunk;
            const pos = new vscode.Position(virtualLine, 0);
            resultEditor.selection = new vscode.Selection(pos, pos);
            resultEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

            resultProvider.setChunkState({ ...state, ctxEnd: newCtxEnd });
        })
    );
}
