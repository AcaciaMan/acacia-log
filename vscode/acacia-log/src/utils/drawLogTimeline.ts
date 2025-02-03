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

  // aggregate the timestamps by months
  // if months are more than 1 year, then aggregate by years
  // if there are only 2 months, then aggregate by days
  // if there are only 2 days, then aggregate by hours
  // if there are only 2 hours, then aggregate by minutes
  // if there are only 2 minutes, then aggregate by seconds

  let aggregationUnit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' = 'second';

  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps[timestamps.length - 1];

  const diffInYears = lastTimestamp.diff(firstTimestamp, 'years').years;
  const diffInMonths = lastTimestamp.diff(firstTimestamp, 'months').months;
  const diffInDays = lastTimestamp.diff(firstTimestamp, 'days').days;
  const diffInHours = lastTimestamp.diff(firstTimestamp, 'hours').hours;
  const diffInMinutes = lastTimestamp.diff(firstTimestamp, 'minutes').minutes;

  if (diffInYears > 1) {
    aggregationUnit = 'year';
  } else if (diffInMonths > 1) {
    aggregationUnit = 'month';
  } else if (diffInDays > 2) {
    aggregationUnit = 'day';
  } else if (diffInHours > 2) {
    aggregationUnit = 'hour';
  } else if (diffInMinutes > 2) {
    aggregationUnit = 'minute';
  }

  console.log('Aggregating by', aggregationUnit);
  const aggregatedTimestamps = timestamps.map(ts => ts.startOf(aggregationUnit));

  // send the aggregated timestamps to the webview
  // the webview will draw a timeline chart based on the timestamps

  const data = aggregatedTimestamps.map(ts => ts.toISO()) as string[];

  const panel = vscode.window.createWebviewPanel(
    'logTimeline',
    'Log Timeline',
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );
  
  // send to the webview also the aggregation unit
  panel.webview.html = getWebviewContent(data, aggregationUnit);
}

function getWebviewContent(data: string[], aggregationUnit: string): string {
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
                  unit: ${JSON.stringify(aggregationUnit)}
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