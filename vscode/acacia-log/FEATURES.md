# Acacia Log - Detailed Features Guide

## Table of Contents
- [Editor Tools](#editor-tools) _(New in 3.7.0, Enhanced in 3.8.0)_
- [Large-File Optimisations](#large-file-optimisations) _(New in 3.8.0)_
- [Log Tree View](#log-tree-view) _(New in 3.2.0)_
- [Unified Tabbed Interface](#unified-tabbed-interface) _(New in 3.2.0)_
- [Date/Time Navigation](#datetime-navigation)
- [Timeline Visualization](#timeline-visualization)
- [Pattern Search](#pattern-search)
- [Similar Line Analysis](#similar-line-analysis)
- [HTML Gap Report](#html-gap-report) _(New in 3.6.2, Enhanced in 3.6.3)_
- [Chunk Duration Statistics Report](#chunk-duration-statistics-report) _(New in 3.6.5)_
- [Multi-File Chunk Statistics Comparison](#multi-file-chunk-statistics-comparison) _(New in 3.6.5)_
- [JSONL / NDJSON Support](#jsonl--ndjson-support) _(New in 3.6.7)_
- [UI Components](#ui-components)
- [Advanced Usage](#advanced-usage)

---

## Editor Tools

### Overview _(New in 3.7.0, Enhanced in 3.8.0)_
The **Editor Tools** sidebar view provides a focused workspace for running analysis directly on the log file currently open in the editor. Instead of an in-view tab bar, navigation is driven entirely by three **VS Code toolbar icons** at the top of the view — clicking an icon focuses the view and switches to the corresponding tool.

### Toolbar Icons

| Icon | Command | Tab shown |
|------|---------|----------|
| `$(search)` | Log Search | Date/time navigation form |
| `$(graph)` | Similar Lines | Similar-line analysis form |
| `$(graph-line)` | Timeline | Timeline drawing form |

### File Resolution _(New in 3.8.0)_
All five message handlers (Log Search, Similar Lines, Timeline, Test Regex, Auto-Detect) resolve the target file via a two-step priority chain without requiring an active text editor:

1. **Active text editor** — used when a real log file (not a virtual `acacia-log:` result document) is open and focused.
2. **Log Explorer selection** — falls back to the file most recently clicked in the Log Explorer tree, opening it on demand as a text document.

A clear error message — *"No log file available. Open a log file or select one in the Log Explorer."* — is displayed only when neither source can be resolved. Selecting any file in the Log Explorer automatically updates the Editor Tools view via `setSelectedLogFile()`.

### Log Search Tab
- **Date/time regex** — configure or auto-detect the timestamp pattern in the active file
- **Format string** — Luxon-compatible format for parsing matched timestamps
- **Preset selector** — 8 built-in format presets (Standard, ISO 8601, Apache, Syslog, …)
- **Auto-Detect** button — one-click detection from the first 1 000 lines of the active file
- **Test Regex** — verify the pattern against the active file and see match count
- **Date & time pickers** — calendar + time input with Today / Now / Clear shortcuts
- Click **Navigate to Date & Time** (or press Enter) to jump to the matching line

### Similar Lines Tab
- Same format-configuration section as Log Search (regex, format string, presets, auto-detect)
- Click **Calculate Similar Lines** (or press Enter) to group and rank repeated log lines
- Results open in a new editor tab sorted by occurrence count

### Timeline Tab
- Same format-configuration section as Log Search
- Click **Draw Timeline** (or press Enter) to produce an interactive HTML timeline chart
- Chart opens in a new editor tab showing log-entry density over time

---

## Large-File Optimisations

### Overview _(New in 3.8.0)_
All three heavy analysis operations are designed to handle log files of any size without freezing the editor or exhausting memory.

### File Size Warning & Progress Notification
When the active file exceeds **200 MB**, the extension:
1. Shows an upfront `vscode.window.showInformationMessage`: *"This file is large (X MB). Analysis may take a moment."*
2. Wraps the entire analysis in a `vscode.window.withProgress` Notification spinner so the user can see that work is in progress.

This applies to `calculateSimilarLineCounts`, `drawLogTimeline`, and `navigateToDateTime`. Processing is never blocked or cancelled — the warning is purely informational.

### Streaming Similar-Line Counts
`calculateSimilarLineCounts` processes the file without loading it entirely into memory:
- Uses `fs.createReadStream` + `readline.createInterface` to read one line at a time.
- The file path is derived from `editor.document.uri.fsPath`; the public function signature is unchanged.
- A `try/finally` block guarantees `rl.close()` and `stream.destroy()` are called even on error.

### Virtual-Document Navigation for Files > 50 MB
When `navigateToDateTime` detects a file larger than **50 MB** and a timestamp format has been detected, it switches to a streaming path instead of opening the whole file in the editor:

| Step | What happens |
|------|--------------|
| **1. Index** | `buildLineIndex` streams the entire file once, recording a byte offset every 1 000 lines together with the parsed timestamp. |
| **2. Search** | `jumpToTimestamp` binary-searches the sparse index, then refines the match by linear scan within the nearest chunk. |
| **3. Read** | `readLineRange` seeks to the nearest indexed byte offset and reads only the context window (50 lines before + 50 lines after the match). |
| **4. Display** | A virtual read-only document is opened via `ResultDocumentProvider.openLogChunkResult`. Each line is prefixed with its real 1-based line number padded to a consistent width. A 3-line header shows the file path, matched line number, and ISO timestamp. |
| **5. Reveal** | `editor.revealRange` scrolls the virtual document to the matched line with `InCenter` alignment. |

Files ≤ 50 MB continue to use the original fast in-editor binary search (`document.lineAt`).

---

## Log Tree View

### Overview
The Log Tree View provides a hierarchical interface for browsing and managing log files from multiple sources. Located at the top of the Acacia Log sidebar, it automatically discovers log files in your workspace and custom folders.

### Key Features

#### 1. **Automatic Log File Detection**
- Automatically finds files with extensions: `.log`, `.txt`, `.out`, `.err`, `.trace`, `.jsonl`, `.ndjson`
- Works in workspace folders and custom added folders
- Hierarchical folder structure with expandable/collapsible sections

#### 2. **Rich Metadata Display**
- **File size** - Shown in B, KB, or MB
- **Line count** - Total number of lines in the file
- **Timestamp detection** - Visual indicators: 🟢 (detected) or 🔴 (not detected) _(New in 3.6.0)_
- **Detected pattern** - Shows the timestamp format pattern in tooltips _(New in 3.6.0)_
- **Last modified** - File modification timestamp
- Tooltips with detailed statistics including detected format on hover

#### 3. **Folder Management**
- **Add Folder** - Browse and add custom log folders (persists across sessions)
- **Remove Folder** - Remove watched folders via context menu
- **Auto-refresh** - File system watchers update view when files change
- Folders stored globally, available across all workspaces

#### 4. **Quick Actions**
- **Open File** - Double-click or use context menu to open in editor
- **Reveal in Explorer** - Show file in system file explorer
- **Refresh** - Manually refresh the entire tree view

#### 5. **Filter Log Files** _(New in 3.6.4)_
A filter icon in the Log Files view title bar lets you narrow down which files are shown.

**Filter by date range:**
- **Today** — files modified or created today
- **Yesterday** — files modified or created yesterday
- **Last 7 days** / **Last 30 days** — rolling windows
- **Custom date** — enter any YYYY-MM-DD start date; files on or after that date are shown
- Both the modified date and created date are checked; a file passes if either falls in the range

**Filter by file type:**
- Multi-select from `.log`, `.txt`, `.out`, `.err`, `.trace`, `.jsonl`, `.ndjson`
- Deselecting all types of a kind reverts to showing all types

**Toolbar behaviour:**
- `$(filter)` icon (outline) — no filter active
- `$(filter-filled)` icon — at least one filter active; click to open the dialog where you can change or clear filters
- Active filter summary is shown as the button description

#### 6. **Performance Optimization** _(Enhanced in 3.6.4)_
- **Lazy initialization** — only the first log file in a folder is fully analysed (line count + timestamp detection) when the folder expands; all other files load instantly with basic stats _(New in 3.6.4)_
- Full metadata is fetched lazily on hover (tooltip appears) or on single-click
- Tree item description and tooltip update in real time once lazy loading completes _(New in 3.6.4)_
- Metadata cache prevents redundant analysis; cache cleared on Refresh
- Timestamp detection results cached for 5 minutes _(New in 3.6.0)_

### Usage

**Add a custom log folder:**
1. Click the **+** (Add Folder) button in the Log Tree View title bar
2. Browse to your log folder
3. Folder is added and automatically scanned for log files

**Open a log file:**
- Double-click any log file in the tree
- Or right-click → "Open Log File"

**View file details:**
- Hover over any file to see detailed tooltip
- Description shows: size • line count • error count

**Remove a folder:**
- Right-click on a folder → "Remove Folder"

---

## Unified Tabbed Interface

### Overview
Version 3.6.1 introduces native VS Code toolbar navigation for all tabs. Buttons are integrated into the view title bar for quick access to all analysis tools with standard VS Code icons.

### Key Features

#### 1. **Native Toolbar Navigation** _(New in 3.6.1)_
- Five toolbar buttons in the Log Analysis view title bar:
  - 🔍 **Log Analysis** (Search icon) - Navigate to date/time in log files
  - 📊 **Similar Lines** (Graph icon) - Analyze and count similar log lines
  - 📈 **Timeline** (Graph-line icon) - Generate visual timeline of log events
  - 🔎 **Pattern Search** (Search-fuzzy icon) - Search log files using regex patterns
  - ℹ️ **File Info** (Info icon) - View file metadata and statistics
- Standard VS Code icons for familiar navigation
- Integrated with native view title bar
- Clean, professional interface without duplicate controls
- One-click switching between analysis modes

#### 2. **Compact View Layout** _(New in 3.6.1)_
- Optimized spacing and padding throughout
- 30-40% space savings for more visible data
- Reduced section padding (16px → 10px)
- Smaller input fields and buttons
- Tighter margins and gaps
- More information density without clutter

#### 3. **Tab 1: Log Analysis**
Tools for navigating to specific dates/times in the currently open log file:
- Date/Time Navigation with calendar picker
- Format Configuration (11 preset formats)
- Quick actions: Today, Now, Clear
- Keyboard shortcuts (Press Enter to search)

#### 4. **Tab 2: Pattern Search**
Tools for searching patterns across log files:
- Log file selection with file browser
- Pattern file (JSON) configuration
- Multi-pattern search execution
- **Results open in editor tabs with rich HTML visualization**
- Interactive pie charts, bar charts, and doughnut charts
- Comprehensive statistics dashboard
- Sortable detailed results with expandable line matches

#### 5. **Tab 3: Similar Lines**
Dedicated tab for analyzing repetitive log patterns:
- Format Configuration (11 preset formats)
- Auto-detect button for timestamp format _(New in 3.6.0)_
- Calculate similar line counts for current file
- **Results open in editor result tab**
- Groups similar patterns with occurrence counts
- Full editor features for results analysis

#### 6. **Tab 4: Timeline**
Dedicated tab for generating visual timelines:
- Format Configuration (11 preset formats)
- Auto-detect button for timestamp format _(New in 3.6.0)_
- Generate interactive timeline for current file
- Multiple chart types: Bar, Area, Line
- Automatic log level detection (ERROR, WARN, INFO, DEBUG)
- Click-to-navigate to specific log entries
- CSV export functionality

#### 7. **Tab 5: File Info** _(New in 3.5.0)_
View comprehensive file metadata:
- File name, path, and size
- Total line count
- Timestamp detection status with visual indicators
- Detected pattern and format details
- Created, modified, and accessed dates
- Quick action buttons to open or reveal file

#### 8. **Space-Efficient Design**
- Single compact webview with 5 organized tabs
- Native toolbar buttons for quick access
- Results display in editor tabs (not in sidebar)
- More room for the Log Files tree view
- Optimized spacing for maximum data visibility _(Enhanced in 3.6.1)_
- Better organization: sidebar for controls, editor for results

### Usage

**Switch between tabs:**
- Click on the toolbar buttons at the top of the Log Analysis view
- Standard VS Code icons for familiar navigation
- Tabs remember your settings when switching

**Tab persistence:**
- Each tab maintains its state independently
- Configuration values persist across tab switches
- Format settings can be different per tab

---

## Date/Time Navigation

### Overview
Navigate to any timestamp in your log files with precision. The extension supports multiple date/time formats and provides an intuitive interface for quick searches. Automatic timestamp detection makes configuration effortless. For files larger than 50 MB, a streaming path is used that never loads the whole file into the editor — see [Large-File Optimisations](#large-file-optimisations) for details.

### Key Features

#### 1. **Automatic Format Detection** _(New in 3.6.0)_
- **Auto-Detect Button** - One-click timestamp pattern detection
- **20+ Formats Supported** - ISO, dash/slash/dot separators, with/without seconds
- **Real-time Status** - Success indicators with pattern details
- **Smart Integration** - Auto-fills regex and format fields across all tabs
- **Intelligent Caching** - 5-minute cache prevents repeated detection
- Supports archived logs with dates outside file date range
- Validates reasonable year ranges (1970-2076)

#### 2. **Format Configuration**
- **Regex Pattern**: Define how to extract timestamps from log lines
- **Format String**: Specify how to parse the extracted timestamp
- **Preset Formats**: 11 common formats built-in:
  - Standard (yyyy-MM-dd HH:mm:ss)
  - ISO 8601
  - Apache/Common Log Format
  - Syslog
  - Windows Event Log
  - Log4j
  - And more...

#### 2. **Search Criteria**
- **Date Picker**: Visual calendar for selecting dates
- **Time Input**: Precise time selection with seconds
- **Quick Actions**:
  - 📅 Today - Sets to current date
  - 🕐 Now - Sets to current time
  - ✖️ Clear - Resets fields

#### 3. **Smart Features**
- Collapsible sections to save space
- Help tooltips for each field
- Form validation before search
- Loading states during processing
- Status feedback (success/error)
- Keyboard shortcut (Enter to search)

### Usage Example

**Scenario**: Find all events at 2:30 PM on January 15, 2024

1. Open log file
2. Select format preset or enter custom format
3. Set date: 2024-01-15
4. Set time: 14:30:00
5. Press Enter or click "Navigate to Date & Time"
6. Editor jumps to that timestamp

### Supported Format Examples

| Log Format | Regex Pattern | Format String |
|------------|---------------|---------------|
| Standard | `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}` | `yyyy-MM-dd HH:mm:ss` |
| ISO 8601 | `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*` | `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` |
| Apache | `\[\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\]` | `[dd/MMM/yyyy:HH:mm:ss Z]` |
| Syslog | `\w{3} \d{2} \d{2}:\d{2}:\d{2}` | `MMM dd HH:mm:ss` |

---

## Timeline Visualization

### Overview
Transform your log files into interactive, visual charts that reveal patterns, spikes, and trends at a glance.

### Chart Types

#### 1. **📊 Bar Chart** (Default)
- Best for comparing log volumes across time periods
- Clear visual representation of activity spikes
- Easy to spot anomalies
- Color-coded by log level in stacked mode

#### 2. **📈 Area Chart**
- Shows trends and patterns over time
- Filled areas emphasize volume
- Great for understanding gradual changes
- Smooth curves for better visualization

#### 3. **📉 Line Chart**
- Clean, minimal view of changes
- Best for detailed trend analysis
- Less visual clutter
- Perfect for presentations

### View Modes

#### Total View
- Shows overall log entry count
- Single dataset for simple analysis
- Blue color scheme
- Best for understanding overall activity

#### Stacked View (By Level)
- Breaks down by log level
- Color-coded layers:
  - 🔴 **ERROR** - Critical issues
  - 🟠 **WARN** - Warnings
  - 🟢 **INFO** - Informational messages
  - 🟣 **DEBUG** - Debug information
- Stacked bars/areas show composition
- Hover to see individual counts

### Interactive Features

#### Zoom & Pan
- **Mouse Wheel**: Zoom in/out on time axis
- **Click & Drag**: Pan across timeline
- **Drag Selection**: Zoom into specific range
- **Reset Button**: Return to full view

#### Click to Navigate
- Click any data point
- Extension jumps to that line in the log file
- Context preserved (opens side by side)

#### Rich Tooltips
- Exact timestamp
- Entry counts per level
- Line numbers preview
- Formatted date/time

### Statistics Dashboard

Displays at the top:
- **Total Log Entries**: Overall count
- **Time Buckets**: Number of aggregated periods
- **Average Entries**: Per time bucket
- **Time Span**: Total duration covered

### Smart Aggregation

Algorithm automatically selects optimal granularity:

| Time Span | Aggregation Unit | Format |
|-----------|------------------|--------|
| > 1 year | Year | yyyy |
| > 2 months | Month | yyyy-MM |
| > 2 days | Day | yyyy-MM-dd |
| > 2 hours | Hour | yyyy-MM-dd HH:00 |
| > 2 minutes | Minute | yyyy-MM-dd HH:mm |
| Otherwise | Second | yyyy-MM-dd HH:mm:ss |

### Log Level Detection

Automatically recognizes:
- **ERROR**: ERROR, ERR, FATAL, CRITICAL
- **WARN**: WARN, WARNING
- **INFO**: INFO, INFORMATION
- **DEBUG**: DEBUG, TRACE, VERBOSE

Case-insensitive pattern matching.

### Export Functionality

**CSV Export** includes:
- Timestamp
- Total count
- Error count
- Warn count
- Info count
- Debug count

Perfect for:
- Excel analysis
- Custom reports
- Data sharing
- External processing

### Usage Tips

1. **Finding Spikes**: Use bar chart to spot unusual activity
2. **Trend Analysis**: Use area chart for pattern recognition
3. **Error Investigation**: Switch to stacked view, look for red layers
4. **Deep Dive**: Zoom into specific time ranges, click to navigate
5. **Reporting**: Export to CSV for stakeholder reports

---

## Pattern Search

### Overview
Search for multiple regex patterns across log files simultaneously with visual results and statistical analysis.

### Key Features

#### File Selection
- **Log File Path**: Path to log file
- **Patterns File Path**: Path to JSON patterns file
- **📁 Browse Buttons**: Native file picker dialogs
- **File Validation**: Visual feedback for valid/invalid paths
- **Smart Filters**:
  - Log files: .log, .txt, all files
  - Patterns: .json, all files

#### Pattern File Format

JSON array with objects:
```json
[
  {
    "key": "Pattern Name",
    "regexp": "regex pattern here",
    "regexpoptions": "gi"
  }
]
```

**Fields:**
- `key`: Display name (used in charts/results)
- `regexp`: JavaScript-compatible regex
- `regexpoptions`: Flags (g=global, i=case-insensitive, m=multiline)

#### Search Execution
- Parallel processing for multiple patterns
- Progress feedback during search
- **Results open in dedicated editor tab with rich HTML visualization**
- Interactive charts and comprehensive statistics dashboard

#### Results Display

**Statistics Dashboard**:
- 🎯 **Total Patterns**: Number of unique patterns searched
- ✓ **Total Matches**: Sum of all matches across patterns
- 📈 **Average Matches**: Average matches per pattern
- 🏆 **Top Pattern**: Pattern with the most matches

**Interactive Visualizations**:
- **Distribution Chart**: Switch between pie, bar, or doughnut chart types
- **Top 10 Patterns**: Horizontal bar chart showing highest match counts
- Real-time chart type switching with visual feedback
- Theme-aware colors matching VS Code theme
- Interactive tooltips with detailed counts

**Detailed Results Cards**:
- Pattern name (syntax-highlighted)
- Match count (prominently displayed)
- Line numbers with actual log content
- First 5 matches shown by default
- "Show all" / "Show less" toggle for complete lists
- Hover effects for better interactivity
- Scrollable lists for long match sets

**Results Summary**:
- Pattern count and total matches displayed at top
- Timestamp of when results were generated
- Results sorted by match count (descending)

#### Chart Visualization

**Distribution Chart** (Left Panel):
- 🥧 **Pie Chart**: Shows proportion of each pattern (default)
- 📊 **Bar Chart**: Compares counts side by side  
- 🍩 **Doughnut Chart**: Like pie with center cutout
- One-click switching between chart types
- Interactive legend with color coding
- Hover tooltips showing exact counts

**Top Patterns Chart** (Right Panel):
- Horizontal bar chart showing top 10 patterns
- Sorted by match count (highest first)
- Easy comparison of most common patterns
- Pattern names truncated for readability

**Chart Features**:
- Theme-aware color palette
- Smooth animations
- Responsive design
- High-quality rendering using Chart.js 4.x

#### HTML Results Editor

Results open in a dedicated editor tab with:
- **Full HTML visualization** with embedded charts
- **Statistics dashboard** at the top
- **Interactive chart controls** for switching visualization types
- **Detailed result cards** with expandable match lists
- **Professional styling** matching VS Code theme
- Can be kept open, refreshed, or closed like any editor tab
- Side-by-side viewing with source log files

**Benefits over plain JSON**:
- Immediate visual insights with charts
- Better readability with formatted cards
- Interactive exploration of results
- Statistical summary at a glance
- Professional presentation for sharing/screenshots

### Usage Example

**Scenario**: Analyze error patterns in application logs

1. **Create patterns.json**:
```json
[
  {
    "key": "Database Errors",
    "regexp": "SQL|database|connection.*failed",
    "regexpoptions": "gi"
  },
  {
    "key": "Authentication Errors",
    "regexp": "auth.*failed|login.*error|invalid.*credentials",
    "regexpoptions": "gi"
  },
  {
    "key": "API Errors",
    "regexp": "HTTP [45]\\d{2}|API.*error|timeout",
    "regexpoptions": "gi"
  }
]
```

2. Open "Search for patterns" panel
3. Browse to log file
4. Browse to patterns.json
5. Click "Search Patterns"
6. Analyze results:
   - See distribution in pie chart
   - Switch to bar chart for comparison
   - Click pattern cards to see line numbers
   - Check JSON output for exact matches

### Advanced Patterns

**Capturing Groups**:
```json
{
  "key": "HTTP Errors",
  "regexp": "HTTP (4\\d{2}|5\\d{2})",
  "regexpoptions": "g"
}
```

**Multiline Patterns**:
```json
{
  "key": "Stack Traces",
  "regexp": "Exception.*\\n(\\s+at .*\\n)+",
  "regexpoptions": "gm"
}
```

**Negative Lookahead**:
```json
{
  "key": "Errors (not test)",
  "regexp": "ERROR(?!.*test)",
  "regexpoptions": "gi"
}
```

---

## Similar Line Analysis

### Overview
Identify and count repeated log entries to understand patterns and frequency.

### How It Works _(Updated in 3.8.0 — fully streaming)_

1. Opens the file as a **read stream** (`fs.createReadStream` + `readline`) — the file is never fully loaded into memory
2. For each line that matches the configured timestamp regex, strips all digits (`\d+`) to normalise the line
3. Counts occurrences of each normalised pattern using `?? 0` initialisation
4. Sorts by frequency (descending), then alphabetically on ties
5. Displays results in a new editor tab via `ResultDocumentProvider`

For files over 200 MB, an upfront information message is shown and a progress spinner is displayed in the VS Code notification area for the duration of the analysis.

### Output Format

```
Count: 1234
Line: This exact message appeared 1234 times

Count: 567
Line: Another repeated message

Count: 89
Line: Less frequent message
```

### Use Cases

#### 1. **Error Analysis**
Find most common errors:
```
Count: 523
Line: ERROR: Connection timeout to database

Count: 342
Line: ERROR: Invalid API key
```

#### 2. **Performance Monitoring**
Identify repeated operations:
```
Count: 10234
Line: INFO: Cache hit for user_data

Count: 876
Line: INFO: Cache miss, fetching from DB
```

#### 3. **Security Analysis**
Detect repeated access patterns:
```
Count: 1523
Line: WARN: Failed login attempt from 192.168.1.100

Count: 234
Line: INFO: Successful login from 192.168.1.100
```

#### 4. **Debugging**
Find retry patterns:
```
Count: 45
Line: DEBUG: Retrying operation, attempt 1

Count: 23
Line: DEBUG: Retrying operation, attempt 2
```

### Best Practices

1. **Use with filtered logs**: Consider pre-filtering for specific log levels
2. **Look for anomalies**: Very high counts may indicate issues
3. **Compare time periods**: Run on different log sections to spot changes
4. **Combine with timeline**: Use timeline to see when peaks occurred

---

## HTML Gap Report

### Overview _(New in 3.6.2, Enhanced in 3.6.3)_
The HTML Gap Report provides comprehensive log analysis with two powerful features:
1. **Time Gap Analysis** - Identifies the top 10 longest time gaps between consecutive log entries
2. **Similar Lines Analysis** - Discovers the top 20 most frequently occurring log patterns _(New in 3.6.3)_

Together, these features help identify delays, timeouts, processing bottlenecks, repeated errors, and common operations in your log files.

### How It Works

**Time Gap Analysis:**
1. **Initialization**: Loads the log file and detects timestamp format automatically
2. **Indexing**: Builds a sparse index of line positions and timestamps
   - For large files (>10,000 lines): samples every 1000th line
   - For small files (<10,000 lines): samples every 10th line for precision
3. **Fast Pass**: Scans the in-memory index to find approximate top gaps
4. **Refinement**: Reads only relevant chunks from disk to pinpoint exact line and text

**Similar Lines Analysis:** _(New in 3.6.3)_
1. **Pattern Normalization**: Removes variable data (numbers, IDs, timestamps) from log lines
2. **High-Performance Scanning**: Uses ripgrep for fast pattern matching
   - Primary: System ripgrep (if available)
   - Fallback 1: VS Code's bundled ripgrep
   - Fallback 2: Node.js streaming method
3. **Pattern Aggregation**: Groups similar lines and counts occurrences
4. **Timestamp Tracking**: Records first and last occurrence of each pattern
5. **Ranking**: Displays top 20 patterns sorted by frequency

**Report Generation**: Creates interactive HTML with VS Code theme integration

### Accessing the Report

**Method 1: From Log Analysis View**
1. Select a log file in the Log Files tree view (single-click)
2. Navigate to the Log Analysis view
3. Click the **HTML Report** button (📊 graph-scatter icon) in the view toolbar
4. Wait for analysis (progress notifications displayed)
5. Report opens in a webview panel

**Method 2: From Active Editor**
- If no file is selected in the tree view, the command uses the currently active editor file

### Report Features

#### 1. **Interactive Visualization**
- Beautiful card-based layout for each gap
- Ranked list from longest to shortest gap
- Color-coded rank badges (1-10)
- Hover effects on gap cards
- VS Code theme integration (dark/light mode)

#### 2. **Metadata Section**
Displays key information about the analysis:
- **File Name**: Name of the analyzed log file
- **Total Records**: Number of timestamped entries found
- **Log Time Span**: Duration covered by the log (formatted as ms/s/m/h)
- **Gaps Analyzed**: Number of gaps found (up to 10)

#### 3. **Gap Details**
Each gap card shows:
- **Rank Badge**: Position in top 10 (circular numbered badge)
- **Duration**: Gap length formatted intelligently:
  - `123ms` for milliseconds
  - `45.23s` for seconds
  - `5m 30.2s` for minutes
  - `2h 15m` for hours
- **Line Number**: Where the gap-causing log entry occurs (1-based)
- **Timestamps**: Start and end times in ISO 8601 format
- **Log Text**: The actual log line that preceded the gap

#### 4. **Similar Lines Analysis** _(New in 3.6.3)_
Purple-themed section displaying the most frequently occurring log patterns:
- **Count Badge**: Number of times the pattern appears
- **Time Range**: First and last occurrence timestamps
- **Normalized Pattern**: Log line with variable data replaced by placeholders
  - Numbers replaced with `###`
  - Common ID patterns replaced with `[ID]`
  - Timestamps removed for better grouping
- **Smart Pattern Detection**: 
  - Groups lines with different numbers/IDs as the same pattern
  - Example: `User 123 logged in` and `User 456 logged in` → `User ### logged in` (2 occurrences)
- **Performance-Optimized**: Uses ripgrep for fast processing of large files

#### 5. **Export Capability**
- **Export HTML Button**: Located in the report header
- One-click export to standalone HTML file
- Opens save dialog with suggested filename (`logfile_gap_report.html`)
- Exported file works in any browser
- Perfect for sharing with team members or archiving

### Use Cases

#### 1. **Application Performance Analysis**
Identify slow operations or processing delays:
```
Gap Duration: 5m 32.1s
Line 1523: [2024-02-18 10:15:00] INFO Processing batch job 4523
→ [2024-02-18 10:20:32] INFO Batch job 4523 completed
```

#### 2. **Timeout Detection**
Find where connections or requests timed out:
```
Gap Duration: 30.05s
Line 892: [2024-02-18 08:30:15] DEBUG Sending request to external API
→ [2024-02-18 08:30:45] ERROR Request timeout after 30s
```

#### 3. **Service Downtime**
Detect periods when a service was not logging:
```
Gap Duration: 2h 15m
Line 3421: [2024-02-18 02:00:00] INFO System health check OK
→ [2024-02-18 04:15:00] WARN Service restarted
```

#### 4. **Monitoring Data Gaps**
Find missing data points in monitoring logs:
```
Gap Duration: 1m 30.0s
Line 7845: [2024-02-18 15:00:00] METRIC cpu_usage=45%
→ [2024-02-18 15:01:30] METRIC cpu_usage=78%
```

#### 5. **Queue Processing Analysis**
Identify bottlenecks in event or message processing:
```
Gap Duration: 45.89s
Line 2301: [2024-02-18 11:23:10] INFO Processing message ID 8823
→ [2024-02-18 11:24:56] INFO Message 8823 completed
```

#### 6. **Repeated Error Detection** _(New in 3.6.3)_
Find the most common errors or warnings:
```
Count: 347 occurrences
First: 2024-02-18 08:00:00 | Last: 2024-02-18 18:45:32
Pattern: ERROR Failed to connect to database pool ###
```

#### 7. **Common Operations Analysis** _(New in 3.6.3)_
Identify frequently performed actions:
```
Count: 1,523 occurrences
First: 2024-02-18 00:00:15 | Last: 2024-02-18 23:59:48
Pattern: INFO User [ID] logged in successfully
```

#### 8. **Problem Pattern Recognition** _(New in 3.6.3)_
Spot recurring issues that need attention:
```
Count: 89 occurrences
First: 2024-02-18 09:12:05 | Last: 2024-02-18 16:30:22
Pattern: WARN Retry attempt ### for request [ID]
```

### Technical Details

#### Smart Indexing (Time Gaps)
- **Large files**: Default step of 1000 lines for speed
- **Small files**: Automatic step of 10 lines for precision
- **Memory efficient**: Sparse index keeps memory usage low
- **Fast searches**: Binary search on indexed timestamps

#### Pattern Analysis (Similar Lines) _(New in 3.6.3)_
- **Three-tier ripgrep strategy**:
  1. Primary: System ripgrep (if installed and in PATH)
  2. Fallback 1: VS Code's bundled ripgrep (@vscode/ripgrep package)
  3. Fallback 2: Node.js streaming method (pure JavaScript, always works)
- **Normalization rules**:
  - Numbers: `\d+` → `###`
  - Common IDs: `[A-Fa-f0-9]{8,}` → `[ID]`
  - Timestamps: Removed using detected format regex
  - Special characters: Preserved for pattern accuracy
- **Performance**: Sub-second analysis on most files with ripgrep

#### Performance
- Initial indexing: O(n) where n = file size
- Gap finding: O(m log m) where m = number of indexed entries
- Refinement: Reads only ~10 small chunks from disk
- Similar lines: O(n) with ripgrep, cached in memory
- Typical analysis time: 1-5 seconds for multi-MB files

#### Supported Timestamp Formats
Uses the same auto-detection as other features:
- ISO 8601
- Apache/Common Log Format
- Syslog
- Log4j
- Windows Event Log
- And 15+ other common formats

### Best Practices

1. **Select appropriate files**: Works best with files that have consistent timestamps
2. **Check detection**: Ensure timestamps are detected (🟢 indicator in tree view)
3. **Export for sharing**: Use Export HTML to share findings with team
4. **Combine with timeline**: Use Timeline view to see overall patterns, then drill into gaps
5. **Look for patterns**: Multiple similar-duration gaps might indicate configuration issues
6. **Use Similar Lines for error tracking**: The pattern analysis helps identify recurring issues _(New in 3.6.3)_
7. **Install ripgrep for best performance**: While not required, ripgrep significantly speeds up pattern analysis _(New in 3.6.3)_

### Limitations

**Time Gap Analysis:**
- Requires timestamps to be detected in the log file
- Maximum of 10 gaps reported (top longest)
- Continuation lines without timestamps are not considered gap boundaries
- Gap analysis based on timestamp differences, not actual processing time

**Similar Lines Analysis:** _(New in 3.6.3)_
- Maximum of 20 patterns reported (top most frequent)
- Pattern normalization may group unrelated lines if they have similar structure
- Very large files (>100MB) may take longer to analyze without ripgrep
- Works on any log file, even without timestamps (timestamps are removed during normalization)

---

## Chunk Duration Statistics Report

### Overview _(New in 3.6.5)_
Computes full descriptive statistics over every inter-entry time gap in the sparse line index of a single log file, producing an interactive HTML report with histogram, outlier table, and min/max chunk cards.

### Key Features

1. **Full `DescriptiveStats` Suite**
   - Count, mean, median, min, max
   - Percentiles: P90, P95, P99
   - Standard deviation, skewness (with plain-English shape annotation), excess kurtosis (with shape annotation)

2. **Distribution Histogram**
   - 20-bin bar chart approximated via normal PDF centred on the mean
   - Visual sense of spread and modality

3. **Min & Max Chunk Cards**
   - Green-bordered card for the fastest chunk
   - Red-bordered card for the slowest chunk
   - Each card shows duration, timestamps, and the actual log line text

4. **Outlier Table**
   - Tukey IQR fences (1.5× multiplier) detect unusual gaps
   - Up to 25 outliers refined to exact line text from disk
   - Badge shows refined count vs total detected count
   - Columns: duration, line number, from/to timestamps, log text

5. **Export Capability**
   - One-click **Export HTML** button
   - Saves a fully standalone report file

### How to Use
1. Select a log file in the **Log Files** tree view (single-click), or have one open in the editor
2. Navigate to the **Log Analysis** view
3. Click the **Chunk Stats** (`$(pulse)`) icon in the Log Analysis view toolbar
4. Wait for analysis to complete
5. The report opens in a new webview panel
6. Click **Export HTML** to save as a standalone file

### Technical Details
- Re-indexes with step=10 for files smaller than 10,000 lines for extra precision
- Calls `LogFileHandler.buildLineIndex()` + `extractAllGapsFromIndex()` + `computeDescriptiveStats()` + `detectOutliers()`
- Min/max and each reported outlier are refined via `refineLargestGap()` (disk read of the surrounding chunk)
- Data injected as `window.REPORT_DATA` into the `logChunkStats.html` template

### Use Cases
- Understand the statistical shape of processing throughput
- Identify P99 tail latency for performance SLA analysis
- Spot skewed distributions that may indicate bursty activity
- Pin-point specific outlier entries for root-cause investigation

---

## Multi-File Chunk Statistics Comparison

### Overview _(New in 3.6.5)_
Analyses chunk-duration statistics for 2–20 log files simultaneously and presents them in a single interactive comparison report with natural-language summary, side-by-side statistics table, bar charts, and rankings.

### Key Features

1. **Natural Language Analysis Summary**
   Eight plain-English paragraphs automatically generated:
   - **Overview** — explains what a chunk is and how many files are compared
   - **Throughput** — fastest/slowest file by mean with ratio; median commentary
   - **Tail latency** — best/worst P99 across files
   - **Consistency** — CV (coefficient of variation) with categorical buckets: _highly consistent_ / _moderately consistent_ / _variable_ / _highly variable_
   - **Distribution shape** — skewness direction and magnitude per file
   - **Outlier density** — outlier count and percentage per file
   - **Worst-case single chunk** — flags severe gaps (>60 s, >5 s) with file name
   - **Overall verdict** — holistic assessment of relative performance

2. **Side-by-Side Statistics Table**
   - 16 metrics per file: count, mean, median, min, max, P90, P95, P99, std dev, skewness, kurtosis, outlier count, outlier %, CV %
   - **Green** highlighting for the best value in each row
   - **Red** highlighting for the worst value in each row

3. **Six Visual Bar Charts**
   - Mean chunk duration
   - Median chunk duration
   - P99 tail latency
   - Standard deviation
   - Coefficient of variation (%)
   - Outlier percentage
   - Each bar coloured with the file's assigned palette colour

4. **Six Ranking League Tables**
   - `byMean`, `byMedian`, `byP99`, `byStdDev`, `byCv`, `byOutlierPct`
   - Gold / silver / bronze medal CSS classes for top-3 positions

5. **Colour-Coded File Legend**
   - 20-colour palette auto-assigned per file
   - Colour swatch + filename shown in the legend header
   - Consistent colour used across all charts, tables, and rankings

6. **Error Reporting**
   - Files that fail analysis are listed separately with their error message
   - Comparison proceeds with the remaining valid files

### How to Use
1. In the **Log Files** tree view, hold **Ctrl** (Windows/Linux) or **Cmd** (macOS) and click to select 2–20 log files
2. Click the **Compare Chunk Stats** (`$(diff-multiple)`) icon in the Log Files toolbar,
   _or_ right-click any selected file → **Compare Chunk Statistics (multi-file)**
3. A progress notification tracks each file as it is analysed sequentially
4. The comparison report opens in a new webview panel
5. Click **Export HTML** to save a fully standalone file

### Technical Details
- Accepts 2–20 file paths; shows a warning if fewer than 2 are selected
- Each file analysed with `LogFileHandler` + `extractAllGapsFromIndex()` + `computeDescriptiveStats()` + `detectOutliers()`
- CV = `stdDev / mean × 100`; CV buckets: <15 highly consistent, 15-30 moderately consistent, 30-60 variable, >60 highly variable
- Data injected as `window.COMPARISON_DATA` into `logChunkStatsComparison.html`
- `canSelectMany: true` is set on the Log Files tree view to enable multi-selection

### Use Cases
- Compare log throughput across different environments (dev / staging / prod)
- A/B compare before and after a performance optimisation
- Identify which service instance has the most erratic latency
- Benchmark processing speed across different application versions

---

## JSONL / NDJSON Support

_(New in 3.6.7)_

### Overview
Acacia Log recognises `.jsonl` and `.ndjson` files (JSON Lines / Newline-Delimited JSON) alongside traditional plain-text log files. A built-in converter turns structured JSONL files into plain-text log files so every existing analysis feature (gap reports, chunk statistics, timeline, similar lines, pattern search, date navigation) works on them without modification.

### Automatic File Discovery
- `.jsonl` and `.ndjson` files appear in the **Log Files** tree automatically
- Included in all file-type filter options (Filter by File Type dialog)
- Treated identically to `.log` files for all tree actions (open, reveal, file info, context menu)

### Convert JSONL to Log Command

**Access:**
- `$(file-code)` icon in the **Log Analysis** panel toolbar (`navigation@8`)
- Right-click any file in the **Log Files** tree → **Convert JSONL to Log**

**4-Step Field Mapping Wizard:**

1. **Timestamp field** — pick the JSON key holding the timestamp (e.g. `timestamp`, `time`, `ts`, `@timestamp`)
2. **Log level field** — pick the severity key (e.g. `level`, `severity`, `lvl`) or skip
3. **Message field** — pick the primary message key (e.g. `message`, `msg`, `text`) or skip
4. **Extra fields** — multi-select any additional keys to append (e.g. `service`, `trace_id`)

**Smart Field Detection:**
- Scans the first 50 lines of the file and collects every JSON key, sorted by occurrence frequency
- Automatically highlights recommended fields for each role based on common naming conventions
- Works with deeply nested keys if the value is a primitive

**Output Format:**
```
2026-02-21T10:00:00Z [ERROR] Connection timeout service=api trace_id=abc123
```
- Each JSONL line becomes one plain-text log line
- Non-JSON lines are passed through unchanged
- The output file is written as a sibling with a `.log` extension (e.g. `app.jsonl` → `app.log`)
- Prompts before overwriting an existing file
- Progress notification shown for large files
- Offers to open the resulting file on completion

### Typical Workflow
1. Add the folder containing your `.jsonl` files via **Add Log Folder** in the Log Files tree
2. Select the `.jsonl` file and right-click → **Convert JSONL to Log**
3. Complete the 4-step wizard
4. The new `.log` file appears in the tree; use any Acacia Log analysis feature on it

---

## UI Components

### Collapsible Sections

All panels feature collapsible sections:
- Click header to expand/collapse
- Arrow indicator shows state
- Saves screen space
- Remembers state per session

### Help Tooltips

Click **?** icons for help:
- Context-sensitive information
- Usage hints
- Format examples
- Toggle visibility

### Status Messages

Color-coded feedback:
- 🟢 **Success** (Green): Operation completed
- 🔴 **Error** (Red): Something went wrong
- 🔵 **Info** (Blue): General information
- Auto-dismiss after 3-5 seconds

### Loading States

During operations:
- Button shows spinner
- "Processing..." text
- Button disabled
- Clear visual feedback

### Form Validation

Before submission:
- Checks required fields
- Shows error if missing
- Prevents invalid operations
- Clear error messages

### Theme Integration

Respects VS Code themes:
- Colors from active theme
- Dark/light mode support
- High contrast compatible
- Accessible color schemes

---

## Advanced Usage

### Custom Date Formats

**Example 1: Custom Timestamp**
```
Log format: [2024.01.15-10:30:45.123]
Regex: \[\d{4}\.\d{2}\.\d{2}-\d{2}:\d{2}:\d{2}\.\d{3}\]
Format: [yyyy.MM.dd-HH:mm:ss.SSS]
```

**Example 2: Relative Times**
```
Log format: +00:05:30 Message here
Regex: \+\d{2}:\d{2}:\d{2}
Format: +HH:mm:ss
```

### Complex Pattern Searches

**Example 1: Multi-condition Error**
```json
{
  "key": "Critical Business Logic Errors",
  "regexp": "(ERROR|FATAL).*(?=.*business)(?=.*logic)",
  "regexpoptions": "gi"
}
```

**Example 2: Time-based Pattern**
```json
{
  "key": "After Hours Access",
  "regexp": "(1[89]|2[0-3]):\\d{2}:\\d{2}.*access",
  "regexpoptions": "g"
}
```

### Workflow Integration

#### Daily Log Review
1. Open today's log
2. Run timeline to see activity
3. Run similar lines to find issues
4. Use pattern search for specific checks

#### Incident Investigation
1. Navigate to incident time
2. Generate timeline around that period
3. Search for error patterns
4. Analyze similar occurrences

#### Performance Analysis
1. Compare timelines from different days
2. Export CSV data
3. Identify bottleneck times
4. Search for specific operations

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Enter (in any input) |
| Zoom In | Mouse Wheel Up |
| Zoom Out | Mouse Wheel Down |
| Pan | Click & Drag |
| Reset Zoom | Reset button |

### Performance Optimization

For large files:
- Use specific regex patterns (avoid .*)
- Limit pattern file to necessary patterns
- Close other resource-heavy applications
- Consider splitting very large logs

---

## Tips for Maximum Productivity

1. **Create Pattern Libraries**: Build JSON files for common investigations
2. **Bookmark Presets**: Save frequently used date formats
3. **Use Quick Actions**: Leverage Today/Now buttons
4. **Export Regularly**: Keep CSV data for trend analysis
5. **Combine Features**: Use timeline → click → navigate → pattern search workflow
6. **Learn Regex**: Invest time in regex for powerful patterns
7. **Theme Matching**: Extension adapts to your theme automatically

---

## Common Workflows

### 1. Error Investigation
```
Timeline → Identify spike → Click spike → Navigate to log → Pattern search for errors
```

### 2. Performance Monitoring
```
Similar lines → Identify frequent operations → Timeline → Analyze distribution
```

### 3. Security Audit
```
Pattern search (auth patterns) → Analyze results → Timeline (failures) → Export report
```

### 4. Deployment Verification
```
Navigate to deployment time → Timeline around period → Similar lines for errors → Export
```

---

*This guide is continuously updated. For the latest features, see the [README](README.md).*
