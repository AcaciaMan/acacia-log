import * as vscode from 'vscode';
import { DateTime } from 'luxon';

interface TimelineEntry {
  timestamp: DateTime;
  line: string;
  lineNumber: number;
  level?: string;
}

interface AggregatedData {
  timestamp: string;
  count: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  lineNumbers: number[];
}

export async function drawLogTimeline(editor: vscode.TextEditor) {
  const document = editor.document;
  const text = document.getText();
  const lines = text.split('\n');
  const logDateRegex = new RegExp(vscode.workspace.getConfiguration('acacia-log').get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}');
  const logDateFormat = vscode.workspace.getConfiguration('acacia-log').get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';

  const entries: TimelineEntry[] = [];

  // Common log level patterns
  const levelPatterns = {
    error: /\b(ERROR|ERR|FATAL|CRITICAL)\b/i,
    warn: /\b(WARN|WARNING)\b/i,
    info: /\b(INFO|INFORMATION)\b/i,
    debug: /\b(DEBUG|TRACE|VERBOSE)\b/i
  };

  // Parse all log entries with timestamps
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(logDateRegex);
    if (match) {
      const dateTime = DateTime.fromFormat(match[0], logDateFormat);
      if (dateTime.isValid) {
        // Detect log level
        let level: string | undefined;
        if (levelPatterns.error.test(line)) {
          level = 'error';
        } else if (levelPatterns.warn.test(line)) {
          level = 'warn';
        } else if (levelPatterns.info.test(line)) {
          level = 'info';
        } else if (levelPatterns.debug.test(line)) {
          level = 'debug';
        }

        entries.push({
          timestamp: dateTime,
          line: line,
          lineNumber: i + 1,
          level: level
        });
      }
    }
  }

  if (entries.length === 0) {
    vscode.window.showWarningMessage('No valid timestamps found in the log file.');
    return;
  }

  // Determine optimal aggregation unit
  const firstTimestamp = entries[0].timestamp;
  const lastTimestamp = entries[entries.length - 1].timestamp;

  let aggregationUnit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' = 'second';
  let formatString = 'yyyy-MM-dd HH:mm:ss';

  const diffInYears = lastTimestamp.diff(firstTimestamp, 'years').years;
  const diffInMonths = lastTimestamp.diff(firstTimestamp, 'months').months;
  const diffInDays = lastTimestamp.diff(firstTimestamp, 'days').days;
  const diffInHours = lastTimestamp.diff(firstTimestamp, 'hours').hours;
  const diffInMinutes = lastTimestamp.diff(firstTimestamp, 'minutes').minutes;

  if (diffInYears > 1) {
    aggregationUnit = 'year';
    formatString = 'yyyy';
  } else if (diffInMonths > 2) {
    aggregationUnit = 'month';
    formatString = 'yyyy-MM';
  } else if (diffInDays > 2) {
    aggregationUnit = 'day';
    formatString = 'yyyy-MM-dd';
  } else if (diffInHours > 2) {
    aggregationUnit = 'hour';
    formatString = 'yyyy-MM-dd HH:00';
  } else if (diffInMinutes > 2) {
    aggregationUnit = 'minute';
    formatString = 'yyyy-MM-dd HH:mm';
  }

  console.log('Aggregating by', aggregationUnit);

  // Aggregate entries into time buckets
  const buckets = new Map<string, AggregatedData>();

  for (const entry of entries) {
    const bucketKey = entry.timestamp.startOf(aggregationUnit).toISO() as string;
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        timestamp: bucketKey,
        count: 0,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        debugCount: 0,
        lineNumbers: []
      });
    }

    const bucket = buckets.get(bucketKey)!;
    bucket.count++;
    bucket.lineNumbers.push(entry.lineNumber);

    if (entry.level === 'error') {
      bucket.errorCount++;
    } else if (entry.level === 'warn') {
      bucket.warnCount++;
    } else if (entry.level === 'info') {
      bucket.infoCount++;
    } else if (entry.level === 'debug') {
      bucket.debugCount++;
    }
  }

  // Convert to sorted array
  const aggregatedData = Array.from(buckets.values()).sort((a, b) => 
    a.timestamp.localeCompare(b.timestamp)
  );

  // Calculate statistics
  const totalEntries = entries.length;
  const timeSpan = lastTimestamp.diff(firstTimestamp).toFormat("hh'h' mm'm' ss's'");
  const avgEntriesPerBucket = totalEntries / aggregatedData.length;

  const stats = {
    totalEntries,
    totalBuckets: aggregatedData.length,
    avgEntriesPerBucket: Math.round(avgEntriesPerBucket * 100) / 100,
    firstTimestamp: firstTimestamp.toFormat(formatString),
    lastTimestamp: lastTimestamp.toFormat(formatString),
    timeSpan,
    aggregationUnit
  };

  const panel = vscode.window.createWebviewPanel(
    'logTimeline',
    'Log Timeline',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getWebviewContent(aggregatedData, stats, document.uri.fsPath);

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'navigateToLine':
          const lineNumber = message.lineNumber;
          const position = new vscode.Position(lineNumber - 1, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
          vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One });
          break;
      }
    },
    undefined,
    []
  );
}

function getWebviewContent(data: AggregatedData[], stats: any, logFilePath: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Log Timeline</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1"></script>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
          font-size: var(--vscode-font-size, 13px);
          color: var(--vscode-foreground, #cccccc);
          background-color: var(--vscode-editor-background, #1e1e1e);
          padding: 20px;
          line-height: 1.6;
        }

        .header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
        }

        h1 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .file-path {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, #858585);
          font-family: var(--vscode-editor-font-family, monospace);
          word-break: break-all;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          background-color: var(--vscode-sideBar-background, #252526);
          border: 1px solid var(--vscode-panel-border, #3c3c3c);
          border-radius: 4px;
          padding: 12px 16px;
        }

        .stat-label {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, #858585);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--vscode-textLink-foreground, #3794ff);
        }

        .controls {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          align-items: center;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-label {
          font-size: 12px;
          color: var(--vscode-foreground, #cccccc);
          font-weight: 500;
        }

        button {
          padding: 6px 12px;
          background-color: var(--vscode-button-background, #0e639c);
          color: var(--vscode-button-foreground, #ffffff);
          border: none;
          border-radius: 2px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: background-color 0.15s;
        }

        button:hover {
          background-color: var(--vscode-button-hoverBackground, #1177bb);
        }

        button.secondary {
          background-color: var(--vscode-button-secondaryBackground, #3a3d41);
          color: var(--vscode-button-secondaryForeground, #cccccc);
        }

        button.secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground, #45494e);
        }

        button.active {
          background-color: var(--vscode-button-background, #0e639c);
          color: var(--vscode-button-foreground, #ffffff);
        }

        .chart-container {
          background-color: var(--vscode-sideBar-background, #252526);
          border: 1px solid var(--vscode-panel-border, #3c3c3c);
          border-radius: 4px;
          padding: 20px;
          margin-bottom: 20px;
          position: relative;
        }

        .chart-wrapper {
          position: relative;
          height: 500px;
        }

        .legend-container {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 11px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-color {
          width: 14px;
          height: 14px;
          border-radius: 2px;
        }

        .help-text {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, #858585);
          padding: 12px;
          background-color: var(--vscode-textCodeBlock-background, #1e1e1e);
          border-radius: 4px;
          border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
          margin-top: 12px;
        }

        .help-text strong {
          color: var(--vscode-foreground, #cccccc);
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .controls {
            flex-direction: column;
            align-items: stretch;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>
          📊 Log Timeline Analysis
        </h1>
        <div class="file-path">${logFilePath.split('\\').join('\\\\')}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Log Entries</div>
          <div class="stat-value">${stats.totalEntries.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Time Buckets (${stats.aggregationUnit})</div>
          <div class="stat-value">${stats.totalBuckets.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Entries per ${stats.aggregationUnit}</div>
          <div class="stat-value">${stats.avgEntriesPerBucket.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Time Span</div>
          <div class="stat-value">${stats.timeSpan}</div>
        </div>
      </div>

      <div class="controls">
        <div class="control-group">
          <span class="control-label">Chart Type:</span>
          <button id="btnBar" class="secondary active" onclick="changeChartType('bar')">📊 Bar</button>
          <button id="btnArea" class="secondary" onclick="changeChartType('area')">📈 Area</button>
          <button id="btnLine" class="secondary" onclick="changeChartType('line')">📉 Line</button>
        </div>
        <div class="control-group">
          <span class="control-label">View:</span>
          <button id="btnTotal" class="secondary active" onclick="changeView('total')">Total</button>
          <button id="btnStacked" class="secondary" onclick="changeView('stacked')">By Level</button>
        </div>
        <button class="secondary" onclick="resetZoom()">🔍 Reset Zoom</button>
        <button class="secondary" onclick="downloadData()">💾 Export CSV</button>
      </div>

      <div class="chart-container">
        <div class="chart-wrapper">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>

      <div class="help-text">
        <strong>💡 Tips:</strong> 
        • Click on data points to navigate to that time period in the log file
        • Use scroll wheel to zoom in/out
        • Click and drag to pan
        • Switch between chart types and views to analyze patterns
        • Export data to CSV for external analysis
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let chart = null;
        let currentChartType = 'bar';
        let currentView = 'total';

        const rawData = ${JSON.stringify(data)};
        const stats = ${JSON.stringify(stats)};

        // Process data
        const labels = rawData.map(d => new Date(d.timestamp));
        const totalCounts = rawData.map(d => d.count);
        const errorCounts = rawData.map(d => d.errorCount);
        const warnCounts = rawData.map(d => d.warnCount);
        const infoCounts = rawData.map(d => d.infoCount);
        const debugCounts = rawData.map(d => d.debugCount);

        // Color scheme
        const colors = {
          total: 'rgba(54, 162, 235, 0.8)',
          error: 'rgba(255, 99, 132, 0.8)',
          warn: 'rgba(255, 159, 64, 0.8)',
          info: 'rgba(75, 192, 192, 0.8)',
          debug: 'rgba(153, 102, 255, 0.8)'
        };

        function createChart() {
          const ctx = document.getElementById('timelineChart').getContext('2d');

          if (chart) {
            chart.destroy();
          }

          const datasets = currentView === 'total' 
            ? [{
                label: 'Log Entries',
                data: totalCounts,
                backgroundColor: colors.total,
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                fill: currentChartType === 'area',
                tension: 0.4
              }]
            : [
                {
                  label: 'ERROR',
                  data: errorCounts,
                  backgroundColor: colors.error,
                  borderColor: 'rgba(255, 99, 132, 1)',
                  borderWidth: 1,
                  fill: currentChartType === 'area',
                  tension: 0.4,
                  stack: 'stack0'
                },
                {
                  label: 'WARN',
                  data: warnCounts,
                  backgroundColor: colors.warn,
                  borderColor: 'rgba(255, 159, 64, 1)',
                  borderWidth: 1,
                  fill: currentChartType === 'area',
                  tension: 0.4,
                  stack: 'stack0'
                },
                {
                  label: 'INFO',
                  data: infoCounts,
                  backgroundColor: colors.info,
                  borderColor: 'rgba(75, 192, 192, 1)',
                  borderWidth: 1,
                  fill: currentChartType === 'area',
                  tension: 0.4,
                  stack: 'stack0'
                },
                {
                  label: 'DEBUG',
                  data: debugCounts,
                  backgroundColor: colors.debug,
                  borderColor: 'rgba(153, 102, 255, 1)',
                  borderWidth: 1,
                  fill: currentChartType === 'area',
                  tension: 0.4,
                  stack: 'stack0'
                }
              ];

          chart = new Chart(ctx, {
            type: currentChartType === 'area' ? 'line' : currentChartType,
            data: {
              labels: labels,
              datasets: datasets
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                intersect: false,
                mode: 'index'
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  labels: {
                    color: 'var(--vscode-foreground)',
                    usePointStyle: true,
                    padding: 15,
                    font: {
                      size: 12
                    }
                  }
                },
                tooltip: {
                  backgroundColor: 'var(--vscode-editor-background)',
                  titleColor: 'var(--vscode-foreground)',
                  bodyColor: 'var(--vscode-foreground)',
                  borderColor: 'var(--vscode-panel-border)',
                  borderWidth: 1,
                  padding: 12,
                  displayColors: true,
                  callbacks: {
                    title: function(context) {
                      const date = new Date(context[0].parsed.x);
                      return date.toLocaleString();
                    },
                    afterBody: function(context) {
                      const index = context[0].dataIndex;
                      const lineNums = rawData[index].lineNumbers;
                      if (lineNums && lineNums.length > 0) {
                        const preview = lineNums.slice(0, 5).join(', ');
                        return '\\nLines: ' + preview + (lineNums.length > 5 ? '...' : '');
                      }
                      return '';
                    }
                  }
                },
                zoom: {
                  zoom: {
                    wheel: {
                      enabled: true,
                      speed: 0.1
                    },
                    pinch: {
                      enabled: true
                    },
                    drag: {
                      enabled: true,
                      backgroundColor: 'rgba(54, 162, 235, 0.2)'
                    },
                    mode: 'x'
                  },
                  pan: {
                    enabled: true,
                    mode: 'x'
                  }
                }
              },
              scales: {
                x: {
                  type: 'time',
                  time: {
                    unit: stats.aggregationUnit,
                    displayFormats: {
                      second: 'HH:mm:ss',
                      minute: 'HH:mm',
                      hour: 'MMM dd HH:mm',
                      day: 'MMM dd',
                      month: 'MMM yyyy',
                      year: 'yyyy'
                    }
                  },
                  title: {
                    display: true,
                    text: 'Time',
                    color: 'var(--vscode-foreground)',
                    font: {
                      size: 13,
                      weight: 'bold'
                    }
                  },
                  ticks: {
                    color: 'var(--vscode-foreground)',
                    maxRotation: 45,
                    minRotation: 0
                  },
                  grid: {
                    color: 'var(--vscode-panel-border)',
                    drawBorder: false
                  }
                },
                y: {
                  stacked: currentView === 'stacked',
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Log Entry Count',
                    color: 'var(--vscode-foreground)',
                    font: {
                      size: 13,
                      weight: 'bold'
                    }
                  },
                  ticks: {
                    color: 'var(--vscode-foreground)',
                    precision: 0
                  },
                  grid: {
                    color: 'var(--vscode-panel-border)',
                    drawBorder: false
                  }
                }
              },
              onClick: function(event, elements) {
                if (elements.length > 0) {
                  const index = elements[0].index;
                  const lineNumbers = rawData[index].lineNumbers;
                  if (lineNumbers && lineNumbers.length > 0) {
                    vscode.postMessage({
                      command: 'navigateToLine',
                      lineNumber: lineNumbers[0]
                    });
                  }
                }
              }
            }
          });
        }

        function changeChartType(type) {
          currentChartType = type;
          
          // Update button states
          document.querySelectorAll('#btnBar, #btnArea, #btnLine').forEach(btn => {
            btn.classList.remove('active');
          });
          document.getElementById('btn' + type.charAt(0).toUpperCase() + type.slice(1)).classList.add('active');
          
          createChart();
        }

        function changeView(view) {
          currentView = view;
          
          // Update button states
          document.querySelectorAll('#btnTotal, #btnStacked').forEach(btn => {
            btn.classList.remove('active');
          });
          document.getElementById('btn' + view.charAt(0).toUpperCase() + view.slice(1)).classList.add('active');
          
          createChart();
        }

        function resetZoom() {
          if (chart) {
            chart.resetZoom();
          }
        }

        function downloadData() {
          let csv = 'Timestamp,Total,Error,Warn,Info,Debug\\n';
          rawData.forEach(d => {
            csv += \`\${d.timestamp},\${d.count},\${d.errorCount},\${d.warnCount},\${d.infoCount},\${d.debugCount}\\n\`;
          });
          
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'log-timeline-data.csv';
          a.click();
          URL.revokeObjectURL(url);
        }

        // Initialize chart
        createChart();
      </script>
    </body>
    </html>
  `;
}