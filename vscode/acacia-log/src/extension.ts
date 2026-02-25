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
import { LogContext } from './utils/log-context';
import { LensStatusBar } from './logSearch/lensStatusBar';
import { readLogPatterns } from './utils/readLogPatterns';

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
			lensStatusBar.refresh();
		})
	);

	const lensStatusBar = new LensStatusBar(logLensDecorationProvider, context);
	context.subscriptions.push({ dispose: () => lensStatusBar.dispose() });

	function resolveLogPatternsPath(): string {
		const config = vscode.workspace.getConfiguration('acacia-log');
		const override = config.get<string>('patternsFilePath') ?? '';
		return override.trim() !== ''
			? override
			: require('path').join(
				vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
				'.vscode', 'logPatterns.json'
			);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.findLens', async (args: { key: string }) => {
			let patterns;
			try {
				patterns = readLogPatterns(resolveLogPatternsPath());
			} catch {
				return;
			}
			const pattern = patterns.find(p => p.key === args?.key);
			if (!pattern) { return; }
			await vscode.commands.executeCommand('editor.actions.findWithArgs', {
				searchString: pattern.regexp,
				isRegex: true,
				matchCase: !pattern.regexpoptions.includes('i'),
				findInSelection: false,
			});
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.toggleLensKey', (args: { key: string }) => {
			if (!args?.key) { return; }
			const current = logLensDecorationProvider.getLensVisible(args.key);
			logLensDecorationProvider.setLensVisible(args.key, !current);
			lensStatusBar.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('acacia-log.manageLenses', async () => {
			// ── 1. Load patterns ──────────────────────────────────────────
			let patterns;
			try {
				patterns = readLogPatterns(resolveLogPatternsPath());
			} catch {
				vscode.window.showErrorMessage('Acacia Log: could not read logPatterns.json');
				return;
			}
			const enabledPatterns = patterns.filter(p => p.lensEnabled);
			if (enabledPatterns.length === 0) {
				vscode.window.showInformationMessage('Acacia Log: no lenses defined in logPatterns.json');
				return;
			}

			// ── 2. Snapshot current visibility ────────────────────────────
			const before = new Map<string, boolean>(
				enabledPatterns.map(p => [p.key, logLensDecorationProvider.getLensVisible(p.key)])
			);

			// ── 3. Build QuickPick items ──────────────────────────────────
			type LensItem = vscode.QuickPickItem & { key: string };
			const items: LensItem[] = enabledPatterns.map(p => ({
				key: p.key,
				label: `$(circle-filled) ${p.lensLabel}`,
				description: `(${p.lensCategory})`,
				detail: p.regexp,
				picked: logLensDecorationProvider.getLensVisible(p.key),
			}));

			// ── 4. Show QuickPick ─────────────────────────────────────────
			const chosen = await vscode.window.showQuickPick(items, {
				canPickMany: true,
				title: 'Acacia Log — Manage Lenses',
				placeHolder: 'Select lenses to show',
			});

			// User cancelled (Escape) → do nothing
			if (chosen === undefined) { return; }

			// ── 5. Apply changes ──────────────────────────────────────────
			const chosenKeys = new Set(chosen.map((i: LensItem) => i.key));
			for (const p of enabledPatterns) {
				const newVisible = chosenKeys.has(p.key);
				if (before.get(p.key) !== newVisible) {
					logLensDecorationProvider.setLensVisible(p.key, newVisible);
				}
			}

			// ── 6. Persist to workspace settings ─────────────────────────
			const visibility: Record<string, boolean> = {};
			for (const p of enabledPatterns) {
				visibility[p.key] = logLensDecorationProvider.getLensVisible(p.key);
			}
			await vscode.workspace.getConfiguration('acacia-log').update(
				'lensVisibility',
				visibility,
				vscode.ConfigurationTarget.Workspace
			);

			// ── 7. Refresh status bar ─────────────────────────────────────
			lensStatusBar.refresh();
		})
	);

	// ── Sync lensVisibility setting → decoration provider ─────────────
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('acacia-log.lensVisibility')) {
				const saved = vscode.workspace.getConfiguration('acacia-log')
					.get<Record<string, boolean>>('lensVisibility', {}) ?? {};
				for (const [key, visible] of Object.entries(saved)) {
					logLensDecorationProvider.setLensVisible(key, visible);
				}
				lensStatusBar.refresh();
			}
		})
	);

	// ── LogContext singleton ───────────────────────────────────────────

	const logContext = LogContext.getInstance();
	context.subscriptions.push(logContext);

	// ── Register all commands ──────────────────────────────────────────

	registerConfigCommands(context);
	registerAnalysisCommands(context);
	registerTreeCommands(context, logTreeProvider, unifiedLogViewProvider, logContext);
	registerReportCommands(context, treeView, logContext);
	registerConversionCommands(context, treeView, logContext);
	registerViewCommands(context, unifiedLogViewProvider, editorToolsViewProvider, resultProvider);

	// ── Cleanup ────────────────────────────────────────────────────────

	context.subscriptions.push({ dispose: () => logTreeProvider.dispose() });

	const phase1 = performance.now();
	console.log(`[Acacia Log] Phase 1 (registration): ${(phase1 - start).toFixed(1)}ms`);

	// ── Phase 2: Deferred initialization (async, after activate returns) ──

	setTimeout(async () => {
		try {
			// Restore persisted lens visibility from workspace settings
			const savedVisibility = vscode.workspace.getConfiguration('acacia-log')
				.get<Record<string, boolean>>('lensVisibility', {}) ?? {};
			for (const [key, visible] of Object.entries(savedVisibility)) {
				logLensDecorationProvider.setLensVisible(key, visible);
			}

			// Ensure patterns file exists before lens provider reads it
			const { createLogPatterns } = require('./utils/createLogPatterns');
			await createLogPatterns();

			// Defer lens activation until first editor is visible
			if (vscode.window.visibleTextEditors.length > 0) {
				logLensDecorationProvider.activate();
				lensStatusBar.activate();
			} else {
				const lensActivationDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
					if (editors.length > 0) {
						logLensDecorationProvider.activate();
						lensStatusBar.activate();
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
