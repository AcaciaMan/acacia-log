import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { DescriptiveStats } from '../utils/log-chunk-stats';

// ── Per-file result ────────────────────────────────────────────────────

interface FileStats {
    filePath: string;
    fileName: string;
    stats: DescriptiveStats;
    outlierCount: number;
    /** Coefficient of variation (stdDev / mean × 100), or 0 when mean is 0 */
    cv: number;
    /** Skips analysis because timestamps could not be detected */
    error?: string;
}

// ── Serialised shape sent to the HTML page ────────────────────────────

interface SerializedFileStats {
    fileName: string;
    filePath: string;
    stats: {
        count: number;
        mean: string; meanMs: number;
        median: string; medianMs: number;
        min: string; minMs: number;
        max: string; maxMs: number;
        p90: string; p90Ms: number;
        p95: string; p95Ms: number;
        p99: string; p99Ms: number;
        stdDev: string; stdDevMs: number;
        skewness: string;
        kurtosis: string;
        cv: string;
        outlierCount: number;
        outlierPct: string;
    };
    error?: string;
}

// ── Provider ───────────────────────────────────────────────────────────

export class LogChunkStatsComparisonProvider {
    private currentHtmlContent: string = '';

    constructor(private readonly extensionPath: string) {}

    // ── Public entry point ─────────────────────────────────────────────

    async generateComparison(filePaths: string[]): Promise<void> {
        if (filePaths.length < 2) {
            vscode.window.showWarningMessage(
                'Please select at least 2 log files in the Log Files tree view (hold Ctrl/Cmd to multi-select).'
            );
            return;
        }
        if (filePaths.length > 20) {
            vscode.window.showWarningMessage('Comparison is limited to 20 files at a time.');
            filePaths = filePaths.slice(0, 20);
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Comparing chunk statistics across ${filePaths.length} files…`,
                cancellable: false
            }, async (progress) => {

                const step = Math.floor(90 / filePaths.length);
                const results: FileStats[] = [];

                for (let i = 0; i < filePaths.length; i++) {
                    const fp = filePaths[i];
                    progress.report({
                        increment: step,
                        message: `Analysing ${path.basename(fp)} (${i + 1}/${filePaths.length})…`
                    });
                    results.push(await this.analyseFile(fp));
                }

                progress.report({ increment: 10, message: 'Building comparison report…' });

                const htmlContent = this.buildHtmlReport(results);
                this.currentHtmlContent = htmlContent;

                await this.openReportPanel(filePaths, htmlContent);
            });

            vscode.window.showInformationMessage('Chunk statistics comparison report generated!');

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to generate comparison report: ${msg}`);
            console.error('[LogChunkStatsComparisonProvider] Error:', error);
        }
    }

    // ── Per-file analysis ──────────────────────────────────────────────

    private async analyseFile(filePath: string): Promise<FileStats> {
        const fileName = path.basename(filePath);
        try {
            const { LogFileHandler, getFileDates, buildLineIndex } = require('../utils/log-file-reader');
            const { extractAllGapsFromIndex, computeDescriptiveStats, detectOutliers } = require('../utils/log-chunk-stats');

            const handler = new LogFileHandler(filePath);
            await handler.initialize();

            if (!handler.index || !handler.format) {
                return { filePath, fileName, stats: emptyStats(), outlierCount: 0, cv: 0, error: 'Timestamp format not detected' };
            }

            if (handler.index.totalLines < 10_000) {
                const fileDates = getFileDates(filePath);
                const newIndex = await buildLineIndex(filePath, handler.format, fileDates, 10);
                (handler as unknown as { lineIndex: typeof newIndex }).lineIndex = newIndex;
            }

            const allGaps = extractAllGapsFromIndex(handler.index);

            if (allGaps.length < 2) {
                return { filePath, fileName, stats: emptyStats(), outlierCount: 0, cv: 0, error: 'Not enough timestamped chunks' };
            }

            const durations = allGaps.map((g: any) => g.durationMs);
            const stats = computeDescriptiveStats(durations);
            const outlierCount = detectOutliers(allGaps).length;
            const cv = stats.mean > 0 ? (stats.stdDev / stats.mean) * 100 : 0;

            return { filePath, fileName, stats, outlierCount, cv };

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { filePath, fileName, stats: emptyStats(), outlierCount: 0, cv: 0, error: msg };
        }
    }

    // ── HTML generation ────────────────────────────────────────────────

    private buildHtmlReport(results: FileStats[]): string {
        const templatePath = path.join(this.extensionPath, 'resources', 'logChunkStatsComparison.html');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        const valid = results.filter(r => !r.error);
        const serialized: SerializedFileStats[] = results.map(r => this.serialize(r));
        const description = generateDescription(valid);
        const rankings = generateRankings(valid);

        const reportData = {
            generatedAt: new Date().toISOString(),
            fileCount: results.length,
            validCount: valid.length,
            files: serialized,
            description,
            rankings
        };

        const dataScript = `<script>\nwindow.COMPARISON_DATA = ${JSON.stringify(reportData)};\n</script>`;
        html = html.replace('</head>', `${dataScript}\n</head>`);
        return html;
    }

    private serialize(r: FileStats): SerializedFileStats {
        const { formatDuration } = require('../utils/log-gap-finder');
        const s = r.stats;
        const outlierPct = s.count > 0 ? ((r.outlierCount / s.count) * 100).toFixed(1) : '0.0';
        return {
            fileName: r.fileName,
            filePath: r.filePath,
            error: r.error,
            stats: {
                count: s.count,
                mean: formatDuration(Math.round(s.mean)),         meanMs: s.mean,
                median: formatDuration(Math.round(s.median)),     medianMs: s.median,
                min: formatDuration(s.min),                       minMs: s.min,
                max: formatDuration(s.max),                       maxMs: s.max,
                p90: formatDuration(Math.round(s.p90)),           p90Ms: s.p90,
                p95: formatDuration(Math.round(s.p95)),           p95Ms: s.p95,
                p99: formatDuration(Math.round(s.p99)),           p99Ms: s.p99,
                stdDev: formatDuration(Math.round(s.stdDev)),     stdDevMs: s.stdDev,
                skewness: s.skewness.toFixed(3),
                kurtosis: s.kurtosis.toFixed(3),
                cv: r.cv.toFixed(1),
                outlierCount: r.outlierCount,
                outlierPct
            }
        };
    }

    // ── Webview panel ──────────────────────────────────────────────────

    private async openReportPanel(filePaths: string[], htmlContent: string): Promise<void> {
        const title = filePaths.length <= 3
            ? filePaths.map(fp => path.basename(fp)).join(' vs ')
            : `Comparison (${filePaths.length} files)`;

        const panel = vscode.window.createWebviewPanel(
            'logChunkStatsComparison',
            `Chunk Comparison — ${title}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        panel.webview.html = htmlContent;
        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'exportHtml') {
                await this.exportReport();
            } else if (message.command === 'openFile') {
                try {
                    const uri = vscode.Uri.file(message.filePath);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.One,
                        preview: false
                    });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`Cannot open file: ${msg}`);
                }
            }
        });
    }

    private async exportReport(): Promise<void> {
        try {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('chunk_stats_comparison.html'),
                filters: { 'HTML Files': ['html'], 'All Files': ['*'] }
            });
            if (!uri) { return; }
            await fs.promises.writeFile(uri.fsPath, this.currentHtmlContent, 'utf8');
            vscode.window.showInformationMessage(`Comparison exported to ${path.basename(uri.fsPath)}`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Export failed: ${msg}`);
        }
    }
}

// ── Pure helpers (no VS Code dependencies) ────────────────────────────

function emptyStats(): DescriptiveStats {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, p99: 0, stdDev: 0, skewness: 0, kurtosis: 0 };
}

// ── Rankings ───────────────────────────────────────────────────────────

interface Rankings {
    byMean:    { fileName: string; value: number; label: string }[];
    byMedian:  { fileName: string; value: number; label: string }[];
    byP99:     { fileName: string; value: number; label: string }[];
    byStdDev:  { fileName: string; value: number; label: string }[];
    byCv:      { fileName: string; value: number; label: string }[];
    byOutlierPct: { fileName: string; value: number; label: string }[];
}

function generateRankings(valid: FileStats[]): Rankings {
    const { formatDuration } = require('../utils/log-gap-finder');
    const rank = (
        arr: FileStats[],
        key: (r: FileStats) => number,
        fmt: (v: number) => string
    ) =>
        [...arr]
            .sort((a, b) => key(a) - key(b))
            .map(r => ({ fileName: r.fileName, value: key(r), label: fmt(key(r)) }));

    return {
        byMean:   rank(valid, r => r.stats.mean,   v => formatDuration(Math.round(v))),
        byMedian: rank(valid, r => r.stats.median, v => formatDuration(Math.round(v))),
        byP99:    rank(valid, r => r.stats.p99,    v => formatDuration(Math.round(v))),
        byStdDev: rank(valid, r => r.stats.stdDev, v => formatDuration(Math.round(v))),
        byCv:     rank(valid, r => r.cv,           v => v.toFixed(1) + '%'),
        byOutlierPct: rank(valid, r => r.stats.count > 0 ? (r.outlierCount / r.stats.count) * 100 : 0,
                           v => v.toFixed(1) + '%')
    };
}

// ── Natural language description ───────────────────────────────────────

function generateDescription(valid: FileStats[]): string[] {
    if (valid.length === 0) { return ['No valid files could be analysed.']; }

    const { formatDuration } = require('../utils/log-gap-finder');
    const paragraphs: string[] = [];
    const n = valid.length;
    const names = valid.map(r => `"${r.fileName}"`);

    // ── 1. Overview ────────────────────────────────────────────────────
    paragraphs.push(
        `This report compares chunk duration statistics across ${n} log file${n > 1 ? 's' : ''}: ` +
        `${listJoin(names)}. ` +
        `A "chunk" is the elapsed time between two consecutive timestamped entries in the file's ` +
        `sparse line index. The statistics below reveal how quickly and consistently each file ` +
        `processes log records over its observed time span.`
    );

    // ── 2. Throughput comparison (mean / median) ───────────────────────
    const byMean = [...valid].sort((a, b) => a.stats.mean - b.stats.mean);
    const fastest = byMean[0];
    const slowest = byMean[n - 1];

    if (n >= 2) {
        const ratio = slowest.stats.mean > 0 ? (slowest.stats.mean / fastest.stats.mean).toFixed(1) : '∞';
        paragraphs.push(
            `📊 Throughput (mean chunk duration): "${fastest.fileName}" has the shortest average ` +
            `chunk duration (${formatDuration(Math.round(fastest.stats.mean))}), making it the fastest ` +
            `in terms of average throughput. "${slowest.fileName}" has the longest average duration ` +
            `(${formatDuration(Math.round(slowest.stats.mean))}), which is ${ratio}× slower on average. ` +
            medianComment(valid)
        );
    }

    // ── 3. Tail latency (P99) ──────────────────────────────────────────
    const byP99 = [...valid].sort((a, b) => a.stats.p99 - b.stats.p99);
    const bestTail   = byP99[0];
    const worstTail  = byP99[n - 1];

    if (n >= 2) {
        paragraphs.push(
            `⏱ Tail latency (P99): For 99 % of chunks, "${bestTail.fileName}" completes ` +
            `within ${formatDuration(Math.round(bestTail.stats.p99))}, which is the best tail-latency ` +
            `among the compared files. At the other end, "${worstTail.fileName}" requires up to ` +
            `${formatDuration(Math.round(worstTail.stats.p99))} — indicating that occasional processing ` +
            `slowdowns are significantly more pronounced in that file.`
        );
    }

    // ── 4. Consistency (CV) ────────────────────────────────────────────
    const byCv = [...valid].sort((a, b) => a.cv - b.cv);
    const mostConsistent   = byCv[0];
    const leastConsistent  = byCv[n - 1];

    if (n >= 2) {
        const cvDesc = (cv: number): string => {
            if (cv < 30)  { return 'highly consistent'; }
            if (cv < 60)  { return 'moderately consistent'; }
            if (cv < 100) { return 'variable'; }
            return 'highly variable';
        };
        paragraphs.push(
            `📉 Processing consistency (coefficient of variation): ` +
            `"${mostConsistent.fileName}" is the most consistent with a CV of ${mostConsistent.cv.toFixed(1)} % ` +
            `(${cvDesc(mostConsistent.cv)}). ` +
            (n > 1
                ? `"${leastConsistent.fileName}" shows the most variation at CV ${leastConsistent.cv.toFixed(1)} % ` +
                  `(${cvDesc(leastConsistent.cv)}), suggesting its processing rate fluctuates considerably.`
                : '')
        );
    }

    // ── 5. Distribution shape (skewness) ──────────────────────────────
    const shapeNotes: string[] = [];
    for (const r of valid) {
        const sk = r.stats.skewness;
        if (Math.abs(sk) < 0.5) {
            shapeNotes.push(`"${r.fileName}" shows a near-symmetric distribution (skewness ${sk.toFixed(2)})`);
        } else if (sk > 1) {
            shapeNotes.push(`"${r.fileName}" is heavily right-skewed (skewness ${sk.toFixed(2)}), meaning most chunks are fast but rare very long delays pull the mean up`);
        } else if (sk > 0.5) {
            shapeNotes.push(`"${r.fileName}" is moderately right-skewed (skewness ${sk.toFixed(2)})`);
        } else if (sk < -1) {
            shapeNotes.push(`"${r.fileName}" is heavily left-skewed (skewness ${sk.toFixed(2)}), suggesting bursts of unusually fast processing`);
        } else {
            shapeNotes.push(`"${r.fileName}" is moderately left-skewed (skewness ${sk.toFixed(2)})`);
        }
    }
    paragraphs.push(`📐 Distribution shape: ${shapeNotes.join('; ')}.`);

    // ── 6. Outlier density ─────────────────────────────────────────────
    const outlierNotes: string[] = [];
    for (const r of valid) {
        const pct = r.stats.count > 0 ? (r.outlierCount / r.stats.count) * 100 : 0;
        if (r.outlierCount === 0) {
            outlierNotes.push(`"${r.fileName}" has no statistical outliers`);
        } else {
            outlierNotes.push(`"${r.fileName}" has ${r.outlierCount} outlier chunk${r.outlierCount > 1 ? 's' : ''} (${pct.toFixed(1)} %)`);
        }
    }
    paragraphs.push(`⚠️ Outliers (IQR method): ${outlierNotes.join('; ')}.`);

    // ── 7. Max single chunk (worst-case bottleneck) ────────────────────
    const byMax = [...valid].sort((a, b) => a.stats.max - b.stats.max);
    const worstMax = byMax[n - 1];
    paragraphs.push(
        `🔴 Worst-case single chunk: The longest individual chunk across all files is in ` +
        `"${worstMax.fileName}" at ${formatDuration(worstMax.stats.max)}. ` +
        (worstMax.stats.max > 60_000
            ? 'This exceeds one minute and likely represents a significant processing bottleneck or idle period.'
            : worstMax.stats.max > 5_000
            ? 'This is above 5 seconds and may warrant investigation.'
            : 'This is within a reasonable range.')
    );

    // ── 8. Summary verdict ─────────────────────────────────────────────
    if (n >= 2) {
        const overallBest = fastest; // lowest mean is "best overall"
        paragraphs.push(
            `✅ Overall assessment: Based on the combined metrics (mean duration, P99 tail latency, ` +
            `and consistency), "${overallBest.fileName}" scores best overall. ` +
            `Consider reviewing the files with high variance or elevated outlier rates as they may ` +
            `indicate intermittent slowdowns, resource contention, or unusual bursts of activity.`
        );
    }

    return paragraphs;
}

// ── String utilities ───────────────────────────────────────────────────

function listJoin(items: string[]): string {
    if (items.length === 0) { return ''; }
    if (items.length === 1) { return items[0]; }
    if (items.length === 2) { return `${items[0]} and ${items[1]}`; }
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function medianComment(valid: FileStats[]): string {
    const { formatDuration } = require('../utils/log-gap-finder');
    const byMed = [...valid].sort((a, b) => a.stats.median - b.stats.median);
    const lo = byMed[0];
    const hi = byMed[byMed.length - 1];
    if (Math.abs(lo.stats.median - hi.stats.median) < 100) {
        return 'Median durations are very similar across all files.';
    }
    return (
        `By median, "${lo.fileName}" (${formatDuration(Math.round(lo.stats.median))}) ` +
        `is faster than "${hi.fileName}" (${formatDuration(Math.round(hi.stats.median))}).`
    );
}
