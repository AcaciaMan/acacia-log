# Acacia Log - Detailed Features Guide

## Table of Contents
- [Date/Time Navigation](#datetime-navigation)
- [Timeline Visualization](#timeline-visualization)
- [Pattern Search](#pattern-search)
- [Similar Line Analysis](#similar-line-analysis)
- [UI Components](#ui-components)
- [Advanced Usage](#advanced-usage)

---

## Date/Time Navigation

### Overview
Navigate to any timestamp in your log files with precision. The extension supports multiple date/time formats and provides an intuitive interface for quick searches.

### Key Features

#### 1. **Format Configuration**
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
- Results in two formats:
  1. Visual webview with charts
  2. JSON editor with detailed line matches

#### Results Display

**Interactive Cards**:
- Pattern name (color-coded)
- Match count (bold, green)
- Line numbers (first 5 shown)
- "Show all" toggle for complete lists
- Hover effects for interactivity

**Results Summary**:
- Pattern count
- Total matches across all patterns

#### Chart Visualization

**Three Chart Types**:
- 🥧 **Pie Chart**: Shows proportion of each pattern
- 📊 **Bar Chart**: Compares counts side by side
- 🍩 **Doughnut Chart**: Like pie with center cutout

**Features**:
- One-click switching between types
- Theme-aware colors
- Interactive legend
- Hover tooltips with counts
- Proper legend positioning

#### JSON Results

Separate editor opens with:
```json
{
  "Pattern Name": {
    "count": 42,
    "line_match": [
      "123: Actual log line content",
      "456: Another matching line"
    ]
  }
}
```

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

### How It Works

1. Reads all lines from active log file
2. Groups identical lines together
3. Counts occurrences
4. Sorts by frequency (descending)
5. Displays in new editor

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
