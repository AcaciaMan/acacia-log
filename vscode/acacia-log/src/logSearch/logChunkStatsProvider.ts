import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Maximum number of outlier records refined with actual line text */
const MAX_REFINED_OUTLIERS = 25;

/**
 * Provider for generating HTML chunk-duration statistics reports.
 *
 * For every consecutive pair of time-stamped entries in the sparse line index
 * it computes the inter-entry gap (a "chunk" duration), then derives full
 * descriptive statistics, identifies the min/max chunks, and flags outliers
 * using Tukey's IQR fence.
 */
export class LogChunkStatsProvider {
    private currentHtmlContent: string = '';
    private currentFileName: string = '';

    constructor(private readonly extensionPath: string) {}

    // ── Public entry-point ─────────────────────────────────────────────

    async generateReport(filePath: string): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing chunk duration statistics…',
                cancellable: false
            }, async (progress) => {

                const { LogFileHandler, getFileDates, buildLineIndex } = require('../utils/log-file-reader');
                const { refineLargestGap } = require('../utils/log-gap-finder');
                const { extractAllGapsFromIndex, computeDescriptiveStats, detectOutliers } = require('../utils/log-chunk-stats');

                progress.report({ increment: 0, message: 'Initializing log file handler…' });

                const handler = new LogFileHandler(filePath);
                const detection = await handler.initialize();

                if (!handler.index || !handler.format) {
                    throw new Error('Failed to initialize log file handler or detect timestamp format');
                }

                // Rebuild with tighter step for small files (same heuristic as gap report)
                if (handler.index.totalLines < 10_000) {
                    console.log('[LogChunkStatsProvider] Small file — rebuilding index with step 10');
                    const fileDates = getFileDates(filePath);
                    const newIndex = await buildLineIndex(filePath, handler.format, fileDates, 10);
                    (handler as unknown as { lineIndex: typeof newIndex }).lineIndex = newIndex;
                }

                progress.report({ increment: 20, message: 'Extracting chunk durations from index…' });

                const allGaps = extractAllGapsFromIndex(handler.index);

                if (allGaps.length < 2) {
                    const tsCount = handler.index.offsets.filter((e: any) => e.timestamp !== null).length;
                    vscode.window.showInformationMessage(
                        tsCount < 2
                            ? `Only ${tsCount} timestamped entry/entries found. The file may be too small or timestamps were not detected.`
                            : 'Not enough positive-duration chunks to compute statistics.'
                    );
                    return;
                }

                progress.report({ increment: 40, message: 'Computing descriptive statistics…' });

                const durations = allGaps.map((g: any) => g.durationMs);
                const stats = computeDescriptiveStats(durations);
                const rawOutliers = detectOutliers(allGaps);

                // Find the min/max gap records (already in allGaps)
                let minGap = allGaps[0];
                let maxGap = allGaps[0];
                for (const g of allGaps) {
                    if (g.durationMs < minGap.durationMs) { minGap = g; }
                    if (g.durationMs > maxGap.durationMs) { maxGap = g; }
                }

                progress.report({ increment: 60, message: 'Refining min/max and outlier records…' });

                const fileDates = getFileDates(filePath);

                // Refine min, max, and top-N outliers to get actual line text
                const [refinedMin, refinedMax] = await Promise.all([
                    refineLargestGap(filePath, minGap, handler.index, handler.format, fileDates),
                    refineLargestGap(filePath, maxGap, handler.index, handler.format, fileDates)
                ]);

                const topOutliers = rawOutliers.slice(0, MAX_REFINED_OUTLIERS);
                const refinedOutliers = await Promise.all(
                    topOutliers.map((o: any) => refineLargestGap(filePath, o, handler.index!, handler.format!, fileDates))
                );
                refinedOutliers.sort((a, b) => b.durationMs - a.durationMs);

                progress.report({ increment: 80, message: 'Generating HTML report…' });

                const htmlContent = this.buildHtmlReport(filePath, stats, refinedMin, refinedMax, refinedOutliers, rawOutliers.length);

                this.currentHtmlContent = htmlContent;
                this.currentFileName = path.basename(filePath);

                await this.openReportPanel(filePath, htmlContent);

                progress.report({ increment: 100, message: 'Done!' });
            });

            vscode.window.showInformationMessage('Chunk statistics report generated successfully!');

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to generate chunk stats report: ${msg}`);
            console.error('[LogChunkStatsProvider] Error:', error);
        }
    }

    // ── HTML generation ────────────────────────────────────────────────

    private buildHtmlReport(
        filePath: string,
        stats: any,
        minChunk: any,
        maxChunk: any,
        outliers: any[],
        totalOutlierCount: number
    ): string {
        const { formatDuration } = require('../utils/log-gap-finder');
        const templatePath = path.join(this.extensionPath, 'resources', 'logChunkStats.html');

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        const reportData = {
            filePath: filePath,
            fileName: path.basename(filePath),
            stats: {
                count: stats.count,
                mean: formatDuration(Math.round(stats.mean)),
                median: formatDuration(Math.round(stats.median)),
                min: formatDuration(stats.min),
                max: formatDuration(stats.max),
                p90: formatDuration(Math.round(stats.p90)),
                p95: formatDuration(Math.round(stats.p95)),
                p99: formatDuration(Math.round(stats.p99)),
                stdDev: formatDuration(Math.round(stats.stdDev)),
                skewness: stats.skewness.toFixed(4),
                kurtosis: stats.kurtosis.toFixed(4),
                // raw ms values for charting
                meanMs: stats.mean,
                medianMs: stats.median,
                stdDevMs: stats.stdDev
            },
            minChunk: this.serializeGap(minChunk),
            maxChunk: this.serializeGap(maxChunk),
            outliers: outliers.map(o => this.serializeGap(o)),
            totalOutlierCount,
            refinedOutlierCount: outliers.length
        };

        const dataScript = `<script>\nwindow.REPORT_DATA = ${JSON.stringify(reportData)};\n</script>`;
        html = html.replace('</head>', `${dataScript}\n</head>`);
        return html;
    }

    private serializeGap(gap: any) {
        const { formatDuration } = require('../utils/log-gap-finder');
        return {
            line: gap.line + 1,
            timestamp: gap.timestamp.toISOString(),
            nextTimestamp: gap.nextTimestamp.toISOString(),
            duration: formatDuration(gap.durationMs),
            durationMs: gap.durationMs,
            text: gap.text
        };
    }

    // ── Webview panel ──────────────────────────────────────────────────

    private async openReportPanel(filePath: string, htmlContent: string): Promise<void> {
        const fileName = path.basename(filePath);
        const panel = vscode.window.createWebviewPanel(
            'logChunkStats',
            `Chunk Stats — ${fileName}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = htmlContent;

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'exportHtml') {
                await this.exportReport();
            } else if (message.command === 'navigateToLine') {
                const { navigateToLine } = require('../utils/navigateToLine');
                await navigateToLine(message.filePath, message.line);
            }
        });
    }

    private async exportReport(): Promise<void> {
        try {
            const defaultName = this.currentFileName.replace(/\.[^/.]+$/, '') + '_chunk_stats.html';
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultName),
                filters: { 'HTML Files': ['html'], 'All Files': ['*'] }
            });
            if (!uri) { return; }
            await fs.promises.writeFile(uri.fsPath, this.currentHtmlContent, 'utf8');
            vscode.window.showInformationMessage(`Report exported to ${path.basename(uri.fsPath)}`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to export report: ${msg}`);
        }
    }
}
