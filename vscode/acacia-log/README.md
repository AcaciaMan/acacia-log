# Acacia Log 📊

> **Professional log file analysis and visualization for VS Code**

[![Version](https://img.shields.io/badge/version-3.6.5-blue.svg)](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)

Acacia Log is a powerful Visual Studio Code extension designed to make log file analysis effortless. Navigate through massive log files with precision, visualize patterns, and gain insights from your logs—all within your favorite editor.

![Acacia Log Banner](log_icon.png)

<img alt="Screenshot_log_search" src="https://github.com/user-attachments/assets/eca1bc9d-12a2-4833-9c98-1ec56417a859" />

---

## ✨ Key Features

### 🤖 **Automatic Timestamp Detection** _(New in 3.6.0)_
Intelligent pattern recognition that automatically detects timestamp formats in your log files. Visual indicators (🟢 green/🔴 red circles) show detection status in the tree view. One-click auto-detect buttons across all analysis tabs instantly configure timestamp patterns for you.

- **20+ format patterns** - Supports ISO, dash/slash/dot separators, with/without seconds
- **Visual indicators** - Green circle (detected) or red circle (not detected)
- **Auto-detect buttons** - One-click configuration in Log Analysis, Similar Lines, and Timeline tabs
- **Smart caching** - Prevents repeated detection with 5-minute cache

### � **HTML Gap Report** _(New in 3.6.2)_
Analyze time gaps between log entries with an interactive HTML report. Identifies the top 10 longest gaps in your log files, helping you spot delays, timeouts, or periods of inactivity.

- **Interactive visualization** - Beautiful HTML report with VS Code theme integration
- **Export capability** - One-click export to standalone HTML file
- **Smart analysis** - Automatic fine-grained indexing for small files
- **Comprehensive details** - Shows gap duration, timestamps, and log line text
- **Progress tracking** - Real-time progress notifications during analysis
### 📈 **Chunk Duration Statistics Report** _(New in 3.6.5)_
Full descriptive statistics over every inter-entry time gap ("chunk") in the sparse line index. Launched from the `$(pulse)` icon in the Log Analysis toolbar.

- **DescriptiveStats** — count, mean, median, min, max, P90/P95/P99, std dev, skewness, excess kurtosis
- **Min & Max chunks** — refined to show the actual log line text
- **IQR outlier detection** — Tukey fences identify anomalously long or short chunks
- **Distribution histogram** — approximated normal curve for visual spread
- **Shape annotations** — skewness and kurtosis explained in plain English
- **Export capability** — one-click standalone HTML export

### 🔬 **Multi-File Chunk Statistics Comparison** _(New in 3.6.5)_
Compare chunk-duration statistics across 2–20 log files simultaneously. Select files with Ctrl/Cmd+click in the Log Files tree, then click the `$(diff-multiple)` icon.

- **Natural language summary** — auto-generated paragraphs covering throughput, tail latency, consistency (CV), distribution shape, outlier density, worst-case chunk, and an overall verdict
- **Side-by-side table** — 16 metrics × N files with green/red best/worst highlighting
- **6 visual bar charts** — Mean, Median, P99, Std Dev, CV, Outlier %
- **6 dimension rankings** — gold/silver/bronze medals per metric
- **Colour-coded legend** — each file gets a distinct colour throughout the report
- **Export capability** — one-click standalone HTML export
### �📁 **Log Tree View** _(New in 3.2.0)_
Browse and manage log files from multiple folders with rich metadata display. Add custom log folders, view file statistics, and quickly access your logs.

- **Timestamp detection** - Automatic pattern detection with visual indicators _(New in 3.6.0)_
- **Single-click**: Show file info tab with metadata _(New in 3.5.0)_
- **Double-click**: Open file in editor- **Filter by date or file type** - Toolbar filter icon with date range presets and file type selection _(New in 3.6.4)_
- **Lazy initialization** - Instant folder expansion; metadata loads progressively on hover/click _(New in 3.6.4)_- Smart click detection prevents accidentally opening large files

### 📋 **File Info Tab** _(Enhanced in 3.6.0)_
Optimized for performance with instant loading. Shows detected timestamp pattern, format details, and total line count—all without lengthy statistics calculations.

### 📑 **5-Tab Interface** _(Enhanced in 3.6.1)_
Clean, organized interface with dedicated tabs for each analysis tool. Native VS Code toolbar buttons provide quick access to all features with standard icons and tooltips.

- **Native toolbar navigation** - 5 buttons integrated with VS Code's view title bar _(New in 3.6.1)_
- **Compact layout** - Optimized spacing for maximum data visibility _(New in 3.6.1)_
- **Quick switching** - One-click access to Log Analysis, Similar Lines, Timeline, Pattern Search, and File Info
- **Standard icons** - VS Code icons for familiar navigation experience

### 🎯 **Precise Date/Time Navigation**
Jump directly to any timestamp in your log files with intelligent date parsing and format detection.

### 📊 **Interactive Timeline Visualization**
Transform your logs into beautiful, interactive charts that reveal patterns and anomalies at a glance.

### 🔍 **Pattern-Based Search**
Search for multiple patterns simultaneously across large log files with visual results and statistical analysis.

### 📈 **Similar Line Analysis**
Identify repetitive patterns and group similar log entries to understand what's happening most frequently.

### 🎨 **Modern UI** _(Enhanced in 3.6.1)_
Beautifully designed interface that respects VS Code themes and provides an intuitive user experience.

- **Native integration** - Toolbar buttons in VS Code's standard location
- **Compact view** - Reduced padding and spacing for more visible data
- **Optimized layout** - 30-40% space savings in sidebar display
- **Clean design** - Streamlined interface with efficient information density

---

## 🚀 Getting Started

### Installation

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on Mac)
3. Type: `ext install manacacia.acacia-log`
4. Press Enter

Or search for "Acacia Log" in the Extensions view (`Ctrl+Shift+X`).

### Quick Start

1. **Open a log file** in VS Code
2. **Click the Acacia Log icon** in the Activity Bar (left sidebar)
3. **Browse log files** in the Log Files tree view, or add custom log folders
4. **Use the toolbar buttons** in the Log Analysis view to switch between tools:
   - 🔍 **Log Analysis** - Navigate to date/time in log files
   - 🔎 **Pattern Search** - Search using regex patterns
   - 📊 **Similar Lines** - Analyze repetitive log patterns
   - 📈 **Timeline** - Generate visual timeline charts
   - 📋 **File Info** - View file metadata and statistics
5. **Results open in editor tabs** giving you full screen space to view and analyze data

**Tip:** All navigation buttons are located in the view title bar for quick access!

---

## 📖 Feature Guide

### 🗓️ Date/Time Navigation

Navigate to specific moments in your log files with precision.

**Features:**
- 🎯 Direct timestamp navigation
- 📅 Calendar date picker
- ⏰ Time input with second precision
- 🔧 Support for 11+ common log formats
- 🚀 Quick actions: "Today", "Now", "Clear"

**Supported Formats:**
- ISO 8601 (`2024-01-15T10:30:45.123Z`)
- Apache/Common Log Format (`[15/Jan/2024:10:30:45 +0000]`)
- Syslog (`Jan 15 10:30:45`)
- Windows Event Log (`2024-01-15 10:30:45.123`)
- Log4j (`2024-01-15 10:30:45,123`)
- UNIX Timestamps
- And more...

**How to Use:**
1. Open the "Process current log file" panel
2. Select or enter your log's date format (regex and format string)
3. Choose your target date and time
4. Click "Navigate to Date & Time"

**Keyboard Shortcut:** Press `Enter` in any input field to search immediately.

---

### 📊 Log Timeline Visualization

Generate stunning interactive charts that show log activity over time.

**Features:**
- 📈 **Multiple Chart Types**: Bar, Area, and Line charts
- 🎨 **Dual View Modes**: Total volume or stacked by log level
- 🔍 **Interactive Zoom & Pan**: Explore your data in detail
- 🖱️ **Click to Navigate**: Jump to any time period in your log
- 📊 **Statistics Dashboard**: Total entries, time buckets, averages
- 💾 **CSV Export**: Download data for external analysis
- 🎯 **Auto Log Level Detection**: Recognizes ERROR, WARN, INFO, DEBUG

**Chart Types:**
- **📊 Bar Chart** - Compare volumes across time periods
- **📈 Area Chart** - Visualize trends and patterns
- **📉 Line Chart** - Clean view of changes over time

**View Modes:**
- **Total View** - Overall log volume
- **Stacked View** - Color-coded by log level:
  - 🔴 ERROR (Red)
  - 🟠 WARN (Orange)
  - 🟢 INFO (Teal)
  - 🟣 DEBUG (Purple)

**How to Use:**
1. Open a log file
2. Click "Draw Log Timeline" in the sidebar panel
3. Explore the interactive chart
4. Use mouse wheel to zoom, drag to pan
5. Click any data point to navigate to that section in the log

**Smart Aggregation:**
The extension automatically selects the optimal time granularity:
- Logs spanning years → Aggregate by **year**
- Multiple months → Aggregate by **month**
- Multiple days → Aggregate by **day**
- Multiple hours → Aggregate by **hour**
- Minutes or seconds → Finest granularity

---

### 🔎 Pattern-Based Search

Search for multiple regex patterns across your log files simultaneously.

**Features:**
- 🎯 Multi-pattern search in parallel
- 📁 Native file picker integration
- 📊 Visual results with pie/bar/doughnut charts
- 📈 Statistical analysis (counts, line numbers)
- 💾 Results exported to JSON
- 🎨 Interactive chart type switching
- ✅ File path validation with visual feedback

**How to Use:**
1. Create a JSON file with your search patterns:
   ```json
   [
     {
       "key": "Error Pattern",
       "regexp": "ERROR|FATAL|CRITICAL",
       "regexpoptions": "gi"
     },
     {
       "key": "Warning Pattern",
       "regexp": "WARN|WARNING",
       "regexpoptions": "gi"
     }
   ]
   ```
2. Open the "Search for patterns" panel
3. Select your log file (use 📁 browse button)
4. Select your patterns JSON file
5. Click "Search Patterns"
6. View results in the interactive chart and JSON editor

**Pattern File Format:**
- `key`: Display name for the pattern
- `regexp`: Regular expression to search for
- `regexpoptions`: Regex flags (e.g., "gi" for global, case-insensitive)

---

### 📋 Similar Line Analysis

Find and count similar lines to identify patterns and repetitions.

**Features:**
- 🔢 Count occurrences of similar log entries
- 📊 Sort by frequency (descending)
- 🎯 Identify most common messages
- 📝 Display in a new editor window

**How to Use:**
1. Open a log file
2. Click "Calculate Similar Line Counts" in the sidebar panel
3. Review the sorted results

**Use Cases:**
- Find the most frequent error messages
- Identify repeated warnings
- Detect spam or retry patterns
- Understand common operations

---

### 📊 HTML Gap Report _(New in 3.6.2)_

Analyze time gaps between log entries to identify delays, timeouts, or periods of inactivity.

**Features:**
- 📈 **Top 10 Gaps** - Identifies the longest time gaps in your log file
- 🎨 **Interactive HTML Report** - Beautiful visualization with VS Code theme integration
- 💾 **Export Capability** - One-click export to standalone HTML file
- ⚡ **Smart Indexing** - Automatically uses fine-grained analysis for small files
- 📊 **Comprehensive Details** - Shows gap duration, timestamps, line numbers, and log text
- 🔄 **Progress Tracking** - Real-time notifications during analysis

**How to Use:**
1. Select a log file in the Log Files tree view
2. Click the **HTML Report** icon (📊) in the Log Analysis view toolbar
3. Wait for analysis to complete (with progress notifications)
4. View the interactive report in a new webview panel
5. Click **Export HTML** button to save as standalone file

**Report Contents:**
- File metadata (name, total records, log time span)
- Ranked list of gaps with:
  - Gap duration (formatted as ms/s/m/h)
  - Start and end timestamps
  - Line number where the gap occurs
  - The actual log line text

**Use Cases:**
- Identify application hangs or delays
- Find timeout periods in service logs
- Detect gaps in monitoring data
- Analyze processing bottlenecks
- Spot periods of inactivity

---

### 📈 Chunk Duration Statistics Report _(New in 3.6.5)_

Compute full descriptive statistics over every inter-entry time gap in the sparse line index.

**How to Use:**
1. Select a log file in the Log Files tree view (or keep one open in the editor)
2. Click the **Chunk Stats** icon (`$(pulse)`) in the Log Analysis view toolbar
3. Wait for analysis to complete
4. View the report in a new webview panel; click **Export HTML** to save

**Report Contents:**
- **Descriptive statistics table** — count, mean, median, min, max, P90/P95/P99, std dev, skewness (with shape annotation), excess kurtosis (with shape annotation)
- **Distribution histogram** — approximated normal curve centred on the mean
- **Min & Max chunk cards** — the fastest and slowest chunks with timestamps and log line text
- **Outlier table** — up to 25 IQR-detected outliers with timestamps and log text

**Use Cases:**
- Understand the statistical shape of processing throughput
- Identify P99 tail latency for performance SLA analysis
- Spot skewed distributions that may indicate bursty activity
- Pin-point specific outlier entries for root-cause investigation

---

### 🔬 Multi-File Chunk Statistics Comparison _(New in 3.6.5)_

Compare chunk-duration statistics across multiple log files in a single interactive report.

**How to Use:**
1. In the **Log Files** tree, hold **Ctrl** (Windows/Linux) or **Cmd** (macOS) and click to select 2–20 log files
2. Click the **Compare Chunk Stats** icon (`$(diff-multiple)`) in the Log Files toolbar, _or_ right-click any selected file → **Compare Chunk Statistics (multi-file)**
3. Wait for analysis to complete (each file analysed sequentially with progress)
4. View the comparison report and click **Export HTML** to save

**Report Contents:**
- **Analysis Summary** — paragraphs in plain English covering: throughput (mean/median ratio), tail latency (P99), processing consistency (CV), distribution shape, outlier density, worst-case chunk, overall verdict
- **Side-by-side statistics table** — 16 metrics with green (best) / red (worst) highlighting
- **6 visual bar charts** — Mean, Median, P99, Std Dev, CV %, Outlier %
- **Rankings** — 6 league tables with gold/silver/bronze medals
- **Colour-coded legend** — each file assigned a distinct colour throughout the report

**Use Cases:**
- Compare log throughput across different environments (dev / staging / prod)
- A/B compare before and after a performance optimisation
- Identify which service instance has the most erratic latency
- Benchmark processing speed across different application versions

---

## 🎛️ Configuration

### Extension Settings

Configure Acacia Log through VS Code Settings (`Ctrl+,`):

| Setting | Description | Default |
|---------|-------------|---------|
| `acacia-log.logDateFormat` | Date format for parsing timestamps | `yyyy-MM-dd HH:mm:ss` |
| `acacia-log.logDateRegex` | Regex pattern to match timestamps | `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}` |
| `acacia-log.logSearchDate` | Default search date | `2023-01-01` |
| `acacia-log.logSearchTime` | Default search time | `12:00:00` |
| `acacia-log.logFilePath` | Path to log file for pattern search | `""` |
| `acacia-log.patternsFilePath` | Path to patterns JSON file | `""` |

### Format Strings

Acacia Log uses [Luxon](https://moment.github.io/luxon/) date format tokens:

| Token | Meaning | Example |
|-------|---------|---------|
| `yyyy` | 4-digit year | 2024 |
| `MM` | 2-digit month | 01-12 |
| `dd` | 2-digit day | 01-31 |
| `HH` | 2-digit hour (24h) | 00-23 |
| `mm` | 2-digit minute | 00-59 |
| `ss` | 2-digit second | 00-59 |
| `SSS` | Milliseconds | 000-999 |
| `Z` | Timezone offset | +00:00 |

---

## 🎨 User Interface

### Sidebar Panels

Acacia Log adds a dedicated icon to the Activity Bar with two panels:

#### 📝 Process Current Log File
- Date/time navigation controls
- Quick action buttons (Today, Now, Clear)
- Format configuration with presets
- Timeline and similar lines analysis

#### 🔍 Search for Patterns
- Log file and patterns file selection
- Browse buttons for easy file picking
- Live results visualization
- Multiple chart type options

### Webview Features

All interfaces include:
- ✨ Modern, responsive design
- 🌗 Automatic theme adaptation (dark/light)
- 💡 Contextual help tooltips
- ⌨️ Keyboard shortcuts
- 🔄 Loading states and status feedback
- 📱 Mobile-friendly layouts

---

## 🎯 Commands

Access these commands via the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `Acacia Log: Log navigate to Date Format` | Set the date format used in log files |
| `Acacia Log: Log navigate to Date RegExp` | Set the regex to match dates |
| `Acacia Log: Log navigate to Search Date` | Set the search date (YYYY-MM-DD) |
| `Acacia Log: Log navigate to Search Time` | Set the search time and execute |
| `Acacia Log: Calculate Similar Line Counts` | Analyze and count similar lines |
| `Acacia Log: Draw Log Timeline` | Generate interactive timeline chart |

---

## 💡 Tips & Tricks

### Performance Tips
- For very large files (>100MB), timeline generation may take a few seconds
- Pattern search runs in parallel for optimal performance
- Use specific regex patterns to avoid false matches

### Best Practices
1. **Test Your Regex**: Use the preset formats or test your regex in the input field
2. **Organize Patterns**: Group related patterns in your JSON file with descriptive keys
3. **Use Zoom**: In timeline charts, zoom into specific time ranges for detailed analysis
4. **Export Data**: Use CSV export to share timeline data with your team

### Keyboard Shortcuts
- `Enter` - Execute search from any input field
- Mouse wheel - Zoom in/out on timeline charts
- Click & drag - Pan across timeline charts

---

## 🔧 Troubleshooting

### Timeline Not Showing?
- Ensure your log file contains valid timestamps
- Verify your date format matches your log file format
- Check the regex pattern matches your timestamp format

### Pattern Search Returns No Results?
- Verify file paths are correct
- Check patterns JSON file syntax
- Ensure regex patterns are valid
- Test patterns with smaller log samples first

### Navigation Not Working?
- Confirm the date/time exists in your log file
- Check that format string matches regex pattern
- Try using a preset format first

### Getting Help
If you encounter issues:
1. Check the Output panel (`View > Output`, select "Acacia Log")
2. Review the [GitHub Issues](https://github.com/AcaciaMan/acacia-log/issues)
3. Create a new issue with:
   - Log file sample (sanitized)
   - Your configuration settings
   - Steps to reproduce

---

## 📊 Use Cases

### Development & Debugging
- Navigate to specific error timestamps
- Visualize error frequency over time
- Find patterns in exception messages

### DevOps & Monitoring
- Analyze application behavior patterns
- Identify traffic spikes or anomalies
- Track error rates across deployments

### Security Analysis
- Search for suspicious patterns
- Timeline of security events
- Frequency analysis of access attempts

### System Administration
- Monitor system log patterns
- Identify recurring issues
- Track service availability

---

## 🛠️ Technical Details

### Built With
- **TypeScript** - Type-safe development
- **Luxon** - Modern date/time handling
- **Chart.js 4.4** - Interactive visualizations
- **VS Code API** - Native integration

### Performance
- Async file processing for large logs
- Parallel pattern searching
- Efficient data aggregation
- Optimized chart rendering

### Compatibility
- VS Code 1.96.0 or higher
- Works on Windows, macOS, and Linux
- Supports UTF-8 encoded log files

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs**: Open an issue with details
2. **Suggest Features**: Share your ideas in issues
3. **Submit PRs**: Fork, create a branch, and submit a pull request
4. **Improve Docs**: Help make documentation clearer

### Development Setup
```bash
# Clone the repository
git clone https://github.com/AcaciaMan/acacia-log.git

# Install dependencies
cd acacia-log/vscode/acacia-log
npm install

# Open in VS Code
code .

# Press F5 to run in Extension Development Host
```

---

## 📝 Changelog

### Version 2.1.1 (Latest)
- ✨ Completely redesigned user interface
- 📊 New interactive timeline with multiple chart types
- 🎨 Enhanced pattern search with visual charts
- 🔍 Improved date/time navigation with presets
- 💾 CSV export functionality
- 🌗 Better theme integration
- ⚡ Performance improvements
- 🐛 Bug fixes and stability improvements

[View Full Changelog](CHANGELOG.md)

---

## � Security

This extension follows VS Code security best practices:

- **No External Network Calls**: All operations are performed locally
- **Secure WebViews**: Content Security Policy enforced on all panels
- **File System Access**: Only reads files opened in the workspace
- **Build Security**: No development server mode used (esbuild watch only)
- **Package Integrity**: Dependencies audited during installation

For detailed security information, see [SECURITY.md](SECURITY.md).

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue.

---

## �📄 License

This extension is licensed under the [MIT License](LICENSE.md).

---

## 🌟 Support

If you find Acacia Log useful, please:
- ⭐ Star the [GitHub repository](https://github.com/AcaciaMan/acacia-log)
- ✍️ Leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log)
- 🐦 Share with your team
- 💖 Consider sponsoring development

---

## 📧 Contact

- **GitHub**: [AcaciaMan/acacia-log](https://github.com/AcaciaMan/acacia-log)
- **Issues**: [Report a bug or request a feature](https://github.com/AcaciaMan/acacia-log/issues)
- **Marketplace**: [VS Code Marketplace Page](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log)

---

<div align="center">

**Made with ❤️ for developers who work with logs**

[Install Now](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log) • [Documentation](https://github.com/AcaciaMan/acacia-log) • [Report Issue](https://github.com/AcaciaMan/acacia-log/issues)

</div>







