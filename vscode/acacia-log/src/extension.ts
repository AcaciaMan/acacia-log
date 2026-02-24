import * as vscode from 'vscode';
import { LogTreeProvider } from './logManagement/logTreeProvider';
import { UnifiedLogViewProvider } from './logSearch/unifiedLogViewProvider';
import { EditorToolsViewProvider } from './logSearch/editorToolsViewProvider';
import { ResultDocumentProvider } from './utils/resultDocumentProvider';
import { LogLensDecorationProvider } from './logSearch/logLensDecorationProvider';
import { registerConfigCommands } from './commands/configCommands';
import { registerAnalysisCommands } from './commands/analysisCommands';
import { registerTreeCommands } from './commands/treeCommands';
import { registerReportCommands } from './commands/reportCommands';
import { registerConversionCommands } from './commands/conversionCommands';
import { registerViewCommands } from './commands/viewCommands';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {

	const start = performance.now();

	// ── Phase 1: Instant registration (<10ms target) ──────────────────

	// Hello World demo command
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from acacia-log!');
		})
	);

	// ── Providers ──────────────────────────────────────────────────────

	const unifiedLogViewProvider = new UnifiedLogViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(UnifiedLogViewProvider.viewType, unifiedLogViewProvider)
	);

	const resultProvider = ResultDocumentProvider.getInstance(context.extensionPath);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('acacia-log', resultProvider)
	);

	const logTreeProvider = new LogTreeProvider(context);
	vscode.commands.executeCommand('setContext', 'acacia-log.filterActive', false);
	const treeView = vscode.window.createTreeView('acacia-log.logExplorer', {
		treeDataProvider: logTreeProvider,
		showCollapseAll: true,
		canSelectMany: true
	});
	context.subscriptions.push(treeView);

	const editorToolsViewProvider = new EditorToolsViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(EditorToolsViewProvider.viewType, editorToolsViewProvider)
	);

	const logLensDecorationProvider = new LogLensDecorationProvider(context);
	context.subscriptions.push({ dispose: () => logLensDecorationProvider.dispose() });
	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.toggleLensDecorations', () => {
			logLensDecorationProvider.toggle();
		})
	);

	// ── Track current log file ─────────────────────────────────────────

	let currentLogFile: string | undefined;
	const getCurrentLogFile = () => currentLogFile;
	const setCurrentLogFile = (path: string | undefined) => { currentLogFile = path; };

	// ── Register all commands ──────────────────────────────────────────

	registerConfigCommands(context);
	registerAnalysisCommands(context);
	registerTreeCommands(context, logTreeProvider, treeView, unifiedLogViewProvider, editorToolsViewProvider, setCurrentLogFile);
	registerReportCommands(context, treeView, getCurrentLogFile);
	registerConversionCommands(context, treeView, getCurrentLogFile);
	registerViewCommands(context, unifiedLogViewProvider, editorToolsViewProvider, resultProvider);

	// ── Cleanup ────────────────────────────────────────────────────────

	context.subscriptions.push({ dispose: () => logTreeProvider.dispose() });

	const phase1 = performance.now();
	console.log(`[Acacia Log] Phase 1 (registration): ${(phase1 - start).toFixed(1)}ms`);

	// ── Phase 2: Deferred initialization (async, after activate returns) ──

	setTimeout(async () => {
		try {
			// Ensure patterns file exists before lens provider reads it
			const { createLogPatterns } = require('./utils/createLogPatterns');
			await createLogPatterns();

			// Defer lens activation until first editor is visible
			if (vscode.window.visibleTextEditors.length > 0) {
				logLensDecorationProvider.activate();
			} else {
				const lensActivationDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
					if (editors.length > 0) {
						logLensDecorationProvider.activate();
						lensActivationDisposable.dispose();
					}
				});
				context.subscriptions.push(lensActivationDisposable);
			}

			const phase2 = performance.now();
			console.log(`[Acacia Log] Phase 2 (deferred init): ${(phase2 - phase1).toFixed(1)}ms`);
			console.log(`[Acacia Log] Total activation: ${(phase2 - start).toFixed(1)}ms`);
		} catch (err) {
			console.error('[Acacia Log] Phase 2 initialization error:', err);
		}
	}, 0);
}

// This method is called when your extension is deactivated
export function deactivate() {}
