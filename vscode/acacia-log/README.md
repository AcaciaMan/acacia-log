# Acacia Log 📊

> **Professional log file analysis and visualization for VS Code**

[![Version](https://img.shields.io/badge/version-2.1.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=manacacia.acacia-log)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)

Acacia Log is a powerful Visual Studio Code extension designed to make log file analysis effortless. Navigate through massive log files with precision, visualize patterns, and gain insights from your logs—all within your favorite editor.

![Acacia Log Banner](log_icon.png)

---

## ✨ Key Features

### 🎯 **Precise Date/Time Navigation**
Jump directly to any timestamp in your log files with intelligent date parsing and format detection.

### 📊 **Interactive Timeline Visualization**
Transform your logs into beautiful, interactive charts that reveal patterns and anomalies at a glance.

### 🔍 **Pattern-Based Search**
Search for multiple patterns simultaneously across large log files with visual results and statistical analysis.

### 📈 **Similar Line Analysis**
Identify repetitive patterns and group similar log entries to understand what's happening most frequently.

### 🎨 **Modern UI**
Beautifully designed interface that respects VS Code themes and provides an intuitive user experience.

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
3. Choose your operation:
   - **Process current log file** - Navigate and analyze the active log
   - **Search for patterns** - Find patterns across multiple log files

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

## 📄 License

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







