# Acacia Log - Quick Start Guide

Welcome to Acacia Log! This guide will get you up and running in under 5 minutes.

## 📦 Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for "Acacia Log"
4. Click **Install**

Or use Quick Open:
- Press `Ctrl+P` (or `Cmd+P` on Mac)
- Type: `ext install manacacia.acacia-log`
- Press Enter

## 🚀 First Steps

### 1. Open the Acacia Log Panel

Look for the 📊 Acacia Log icon in the Activity Bar (left sidebar) and click it.

You'll see two panels:
- **Process current log file** - For analyzing the currently open log
- **Search for patterns** - For searching across log files

### 2. Open a Log File

Open any log file in VS Code. Examples:
- `application.log`
- `server.log`
- `access.log`
- Any `.log` or `.txt` file with timestamps

## 🎯 Common Tasks

### Task 1: Navigate to a Specific Time

**Scenario**: Jump to logs from 2:30 PM yesterday

1. Open your log file
2. Click on "Process current log file" panel
3. In the "Search Criteria" section:
   - Click **📅 Today** button
   - Enter time: `14:30:00`
4. Press **Enter** or click "Navigate to Date & Time"

**Result**: Editor jumps to that timestamp!

---

### Task 2: Visualize Log Activity

**Scenario**: See when your application was busiest

1. Open your log file
2. In the sidebar panel, click **📈 Timeline** button
3. A new panel opens showing an interactive chart

**Try these**:
- Click **📊 Bar** / **📈 Area** / **📉 Line** to change chart type
- Click **By Level** to see ERROR/WARN/INFO/DEBUG breakdown
- Scroll mouse wheel to zoom
- Click any bar to jump to that time in the log
- Click **💾 Export CSV** to save the data

---

### Task 3: Find Error Patterns

**Scenario**: Count how many different errors occurred

1. Open your log file
2. Click **📊 Similar Lines** button in the panel
3. A new editor opens showing repeated lines sorted by count

**Example output**:
```
Count: 523
Line: ERROR: Connection timeout to database

Count: 342
Line: ERROR: Invalid API key
```

---

### Task 4: Search for Multiple Patterns

**Scenario**: Find all HTTP errors and authentication failures

1. Create a file called `patterns.json`:
```json
[
  {
    "key": "HTTP Errors",
    "regexp": "HTTP [45]\\d{2}",
    "regexpoptions": "g"
  },
  {
    "key": "Auth Failures",
    "regexp": "authentication.*failed|login.*error",
    "regexpoptions": "gi"
  }
]
```

2. Open "Search for patterns" panel
3. Click 📁 next to "Log File Path" and select your log
4. Click 📁 next to "Patterns File Path" and select `patterns.json`
5. Click **🔍 Search Patterns**

**Result**: 
- Interactive chart showing distribution
- Result cards with line numbers
- JSON editor with detailed matches

---

## 💡 Pro Tips

### Tip 1: Use Presets
Don't remember your log format? Use a preset!
1. In "Log Format Configuration" section
2. Click the dropdown under "Date/Time Regex Pattern"
3. Select your format (e.g., "📅 Standard")
4. Both regex and format string are set automatically

### Tip 2: Keyboard Shortcuts
- Press **Enter** in any input field to search immediately
- No need to click buttons!

### Tip 3: Quick Date Selection
- Click **📅 Today** to set current date
- Click **🕐 Now** to set current time
- Click **✖️ Clear** to reset both

### Tip 4: Collapsible Sections
- Click section headers to collapse/expand
- Saves space when you know your settings

### Tip 5: Help Tooltips
- Click **?** icons for context help
- No need to leave VS Code for documentation

## 🎨 Customization

### Change Default Date Format

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "Acacia Log"
3. Modify:
   - `acacia-log.logDateFormat`: Your format string
   - `acacia-log.logDateRegex`: Your regex pattern

### Example Settings

For Apache logs:
```json
{
  "acacia-log.logDateFormat": "dd/MMM/yyyy:HH:mm:ss Z",
  "acacia-log.logDateRegex": "\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2} [+-]\\d{4}"
}
```

## 🔧 Troubleshooting

### Timeline Shows "No valid timestamps found"
**Fix**: Check your date format matches your log file
1. Look at a timestamp in your log: `2024-01-15 10:30:45`
2. Set regex: `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`
3. Set format: `yyyy-MM-dd HH:mm:ss`

### Navigation Doesn't Work
**Fix**: Ensure the date/time exists in your log
1. Try navigating to a time you know exists
2. Check format string matches regex pattern
3. Try a preset format first

### Pattern Search Returns Nothing
**Fix**: Test your regex
1. Start with simple patterns (e.g., `ERROR`)
2. Add complexity gradually
3. Check `regexpoptions` (usually `gi` for global, case-insensitive)

## 📚 Next Steps

Now that you know the basics:

1. **Read the full [README](README.md)** for comprehensive documentation
2. **Check [FEATURES](FEATURES.md)** for advanced usage
3. **See [CHANGELOG](CHANGELOG.md)** for latest updates
4. **Star on [GitHub](https://github.com/AcaciaMan/acacia-log)** if you find it useful!

## 🤝 Getting Help

- **Issues**: [GitHub Issues](https://github.com/AcaciaMan/acacia-log/issues)
- **Features**: [Request a feature](https://github.com/AcaciaMan/acacia-log/issues/new)
- **Bugs**: [Report a bug](https://github.com/AcaciaMan/acacia-log/issues/new)

## 🎓 Learning Resources

### Regular Expressions
- [Regex101](https://regex101.com/) - Test your patterns
- [RegExr](https://regexr.com/) - Learn regex interactively

### Date Formats
- [Luxon Tokens](https://moment.github.io/luxon/#/formatting) - Format string reference

## ⭐ Example Workflows

### Morning Log Review
```
1. Open yesterday's log
2. Click "Timeline" → See activity overnight
3. Click "Similar Lines" → Find repeated issues
4. Note any unusual patterns
```

### Incident Investigation
```
1. Navigate to incident time
2. Generate timeline around that period
3. Switch to "By Level" view
4. Look for ERROR spikes
5. Click spike → Navigate to error
6. Use pattern search for similar errors
```

### Weekly Report
```
1. Open week's logs
2. Generate timeline
3. Export to CSV
4. Create pattern searches for:
   - Errors
   - Performance issues
   - User activity
5. Compile statistics
```

---

## 🎉 You're Ready!

You now know how to:
- ✅ Navigate to specific timestamps
- ✅ Visualize log activity
- ✅ Find similar lines
- ✅ Search for patterns
- ✅ Customize settings

**Start analyzing your logs now!** 📊

---

*Need more help? Check the [full documentation](README.md) or [open an issue](https://github.com/AcaciaMan/acacia-log/issues).*
