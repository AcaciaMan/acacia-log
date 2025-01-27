import * as vscode from 'vscode';
import { DateTime } from 'luxon';

export async function drawLogTimeline(editor: vscode.TextEditor) {
  const document = editor.document;
  const text = document.getText();
  const lines = text.split('\n');
  const logDateRegex = new RegExp(vscode.workspace.getConfiguration('acacia-log').get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}');
  const logDateFormat = vscode.workspace.getConfiguration('acacia-log').get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';

  const timestamps: DateTime[] = [];

  for (const line of lines) {
    const match = line.match(logDateRegex);
    if (match) {
      const dateTime = DateTime.fromFormat(match[0], logDateFormat);
      if (dateTime.isValid) {
        timestamps.push(dateTime);
      }
    }
  }

  const data = timestamps.map(ts => ts.toISO()).filter((d): d is string => d !== null);

  const panel = vscode.window.createWebviewPanel(
    'logTimeline',
    'Log Timeline',
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(data);
}

function getWebviewContent(data: string[]): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Log Timeline</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    </head>
    <body>
      <canvas id="logTimelineChart" width="800" height="400"></canvas>
      <script>
        const ctx = document.getElementById('logTimelineChart').getContext('2d');
        const data = ${JSON.stringify(data)};
        const labels = data.map(d => new Date(d));
        const chartData = {
          labels: labels,
          datasets: [{
            label: 'Log Entries',
            data: labels.map((_, index) => index + 1),
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
            fill: false
          }]
        };
        const config = {
          type: 'line',
          data: chartData,
          options: {
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: 'minute'
                },
                title: {
                  display: true,
                  text: 'Time'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Log Entries'
                }
              }
            }
          }
        };
        new Chart(ctx, config);
      </script>
    </body>
    </html>
  `;
}