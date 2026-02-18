import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogFileHandler, getFileDates, buildLineIndex } from '../utils/log-file-reader';
import { findTopGapsFromIndex, findSlowestRecords, formatDuration } from '../utils/log-gap-finder';

/**
 * Provider for generating HTML gap analysis reports
 */
export class LogGapReportProvider {
    private currentHtmlContent: string = '';
    private currentFileName: string = '';
    
    constructor(private readonly extensionPath: string) {}

    /**
     * Generate and display HTML gap report for a log file
     */
    async generateReport(filePath: string): Promise<void> {
        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing log gaps...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Initializing log file handler..." });

                // Initialize the log file handler
                const handler = new LogFileHandler(filePath);
                const detection = await handler.initialize();

                if (!handler.index || !handler.format) {
                    throw new Error("Failed to initialize log file handler or detect timestamp format");
                }

                // For small files, rebuild the index with a smaller step to capture more entries
                if (handler.index.totalLines < 10000) {
                    console.log('[LogGapReportProvider] Small file detected, rebuilding index with step size 10');
                    const fileDates = getFileDates(filePath);
                    const newIndex = await buildLineIndex(filePath, handler.format, fileDates, 10);
                    // Replace the index
                    (handler as any).lineIndex = newIndex;
                }

                progress.report({ increment: 30, message: "Finding approximate gaps..." });

                // Log debug information
                const timestampedEntries = handler.index.offsets.filter(e => e.timestamp !== null);
                console.log(`[LogGapReportProvider] Total lines: ${handler.index.totalLines}`);
                console.log(`[LogGapReportProvider] Index entries: ${handler.index.offsets.length}`);
                console.log(`[LogGapReportProvider] Entries with timestamps: ${timestampedEntries.length}`);

                // Quick approximate results (no disk I/O)
                const approx = findTopGapsFromIndex(handler.index, 10);

                if (approx.gaps.length === 0) {
                    const message = timestampedEntries.length < 2 
                        ? `Log file has only ${timestampedEntries.length} timestamped entries in the index. File may be too small or timestamps not detected properly. (Total lines: ${handler.index.totalLines})`
                        : "No significant time gaps found in the log file.";
                    vscode.window.showInformationMessage(message);
                    return;
                }

                progress.report({ increment: 40, message: "Refining gap analysis..." });

                // Full precision (reads ~10 small chunks from disk)
                const fileDates = getFileDates(filePath);
                const precise = await findSlowestRecords(
                    filePath,
                    handler.index,
                    handler.format,
                    fileDates,
                    10
                );

                progress.report({ increment: 80, message: "Generating HTML report..." });

                // Generate HTML content
                const htmlContent = this.generateHtmlContent(filePath, precise);

                // Store for export
                this.currentHtmlContent = htmlContent;
                this.currentFileName = path.basename(filePath);

                // Open in editor
                await this.openHtmlReport(filePath, htmlContent);

                progress.report({ increment: 100, message: "Done!" });
            });

            vscode.window.showInformationMessage("Gap analysis report generated successfully!");

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            vscode.window.showErrorMessage(`Failed to generate gap report: ${errorMessage}`);
            console.error('[LogGapReportProvider] Error:', error);
        }
    }

    /**
     * Generate HTML content for the gap report
     */
    private generateHtmlContent(filePath: string, result: any): string {
        const templatePath = path.join(this.extensionPath, 'resources', 'logGapReport.html');
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Prepare data for the report
        const reportData = {
            fileName: path.basename(filePath),
            totalRecords: result.totalRecords,
            logSpan: formatDuration(result.logSpanMs),
            gaps: result.gaps.map((gap: any) => ({
                line: gap.line + 1, // Convert to 1-based line number
                timestamp: gap.timestamp.toISOString(),
                nextTimestamp: gap.nextTimestamp.toISOString(),
                duration: formatDuration(gap.durationMs),
                text: gap.text
            }))
        };

        // Inject data into HTML
        const dataScript = `
        <script>
            window.REPORT_DATA = ${JSON.stringify(reportData)};
        </script>`;

        // Insert the data script before the closing </head> tag
        htmlContent = htmlContent.replace('</head>', `${dataScript}\n</head>`);

        return htmlContent;
    }

    /**
     * Open the HTML report in a webview panel
     */
    private async openHtmlReport(filePath: string, htmlContent: string): Promise<void> {
        const fileName = path.basename(filePath);
        
        // Create a webview panel
        const panel = vscode.window.createWebviewPanel(
            'logGapReport',
            `Gap Analysis - ${fileName}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set the HTML content
        panel.webview.html = htmlContent;

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'exportHtml':
                        await this.exportHtmlToFile();
                        break;
                }
            }
        );
    }

    /**
     * Export the current HTML report to a file
     */
    private async exportHtmlToFile(): Promise<void> {
        try {
            // Prompt user for save location
            const defaultFileName = this.currentFileName.replace(/\.[^/.]+$/, '') + '_gap_report.html';
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultFileName),
                filters: {
                    'HTML Files': ['html'],
                    'All Files': ['*']
                }
            });

            if (!uri) {
                return; // User cancelled
            }

            // Write the HTML content to the file
            await fs.promises.writeFile(uri.fsPath, this.currentHtmlContent, 'utf8');

            vscode.window.showInformationMessage(`Gap report exported to ${path.basename(uri.fsPath)}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to export report: ${errorMessage}`);
        }
    }
}
