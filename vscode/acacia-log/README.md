# Acacia Log

**Advanced log file analyzer and visualizer for Visual Studio Code.**

Navigate massive log files by timestamp, detect time gaps, visualize activity timelines, search with regex patterns, analyze similar lines, compare multiple files, convert JSONL/NDJSON, and highlight log levels with live colour decorations — all without leaving the editor.

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)

### Introduction Video

https://github.com/user-attachments/assets/1d55ac15-f1cf-4fa5-b95f-dac1eb5614d0

<img alt="Acacia Log - Log Search Screenshot" src="https://github.com/user-attachments/assets/eca1bc9d-12a2-4833-9c98-1ec56417a859" />

---

## What It Does

Working with large or complex log files means spending time scrolling, grepping, and context-switching. Acacia Log brings structured analysis directly into VS Code:

- **Jump to any timestamp** in a `.log`, `.txt`, `.jsonl`, or `.ndjson` file — no more manual scrolling
- **Identify time gaps** where your system went silent, timed out, or stalled
- **Visualize log activity** as interactive bar, area, or line charts with zoom and pan
- **Find the most frequent messages** by grouping similar lines and counting occurrences
- **Search multiple regex patterns** in parallel and see results as charts and statistics
- **Compare throughput across environments** with multi-file chunk statistics
- **Convert JSONL/NDJSON** to plain-text log format with a guided wizard

---

## Feature Overview

| Feature | Description |
|---|---|
| **Date/Time Navigation** | Binary-search jump to any timestamp; virtual document for files > 50 MB |
| **Timeline Chart** | Interactive bar/area/line chart of log activity; click to navigate |
| **Similar Line Analysis** | Group and count repeated log lines; streaming for any file size |
| **Pattern Search** | Multi-regex search with pie/bar/doughnut chart results |
| **Time Gap Report** | HTML report of the top 10 longest silences in a log file |
| **Chunk Statistics** | Descriptive stats (mean, median, P99, skewness, outliers) per file |
| **Multi-File Comparison** | Side-by-side stats + charts + rankings for 2–20 log files |
| **JSONL → Log Converter** | Guided 4-step wizard to convert structured JSONL/NDJSON logs to plain text |
| **Log → JSONL Converter** | Convert any plain-text log to JSON Lines — one entry per timestamp block, with `timestamp`, `message`, `text` fields |
| **Timestamp Auto-Detection** | 20+ format patterns detected automatically; visual status indicators |
| **Log Tree View** | Browse multi-folder log collections; filter by date range or file type |
| **Large-File Safety** | Streaming reads + progress notifications; 200 MB warning |
| **Lens Decorations** | Colour-coded highlights for ERROR / WARN / INFO and custom patterns, visible-range only |

---

## Getting Started

### Install

1. Open VS Code and press `Ctrl+Shift+X` to open Extensions
2. Search for **Acacia Log**
3. Click **Install**

Or via the Command Palette (`Ctrl+P`):
```
ext install manacacia.acacia-log
```

### First Use

1. Click the **Acacia Log icon** in the Activity Bar (left sidebar)
2. The **Log Manager** dashboard shows the active file status and quick-access buttons
3. Add a log folder using the **+** button in the **Log Files** panel, or open a log file directly in the editor
4. Click **Open Log Manager** (or use the toolbar icons) to open the full **Log Manager Panel** in the editor area:
   - **Log Search** — navigate to a date/time position in the open log file
   - **Pattern Search** — search multiple regex patterns in parallel
   - **Similar Lines** — count and rank repeated log lines
   - **Timeline** — generate an interactive activity chart
   - **File Info** — view metadata and timestamp detection status
   - **Compare Stats** — compare chunk statistics across multiple files
   - **JSONL Conversion** — convert between Log and JSONL formats

All result views open as editor tabs for full-screen reading.

---

## Features

### Date/Time Navigation

Jump directly to any moment in a log file using binary search on the timestamp index.

- Supports 20+ timestamp formats with automatic detection
- Format presets for ISO, Apache, Syslog, Log4j, Windows Event Log, UNIX timestamps, and more
- Quick actions: **Today**, **Now**, **Clear**
- **Large-file mode**: files over 50 MB skip full open and instead show 100 lines of context (50 before + 50 after) in a lightweight virtual document

**Supported timestamp formats (examples):**

| Format | Example |
|---|---|
| ISO 8601 | `2024-01-15T10:30:45.123Z` |
| Common Log | `[15/Jan/2024:10:30:45 +0000]` |
| Syslog | `Jan 15 10:30:45` |
| Windows Event Log | `2024-01-15 10:30:45.123` |
| Log4j | `2024-01-15 10:30:45,123` |
| Space-separated | `2024-01-15 10:30:45` |
| UNIX timestamp | `1705316445` |

---

### Timeline Visualization

Transform log activity into interactive charts that reveal spikes, gaps, and patterns.

- **Chart types**: Bar, Area, Line
- **View modes**: Total log volume or stacked by log level (ERROR / WARN / INFO / DEBUG)
- Zoom with mouse wheel; pan by click-and-drag
- Click any data point to navigate to that time range in the log file
- CSV export for external analysis
- **Smart aggregation**: automatically picks the right granularity (second → minute → hour → day → month → year) based on the file's time span

---

### Similar Line Analysis

Identify the most repeated log lines to find recurring errors, retry storms, or noisy patterns.

- Groups lines by structural similarity and ranks by count (descending)
- **Streaming implementation** — the full file is never loaded into memory, safe for logs of any size
- Results displayed in a new editor document
- Progress spinner and 200 MB warning for very large files

---

### Lens Decorations _(New in 3.8.4)_

Colour-coded highlights appear automatically in the editor as you open and scroll log files.

- Matched text (not the whole line) is highlighted in bold with the colour defined in `logPatterns.json`
- **Visible-range only** — only the lines currently on screen are scanned; no performance impact on large files
- Works in both real log files and virtual `acacia-log://` result documents
- Toggle on/off with `Acacia Log: Toggle Lens Decorations` (Command Palette or `$(color-mode)` editor toolbar button)
- Persistent via `acacia-log.lensDecorationsEnabled` setting; reacts live to configuration changes

---

### Pattern-Based Search

Search for multiple regex patterns simultaneously and visualize the results.

- Patterns defined in a simple JSON file
- Parallel search across the selected log file
- Results visualized as pie, bar, or doughnut charts (switchable)
- Statistical summary: per-pattern counts and line numbers
- Results exported to JSON

**Pattern file format:**
```json
[
  {
    "key": "Errors",
    "regexp": "ERROR|FATAL|CRITICAL",
    "regexpoptions": "gi"
  },
  {
    "key": "Warnings",
    "regexp": "WARN|WARNING",
    "regexpoptions": "gi"
  }
]
```

---

### Time Gap Report (HTML)

Detect and rank periods of silence in your logs — useful for finding timeouts, hangs, or processing stalls.

- Identifies the **top 10 longest time gaps** between consecutive log entries
- Interactive HTML report with VS Code theme integration (dark/light)
- Shows gap duration (ms/s/m/h), start/end timestamps, line number, and actual log line text
- One-click export to a standalone HTML file

**Use cases:** application hangs, service timeouts, monitoring gaps, processing bottlenecks

---

### Chunk Duration Statistics

Full descriptive statistics over every inter-entry time interval ("chunk") in the log.

**Statistics computed:** count, mean, median, min, max, P90, P95, P99, standard deviation, skewness, excess kurtosis

**Report sections:**
- Descriptive statistics table with plain-English shape annotations
- Distribution histogram with approximated normal curve
- Min/max chunk cards with timestamps and log line text
- IQR outlier table (up to 25 entries with log text)

**Use cases:** P99 tail latency analysis, SLA verification, bursty activity detection, root-cause investigation

---

### Multi-File Chunk Statistics Comparison

Compare log throughput and latency across 2–20 log files in a single report.

**How to use:** Ctrl+click (or Cmd+click on macOS) to select files in the Log Files tree, then click the **Compare** icon.

**Report sections:**
- Natural-language analysis summary (throughput, tail latency, consistency, distribution shape, outlier density, worst-case chunk, overall verdict)
- Side-by-side statistics table — 16 metrics with green/red best/worst highlighting
- 6 visual bar charts (Mean, Median, P99, Std Dev, CV%, Outlier%)
- Rankings with gold/silver/bronze medals per metric
- Colour-coded legend — each file gets a distinct colour throughout

**Use cases:** dev vs staging vs prod comparison, before/after performance optimization, identifying the most erratic service instance

---

### JSONL → Log Converter

Convert structured JSON-Lines log files into plain-text format so all analysis features work on them.

- `.jsonl` and `.ndjson` files appear automatically in the Log Files tree alongside `.log`/`.txt` files
- **4-step guided wizard:**
  1. Pick the **timestamp** field
  2. Pick the **log level** field
  3. Pick the **message** field
  4. Select optional **extra fields**
- Auto-detects all JSON keys from the first 50 lines, sorted by frequency with recommended fields highlighted
- Output example: `2026-02-21T10:00:00Z [ERROR] Connection timeout service=api`
- Non-JSON lines passed through unchanged
- Prompts before overwriting an existing `.log` sibling

---

### Log → JSONL Converter _(New in 3.8.5)_

Convert any plain-text log file into JSON Lines format — one JSON object per logical log entry.

**Access:**
- Command Palette → `Acacia Log: Convert to JSONL`
- `$(json)` toolbar icon in the **Log Files** tree
- Right-click any file in the **Log Files** tree → **Convert to JSONL**

**Output fields per entry:**

| Field | Value |
|---|---|
| `timestamp` | ISO-8601 string, or `null` if not detected |
| `message` | First-line summary (timestamp stripped by default) |
| `text` | Full multiline block, lines joined with `\n` |

**Grouping rules:** a new entry starts at every line whose prefix matches the auto-detected timestamp pattern; all following non-matching lines (stack traces, continuation lines) are appended to that entry's `text`.

**Settings:**

| Setting | Default | Description |
|---|---|---|
| `acacia-log.jsonl.messageMode` | `"firstLineMinusTimestamp"` | `"firstLineAsIs"` keeps the whole first line |
| `acacia-log.jsonl.maxMultilineSize` | `1000` | Max lines per entry; extras are dropped with a `[... truncated ...]` marker |
| `acacia-log.jsonl.openResultInNewEditor` | `true` | `false` replaces the current document in-place |

---

### Automatic Timestamp Detection

The extension automatically identifies the timestamp format used in each log file.

- 20+ built-in patterns covering ISO, Apache, Syslog, Log4j, dot/dash/slash separators, with and without seconds
- Visual status indicators in the Log Files tree: 🟢 detected, 🔴 not detected
- One-click auto-detect buttons in Log Search, Similar Lines, and Timeline tabs
- 5-minute result cache to avoid repeated scanning

---

### Log Tree View

Browse and manage log files across multiple folders without leaving VS Code.

- Add any filesystem folder; file list loads lazily for instant expansion
- Supports `.log`, `.txt`, `.out`, `.err`, `.trace`, `.jsonl`, `.ndjson`
- **Filter** by date range (presets available) or by file type
- **Single-click**: show file metadata tab (timestamp pattern, line count, size, format)
- **Double-click**: open file in editor
- Smart click detection prevents accidentally opening very large files

---

## Large-File Support

All heavy operations are safe on log files of any size:

| File Size | Behaviour |
|---|---|
| Any size | Similar-line analysis uses streaming reads (never loads full file) |
| > 50 MB | Date/time navigation uses a virtual document (100-line context view) |
| > 200 MB | Upfront warning message + VS Code progress spinner for analysis operations |

---

## Configuration

Configure through VS Code Settings (`Ctrl+,`) or `settings.json`:

| Setting | Description | Default |
|---|---|---|
| `acacia-log.logDateFormat` | Date format for parsing timestamps (Luxon tokens) | `yyyy-MM-dd HH:mm:ss` |
| `acacia-log.logDateRegex` | Regex pattern to match timestamps | `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}` |
| `acacia-log.logSearchDate` | Default search date | `2023-01-01` |
| `acacia-log.logSearchTime` | Default search time | `12:00:00` |
| `acacia-log.logFilePath` | Default log file path for pattern search | `""` |
| `acacia-log.patternsFilePath` | Path to patterns JSON file | `""` |
| `acacia-log.lensDecorationsEnabled` | Enable live colour highlights in the editor based on `logPatterns.json` | `true` |

### Luxon Date Format Tokens

| Token | Meaning | Example |
|---|---|---|
| `yyyy` | 4-digit year | `2024` |
| `MM` | 2-digit month | `01`–`12` |
| `dd` | 2-digit day | `01`–`31` |
| `HH` | Hour (24h) | `00`–`23` |
| `mm` | Minute | `00`–`59` |
| `ss` | Second | `00`–`59` |
| `SSS` | Milliseconds | `000`–`999` |
| `Z` | Timezone offset | `+00:00` |

---

## Commands

Access via the Command Palette (`Ctrl+Shift+P`) — all commands are under the **Acacia Log** category:

| Command | Description |
|---|---|
| `Acacia Log: Log navigate to Date Format` | Set the timestamp format for the active file |
| `Acacia Log: Log navigate to Date RegExp` | Set the regex used to match timestamps |
| `Acacia Log: Log navigate to Search Date` | Set the target date (YYYY-MM-DD) |
| `Acacia Log: Log navigate to Search Time` | Set the target time and execute navigation |
| `Acacia Log: Toggle Lens Decorations` | Toggle colour highlights on/off in the active editor |
| `Acacia Log: Similar Lines` | Stream-analyze and rank similar lines |
| `Acacia Log: Timeline` | Generate an interactive timeline chart |

---

## Troubleshooting

**Timeline shows no data**
- Verify the log file contains valid, parseable timestamps
- Use the auto-detect button to set the format automatically
- Try a preset format from the dropdown first

**Pattern search returns no results**
- Check that file paths in the UI are correct
- Validate your patterns JSON file syntax
- Test with a simpler regex to confirm the file is being read

**Navigation lands in the wrong place**
- Confirm the format string and regex both describe the same timestamp shape
- Check that the target date/time actually exists in the file

**Getting more help**
1. Open the Output panel (`View → Output`) and select **Acacia Log** from the dropdown
2. Check [GitHub Issues](https://github.com/AcaciaMan/acacia-log/issues)
3. Open a new issue with: a sanitized log sample, your settings, and steps to reproduce

---

## Use Cases

**Development & debugging** — navigate to the exact timestamp of a crash, visualize error frequency over time, find the most repeated exception message

**DevOps & SRE** — identify traffic spikes and anomalies, track error rates across deployments, compare throughput between environments

**Performance analysis** — compute P99 tail latency from log timestamps, detect processing bottlenecks with gap reports, compare before/after optimization

**Security review** — timeline of authentication events, frequency analysis of suspicious patterns, multi-pattern search across audit logs

**System administration** — monitor recurring issues in system logs, track service availability from log gaps, analyze log volume trends

---

## Requirements

- **VS Code** 1.109.0 or later
- Windows, macOS, or Linux
- UTF-8 encoded log files

No external runtime or network connection required — all processing is local.

---

## Security

- No external network calls; all operations run locally
- Content Security Policy enforced on all webview panels
- File system access limited to files opened or explicitly selected by the user
- Dependencies audited during packaging

See [SECURITY.md](SECURITY.md) for full details. Report vulnerabilities directly to the maintainer rather than opening a public issue.

---

## Technical Details

- **TypeScript** — type-safe extension code
- **Luxon** — date/time parsing and formatting
- **Chart.js 4.4** — interactive visualizations in webviews
- **VS Code Webview API** — secure sandboxed HTML panels

---

## Contributing

Contributions are welcome.

```bash
git clone https://github.com/AcaciaMan/acacia-log.git
cd acacia-log/vscode/acacia-log
npm install
code .
# Press F5 to launch the Extension Development Host
```

- Report bugs via [GitHub Issues](https://github.com/AcaciaMan/acacia-log/issues)
- Suggest features or submit pull requests on [GitHub](https://github.com/AcaciaMan/acacia-log)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## License

[MIT](LICENSE.md)

---

**Marketplace:** [manacacia.acacia-log](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log) • **Source:** [AcaciaMan/acacia-log](https://github.com/AcaciaMan/acacia-log) • **Issues:** [Report a bug](https://github.com/AcaciaMan/acacia-log/issues)

