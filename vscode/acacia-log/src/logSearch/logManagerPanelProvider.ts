import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogContext } from '../utils/log-context';

/**
 * Log Manager Panel Provider
 *
 * Manages a singleton WebviewPanel in the editor area that consolidates all
 * log-analysis tools: Log Search, Pattern Search, Similar Lines, Timeline,
 * File Info, Compare Chunk Stats, and JSONL Conversion.
 */
export class LogManagerPanelProvider {
    public static readonly viewType = 'acacia-log.logManagerPanel';

    private static readonly LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

    private _panel?: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _updateTimer?: ReturnType<typeof setTimeout>;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    // ═══════════════════════════════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Open or reveal the Log Manager panel.
     * If already open, brings it to the front. When `initialTab` is given
     * the webview switches to that tab after (re-)revealing.
     */
    public openPanel(initialTab?: string): void {
        // Re-use existing panel
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            if (initialTab) {
                this._panel.webview.postMessage({ command: 'switchTab', tabName: initialTab });
            }
            return;
        }

        // Create new panel
        this._panel = vscode.window.createWebviewPanel(
            LogManagerPanelProvider.viewType,
            'Log Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        this._panel.webview.html = this._getHtml();

        // Cleanup on close
        this._panel.onDidDispose(() => {
            this._panel = undefined;
            this._disposables.forEach(d => d.dispose());
            this._disposables = [];
        });

        this._setupMessageHandling();
        this._sendInitialValues();
        this._setupLogContextListener();

        if (initialTab) {
            this._panel.webview.postMessage({ command: 'switchTab', tabName: initialTab });
        }
    }

    /**
     * Programmatically switch the panel to a given tab (if open).
     */
    public switchTab(tabName: string): void {
        this._panel?.webview.postMessage({ command: 'switchTab', tabName });
    }

    /**
     * Forward file-info data to the panel (used by tree-view click handler).
     */
    public async showFileInfo(fileUri: vscode.Uri, metadata?: {
        size?: number;
        lastModified?: Date;
        created?: Date;
        totalLines?: number;
        timestampPattern?: string;
        timestampDetected?: boolean;
        formatDisplay?: string;
    }): Promise<void> {
        if (!this._panel) { return; }

        try {
            const stats = await fs.promises.stat(fileUri.fsPath);
            const fileName = path.basename(fileUri.fsPath);

            this._reply({
                command: 'showFileInfo',
                fileUri: fileUri.toString(),
                fileName,
                filePath: fileUri.fsPath,
                fileSize: this._formatSize(metadata?.size || stats.size),
                createdDate: stats.birthtime.toLocaleString(),
                modifiedDate: stats.mtime.toLocaleString(),
                accessedDate: stats.atime.toLocaleString(),
                totalLines: metadata?.totalLines,
                timestampPattern: metadata?.timestampPattern,
                timestampDetected: metadata?.timestampDetected,
                formatDisplay: metadata?.formatDisplay
            });
        } catch (err) {
            console.error('[LogManagerPanel] Error showing file info:', err);
        }
    }

    /**
     * Dispose the panel and all listeners.
     */
    public dispose(): void {
        if (this._updateTimer) { clearTimeout(this._updateTimer); }
        this._panel?.dispose();
        // onDidDispose callback will clean _disposables
    }

    // ═══════════════════════════════════════════════════════════════════
    // Message handling
    // ═══════════════════════════════════════════════════════════════════

    private _setupMessageHandling(): void {
        const disposable = this._panel!.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    await this._handleMessage(message);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
                    console.error('[LogManagerPanel] Error handling message:', error);
                    vscode.window.showErrorMessage(`Error: ${errorMessage}`);
                    this._reply({ command: 'operationComplete', success: false, message: errorMessage });
                }
            }
        );
        this._disposables.push(disposable);
    }

    private async _handleMessage(message: any): Promise<void> {
        switch (message.command) {

            // ─── Log Search ──────────────────────────────────────────────
            case 'search': {
                const cfg = vscode.workspace.getConfiguration('acacia-log');
                await cfg.update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
                await cfg.update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);
                await cfg.update('logSearchDate', message.searchDate, vscode.ConfigurationTarget.Workspace);
                await cfg.update('logSearchTime', message.searchTime, vscode.ConfigurationTarget.Workspace);

                const searchEditor = await LogContext.getInstance().resolveEditor();
                if (!searchEditor) {
                    const msg = 'No log file available. Open a log file or select one in the Log Explorer.';
                    vscode.window.showErrorMessage(msg);
                    this._reply({ command: 'operationComplete', success: false, message: msg });
                    return;
                }

                const { navigateToDateTime } = require('../utils/navigateToDateTime');
                await navigateToDateTime();
                this._reply({ command: 'operationComplete', success: true, message: 'Navigation completed successfully' });
                return;
            }

            // ─── Similar Lines ───────────────────────────────────────────
            case 'calculateSimilarLineCounts': {
                const cfg = vscode.workspace.getConfiguration('acacia-log');
                await cfg.update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
                await cfg.update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);

                const slcEditor = await LogContext.getInstance().resolveEditor();
                if (!slcEditor) {
                    const msg = 'No log file available. Open a log file or select one in the Log Explorer.';
                    vscode.window.showErrorMessage(msg);
                    this._reply({ command: 'operationComplete', success: false, message: msg });
                    return;
                }

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing similar lines...',
                    cancellable: false
                }, async () => {
                    const { calculateSimilarLineCounts } = require('../utils/calculateSimilarLineCounts');
                    await calculateSimilarLineCounts(slcEditor);
                });
                this._reply({ command: 'operationComplete', success: true, message: 'Similar line counts calculated successfully' });
                return;
            }

            // ─── Timeline ────────────────────────────────────────────────
            case 'drawLogTimeline': {
                const cfg = vscode.workspace.getConfiguration('acacia-log');
                await cfg.update('logDateRegex', message.logTimeRegex, vscode.ConfigurationTarget.Workspace);
                await cfg.update('logDateFormat', message.logTimeFormat, vscode.ConfigurationTarget.Workspace);

                const timelineEditor = await LogContext.getInstance().resolveEditor();
                if (!timelineEditor) {
                    const msg = 'No log file available. Open a log file or select one in the Log Explorer.';
                    vscode.window.showErrorMessage(msg);
                    this._reply({ command: 'operationComplete', success: false, message: msg });
                    return;
                }

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Drawing timeline...',
                    cancellable: false
                }, async () => {
                    const { drawLogTimeline } = require('../utils/drawLogTimeline');
                    await drawLogTimeline(timelineEditor);
                });
                this._reply({ command: 'operationComplete', success: true, message: 'Timeline drawn successfully' });
                return;
            }

            // ─── Test Regex ──────────────────────────────────────────────
            case 'testRegex': {
                const testEditor = await LogContext.getInstance().resolveEditor();
                if (!testEditor) {
                    this._reply({ command: 'testRegexResult', success: false, message: '✗ No log file available. Open a log file or select one in the Log Explorer.' });
                    return;
                }

                try {
                    const pat = new RegExp(message.logTimeRegex);
                    const doc = testEditor.document;
                    let count = 0;
                    let first = '';
                    let last = '';
                    const limit = Math.min(doc.lineCount, 1000);

                    for (let i = 0; i < limit; i++) {
                        const m = doc.lineAt(i).text.match(pat);
                        if (m) {
                            count++;
                            if (count === 1) { first = m[0]; }
                            last = m[0];
                        }
                    }

                    if (count > 0) {
                        let msg = `✓ Found ${count} match(es) in first ${limit} lines\nFirst: "${first}"`;
                        if (count > 1) { msg += `\nLast: "${last}"`; }
                        this._reply({ command: 'testRegexResult', success: true, message: msg });
                    } else {
                        this._reply({ command: 'testRegexResult', success: false, message: `✗ No matches found in first ${limit} lines.` });
                    }
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    this._reply({ command: 'testRegexResult', success: false, message: `✗ Invalid regex: ${msg}\n\nCommon issues:\n• Unescaped special chars (use \\\\ for literal \\)\n• Unclosed groups or brackets` });
                }
                return;
            }

            // ─── Auto-detect Timestamp ───────────────────────────────────
            case 'autoDetectTimestampFormat': {
                const detectEditor = await LogContext.getInstance().resolveEditor();
                if (!detectEditor) {
                    this._reply({
                        command: 'timestampFormatDetected', success: false, detected: false,
                        message: '✗ No log file available. Open a log file or select one in the Log Explorer.',
                        tab: message.tab
                    });
                    return;
                }

                try {
                    const { getOrDetectFormat, getRegexPatternString } = require('../utils/format-cache');
                    const detection = await getOrDetectFormat(detectEditor.document);

                    if (detection.detected && detection.format) {
                        const regexPattern = getRegexPatternString(detection.format);
                        const formatMap: Record<string, string> = {
                            'yyyy-MM-ddTHH:mm:ss.SSS': "yyyy-MM-dd'T'HH:mm:ss.SSS",
                            'yyyy-MM-dd HH:mm:ss.SSS': 'yyyy-MM-dd HH:mm:ss.SSS',
                            'yyyy-MM-dd HH:mm:ss': 'yyyy-MM-dd HH:mm:ss',
                            'yyyy-MM-dd': 'yyyy-MM-dd',
                            'dd-MM-yyyy HH:mm': 'dd-MM-yyyy HH:mm',
                            'MM-dd-yyyy HH:mm': 'MM-dd-yyyy HH:mm',
                            'dd/MM/yyyy HH:mm:ss': 'dd/MM/yyyy HH:mm:ss',
                            'dd/MM/yyyy HH:mm': 'dd/MM/yyyy HH:mm',
                            'MM/dd/yyyy HH:mm:ss': 'MM/dd/yyyy HH:mm:ss',
                            'MM/dd/yyyy HH:mm': 'MM/dd/yyyy HH:mm',
                            'dd.MM.yyyy HH:mm:ss': 'dd.MM.yyyy HH:mm:ss',
                            'dd.MM.yyyy HH:mm': 'dd.MM.yyyy HH:mm',
                        };
                        const fmt = formatMap[detection.format.pattern] || detection.format.pattern;

                        this._reply({
                            command: 'timestampFormatDetected', success: true, detected: true,
                            regex: regexPattern, format: fmt, pattern: detection.format.pattern,
                            totalLines: detection.totalLines,
                            message: `✓ Detected: ${detection.format.pattern}`,
                            tab: message.tab
                        });
                    } else {
                        this._reply({
                            command: 'timestampFormatDetected', success: false, detected: false,
                            message: '✗ Could not detect timestamp format',
                            tab: message.tab
                        });
                    }
                } catch (e) {
                    this._reply({
                        command: 'timestampFormatDetected', success: false, detected: false,
                        message: `✗ Error: ${e instanceof Error ? e.message : e}`,
                        tab: message.tab
                    });
                }
                return;
            }

            // ─── Pattern Search ──────────────────────────────────────────
            case 'searchPatterns': {
                const logFilePath = message.logFilePath as string;
                const patternFilePath = message.searchPatternsFilePath as string;

                if (!fs.existsSync(logFilePath)) {
                    const msg = `Log file not found: ${logFilePath}`;
                    vscode.window.showErrorMessage(msg);
                    this._reply({ command: 'operationComplete', success: false, message: msg });
                    return;
                }

                if (!fs.existsSync(patternFilePath)) {
                    const msg = `Search patterns file not found: ${patternFilePath}`;
                    vscode.window.showErrorMessage(msg);
                    this._reply({ command: 'operationComplete', success: false, message: msg });
                    return;
                }

                // Persist paths
                const cfg = vscode.workspace.getConfiguration('acacia-log');
                await cfg.update('logFilePath', logFilePath, vscode.ConfigurationTarget.Workspace);
                await cfg.update('patternsFilePath', patternFilePath, vscode.ConfigurationTarget.Workspace);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Searching patterns...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: 'Loading patterns...' });
                    const { readLogPatterns } = require('../utils/readLogPatterns');
                    const searchPatterns = readLogPatterns(patternFilePath);

                    progress.report({ message: `Searching ${searchPatterns.length} patterns...` });
                    const results = await this._searchLogFile(logFilePath, searchPatterns);

                    progress.report({ message: 'Rendering results...' });
                    // Reshape for ResultDocumentProvider
                    interface SearchResult { count: number; line_match: string[]; }
                    const editorResults: { [pattern: string]: SearchResult } = {};
                    for (const pattern in results) {
                        editorResults[pattern] = {
                            count: results[pattern].count,
                            line_match: results[pattern].lines.map(
                                (line: number, index: number) => `${line}: ${results[pattern].matches[index]}`
                            )
                        };
                    }

                    const { ResultDocumentProvider } = require('../utils/resultDocumentProvider');
                    const resultProvider = ResultDocumentProvider.getInstance(this.context.extensionPath);
                    await resultProvider.openPatternSearchResult(editorResults, logFilePath);
                });

                this._reply({ command: 'operationComplete', success: true, message: 'Search completed! Results opened in editor.' });
                return;
            }

            // ─── Browse File (single) ────────────────────────────────────
            case 'browseFile': {
                const fileType = message.fileType as string;
                const filters: Record<string, string[]> =
                    fileType === 'patterns'
                        ? { 'JSON files': ['json'], 'All files': ['*'] }
                        : fileType === 'jsonl'
                            ? { 'JSONL files': ['jsonl'], 'All files': ['*'] }
                            : { 'Log files': ['log', 'txt'], 'All files': ['*'] };

                const uris = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: 'Select', filters });
                if (uris && uris[0]) {
                    this._reply({ command: 'setFilePath', fileType, path: uris[0].fsPath });
                }
                return;
            }

            // ─── File Info actions ───────────────────────────────────────
            case 'openFile': {
                if (message.fileUri) {
                    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(message.fileUri));
                }
                return;
            }

            case 'revealInExplorer': {
                if (message.fileUri) {
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.parse(message.fileUri));
                }
                return;
            }

            case 'refreshFileInfo': {
                await this._sendActiveFileUpdate();
                return;
            }

            // ─── Compare Chunk Stats ─────────────────────────────────────
            case 'compareChunkStats': {
                const filePaths = message.filePaths as string[];
                if (!filePaths || filePaths.length < 2) {
                    this._reply({ command: 'operationComplete', success: false, message: 'Please select at least 2 files to compare.' });
                    return;
                }

                const { LogChunkStatsComparisonProvider } = require('./logChunkStatsComparisonProvider');
                const provider = new LogChunkStatsComparisonProvider(this.context.extensionPath);
                await provider.generateComparison(filePaths);
                this._reply({ command: 'operationComplete', success: true, message: 'Comparison report generated.' });
                return;
            }

            case 'browseFiles': {
                const uris = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    openLabel: 'Add Files',
                    filters: { 'Log files': ['log', 'txt'], 'All files': ['*'] }
                });
                if (uris && uris.length > 0) {
                    this._reply({
                        command: 'setTreeFiles',
                        files: uris.map(u => ({ name: path.basename(u.fsPath), path: u.fsPath }))
                    });
                }
                return;
            }

            case 'addTreeFiles': {
                // Gather files from LogContext / tree provider
                const logCtx = LogContext.getInstance();
                const activeFile = logCtx.activeFilePath;
                if (activeFile) {
                    this._reply({
                        command: 'setTreeFiles',
                        files: [{ name: path.basename(activeFile), path: activeFile }]
                    });
                } else {
                    vscode.window.showInformationMessage('No files in the Log Files tree. Add files via the tree view first.');
                }
                return;
            }

            // ─── JSONL Conversion ────────────────────────────────────────
            case 'convertToJsonl': {
                const editor = await LogContext.getInstance().resolveEditor();
                if (!editor) {
                    this._reply({ command: 'operationComplete', success: false, message: 'No log file available. Open a log file in the editor or select one in the Log Files tree.' });
                    return;
                }

                if (!fs.existsSync(editor.document.uri.fsPath)) {
                    this._reply({
                        command: 'operationComplete',
                        success: false,
                        message: `File not found on disk: ${path.basename(editor.document.uri.fsPath)}`
                    });
                    return;
                }

                const { convertToJsonl } = require('../utils/log-to-jsonl-command');
                await convertToJsonl(editor.document);
                this._reply({ command: 'operationComplete', success: true, message: 'Conversion to JSONL completed.' });
                return;
            }

            case 'convertJsonlToLog': {
                const filePath = message.filePath as string;
                if (!filePath) {
                    this._reply({ command: 'operationComplete', success: false, message: 'Please enter a JSONL file path.' });
                    return;
                }
                if (!fs.existsSync(filePath)) {
                    this._reply({ command: 'operationComplete', success: false, message: `File not found: ${filePath}` });
                    return;
                }

                const { convertJsonlToLog } = require('../utils/jsonl-to-log');
                await convertJsonlToLog(filePath);
                this._reply({ command: 'operationComplete', success: true, message: 'Conversion to log completed.' });
                return;
            }

            // ─── Dashboard quick actions ─────────────────────────────────
            case 'quickGapReport': {
                await vscode.commands.executeCommand('acacia-log.logExplorer.generateGapReport');
                return;
            }

            case 'quickChunkStats': {
                await vscode.commands.executeCommand('acacia-log.logExplorer.generateChunkStatsReport');
                return;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LogContext listener
    // ═══════════════════════════════════════════════════════════════════

    private _setupLogContextListener(): void {
        const disposable = LogContext.getInstance().onDidChangeActiveFile(() => {
            this._sendActiveFileUpdateDebounced();
        });
        this._disposables.push(disposable);
    }

    private _sendActiveFileUpdateDebounced(): void {
        if (this._updateTimer) { clearTimeout(this._updateTimer); }
        this._updateTimer = setTimeout(() => this._sendActiveFileUpdate(), 150);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Initial / active-file data
    // ═══════════════════════════════════════════════════════════════════

    private _sendInitialValues(): void {
        const config = vscode.workspace.getConfiguration('acacia-log');
        this._reply({
            command: 'setValues',
            logTimeRegex: config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}',
            logTimeFormat: config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss',
            searchDate: config.get<string>('logSearchDate') || '',
            searchTime: config.get<string>('logSearchTime') || '',
            logFilePath: config.get<string>('logFilePath') || '',
            searchPatternsFilePath: config.get<string>('patternsFilePath') || ''
        });

        // Also push active-file status
        this._sendActiveFileUpdate();
    }

    private async _sendActiveFileUpdate(): Promise<void> {
        const filePath = LogContext.getInstance().activeFilePath;
        if (!filePath || !fs.existsSync(filePath)) {
            this._reply({ command: 'clearActiveFile' });
            return;
        }

        try {
            const stats = await fs.promises.stat(filePath);
            const fileName = path.basename(filePath);

            // Open the document to get line count & try timestamp detection
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const lineCount = doc.lineCount;

            let timestampDetected = false;
            let timestampFormat = '';

            try {
                const { getOrDetectFormat } = require('../utils/format-cache');
                const detection = await getOrDetectFormat(doc);
                if (detection.detected && detection.format) {
                    timestampDetected = true;
                    timestampFormat = detection.format.pattern;
                }
            } catch { /* ignore detection failures */ }

            const largeFile = stats.size > LogManagerPanelProvider.LARGE_FILE_THRESHOLD;
            this._reply({
                command: 'updateActiveFile',
                fileName,
                filePath,
                fileSize: this._formatSize(stats.size),
                fileSizeBytes: stats.size,
                lineCount,
                timestampDetected,
                timestampFormat,
                largeFile
            });
        } catch (err) {
            console.error('[LogManagerPanel] Error reading active file:', err);
            this._reply({ command: 'clearActiveFile' });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Pattern search helpers (migrated from UnifiedLogViewProvider)
    // ═══════════════════════════════════════════════════════════════════

    private async _searchLogFile(
        logFilePath: string,
        searchPatterns: { key: string; regexp: string; regexpoptions: string }[]
    ): Promise<{ [pattern: string]: { count: number; positions: number[]; lines: number[]; matches: string[] } }> {

        const results: { [pattern: string]: { count: number; positions: number[]; lines: number[]; matches: string[] } } = {};

        const searchPromises = searchPatterns.map(p => this._searchPatternInLogFile(logFilePath, p));
        const searchResults = await Promise.all(searchPromises);

        searchResults.forEach((result, index) => {
            results[searchPatterns[index].key] = result;
        });

        return results;
    }

    private async _searchPatternInLogFile(
        logFilePath: string,
        pattern: { key: string; regexp: string; regexpoptions: string }
    ): Promise<{ count: number; positions: number[]; lines: number[]; matches: string[] }> {

        const result = { count: 0, positions: [] as number[], lines: [] as number[], matches: [] as string[] };
        const regex = new RegExp(pattern.regexp, pattern.regexpoptions);

        const fileStream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
        let buffer = '';
        let position = 0;
        let lineNumber = 1;

        for await (const chunk of fileStream) {
            buffer += chunk;
            let lastIndex = -1;

            let lineStart = 0;
            let lineEnd = buffer.indexOf('\n');
            while (lineEnd !== -1) {
                const line = buffer.substring(lineStart, lineEnd + 1);
                let match;
                while ((match = regex.exec(line)) !== null) {
                    const matchPosition = position + match.index;
                    if (matchPosition >= 0 && Number.isSafeInteger(matchPosition)) {
                        result.count++;
                        result.positions.push(matchPosition);
                        result.lines.push(lineNumber);
                        result.matches.push(line.trim());
                    }
                    if (regex.lastIndex === lastIndex) { break; }
                    lastIndex = regex.lastIndex;
                }
                position += line.length;
                lineNumber++;
                lineStart = lineEnd + 1;
                lineEnd = buffer.indexOf('\n', lineStart);
            }
            buffer = buffer.substring(lineStart);
        }

        // Remaining tail (no trailing newline)
        if (buffer.length > 0) {
            let match;
            while ((match = regex.exec(buffer)) !== null) {
                const matchPosition = position + match.index;
                if (matchPosition >= 0 && Number.isSafeInteger(matchPosition)) {
                    result.count++;
                    result.positions.push(matchPosition);
                    result.lines.push(lineNumber);
                    result.matches.push(buffer.trim());
                }
            }
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════════════════════════════

    private _reply(message: object): void {
        this._panel?.webview.postMessage(message);
    }

    private _getHtml(): string {
        const htmlPath = path.join(this.context.extensionPath, 'resources', 'logManagerPanel.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        const codiconsUri = this._panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );
        html = html.replace(/\{\{CODICONS_URI\}\}/g, codiconsUri.toString());
        html = html.replace(/\{\{CSP_SOURCE\}\}/g, this._panel!.webview.cspSource);

        return html;
    }

    private _formatSize(bytes: number): string {
        if (bytes < 1024) { return `${bytes} B`; }
        if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(2)} KB`; }
        if (bytes < 1024 * 1024 * 1024) { return `${(bytes / (1024 * 1024)).toFixed(2)} MB`; }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}
