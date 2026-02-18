# Change Log

All notable changes to the "acacia-log" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [3.6.2] - 2026-02-18

### Added
- 📊 **HTML Gap Report** - Interactive gap analysis with export capability
  - Analyzes top 10 time gaps in log files
  - Beautiful HTML report with VS Code theme integration
  - Shows gap duration, timestamps, and log line text
  - One-click export to standalone HTML file
  - Accessible via toolbar button in Log Analysis view
  - Smart indexing: automatically uses finer granularity for small files (<10,000 lines)
  - Progress notifications during analysis
  - Rendered in webview panel for interactive viewing

---

## [3.6.1] - 2026-02-18

### Enhanced
- 🎨 **Native Toolbar Navigation** - Tab controls moved to VS Code view title bar
  - 5 toolbar buttons for quick navigation: Log Analysis, Similar Lines, Timeline, Pattern Search, File Info
  - Integrated with VS Code's native toolbar system
  - Removed duplicate internal tab navigation for cleaner interface
  - Standard VS Code icons for better integration

- 📐 **Compact View Mode** - Reduced padding and spacing throughout
  - Optimized tab content padding (16px → 8px)
  - Reduced section padding and margins for more visible data
  - Smaller input fields, buttons, and form elements
  - Compressed info boxes and status messages
  - Tighter table cells in File Info tab
  - Chart containers optimized (350px → 300px height)
  - Overall 30-40% space savings for more data visibility in sidebar

---

## [3.6.0] - 2026-02-17

### Added
- 🤖 **Automatic Timestamp Detection** - Intelligent pattern recognition for log files
  - Detects 20+ timestamp formats automatically (ISO, dash/slash/dot separators, with/without seconds)
  - Visual indicators in Log Tree View: 🟢 green circle (detected) / 🔴 red circle (not detected)
  - Displays detected pattern and total line count in file tooltips
  - 5-minute caching to prevent repeated detection operations
  - Supports archived logs with dates outside file date range
  - Validates reasonable year ranges (1970-2076)

- 🔘 **Auto-Detect Buttons** - One-click timestamp configuration across all tabs
  - Log Analysis tab: Auto-detect button populates regex and format fields
  - Similar Lines tab: Auto-detect button for pattern configuration
  - Timeline tab: Auto-detect button for timeline generation
  - Real-time status feedback with success/error indicators
  - Automatically fills all timestamp fields across tabs

### Enhanced
- 📊 **File Info Tab** - Optimized for performance
  - Removed lengthy statistics calculations for large files
  - Shows timestamp detection results with pattern details
  - Displays format display string for detected patterns
  - Instant loading with only basic file metadata (size, dates)

- 🎯 **Smart Pattern Integration** - Auto-detected patterns used throughout
  - Similar Lines analysis uses detected patterns automatically
  - Timeline generation leverages auto-detection with user notification
  - Navigate to DateTime feature uses detected formats
  - Falls back to configuration if detection fails

### Fixed
- Timestamp detection now works correctly for archived logs (10+ years old)
- Simple timestamp formats (yyyy-MM-dd HH:mm:ss.SSS) now detected properly
- Added support for dash-separated dates without seconds (dd-MM-yyyy HH:mm, MM-dd-yyyy HH:mm)
- Added support for HH:mm formats with slash and dot separators

---

## [3.5.0] - 2026-02-16

### Added
- 📋 **File Info Tab** - New 5th tab in the unified view for file metadata
  - Displays comprehensive file information: name, path, size, line count
  - Shows creation, modification, and last access dates
  - Displays error and warning counts for quick overview
  - Convenient actions: Open File in Editor, Reveal in Explorer
  - Accessible from Log Tree View with single-click

### Enhanced
- 🖱️ **Smart Click Detection in Log Tree View**
  - Single-click: Shows File Info tab without opening the file
  - Double-click: Opens file in editor
  - Prevents accidental opening of large log files (performance improvement)
  - Proper double-click detection with 300ms threshold
  - Better user experience when browsing large log collections

---

## [3.4.0] - 2026-02-16

### Added
- 📑 **Expanded Tabbed Interface** - Now with 4 dedicated tabs for better organization
  - Tab 1: Log Analysis (date/time navigation)
  - Tab 2: Pattern Search (multi-pattern search)
  - Tab 3: Similar Lines (analyze repetitive patterns)
  - Tab 4: Timeline (visual timeline generation)
- 🎯 **Icon-Only Tab Navigation** - Cleaner, more compact tab design
  - Tabs show only icons to save space
  - Hover over tabs to see descriptive tooltips
  - Larger icons (18px) for better visibility
- 📊 **Similar Lines Results in Editor** - Improved result viewing
  - Similar lines results now open in dedicated editor result tab
  - Consistent with pattern search results behavior
  - Better use of screen space for analysis

### Enhanced
- Separated Similar Lines and Timeline features into dedicated tabs
- Each tab now has its own configuration section
- Improved UI consistency across all analysis tools
- Better organization of features for easier discoverability

---

## [3.2.0] - 2026-02-14

### Added
- 📁 **Log Tree View** - New hierarchical file/folder management interface
  - Automatic detection of log files (`.log`, `.txt`, `.out`, `.err`, `.trace`)
  - Add and manage custom log folders that persist across sessions
  - Rich metadata display: file size, line count, error/warning counts
  - Context menu actions: Open file, Reveal in Explorer, Remove folder
  - Auto-refresh with file system watchers
  - Performance optimized for large files
  - Tooltips with detailed file statistics
- 📑 **Unified Tabbed Webview** - Single compact interface for all analysis tools
  - Tab 1: Log Analysis (date/time navigation, similar lines, timeline)
  - Tab 2: Pattern Search (multi-pattern search configuration)
  - Cleaner sidebar with less clutter
- 📊 **Editor Tab Results** - Pattern search results open in editor tabs
  - JSON formatted results in dedicated editor tabs
  - Leverages full editor space for better readability
  - Syntax highlighting and search capability

### Enhanced
- Improved sidebar organization: tree view + compact tabbed controls
- Better screen space usage: sidebar for controls, editor for results
- Pattern search results display in editor with full JSON formatting

---

## [2.1.1] - 2025-10-05

### 🎉 Major UI/UX Overhaul

#### Added
- ✨ **Completely redesigned user interface** with modern, professional styling
- 📊 **Interactive Timeline Visualization** with multiple chart types (Bar, Area, Line)
- 🎨 **Dual view modes** for timeline: Total view and Stacked by log level
- 🔍 **Interactive zoom and pan** functionality for timeline charts
- 🖱️ **Click-to-navigate** feature - click chart data points to jump to log lines
- 💾 **CSV export** functionality for timeline data
- 🎯 **Automatic log level detection** (ERROR, WARN, INFO, DEBUG)
- 📈 **Statistical dashboard** showing total entries, time buckets, averages
- 📁 **Native file picker integration** with browse buttons
- 🎨 **Multiple chart types** for pattern search (Pie, Bar, Doughnut)
- ⌨️ **Keyboard shortcuts** - Press Enter to search
- 💡 **Help tooltips** with context-sensitive information
- 🚀 **Quick action buttons** (Today, Now, Clear) for date/time navigation
- 📋 **Collapsible sections** to save screen space
- ✅ **File path validation** with visual feedback
- 🔄 **Loading states** with spinner animations
- 📊 **Results summary** showing pattern/match counts
- 🎭 **Theme-aware colors** that adapt to VS Code themes

#### Enhanced
- 🎯 **Date/Time Navigation** - Complete redesign with preset formats
  - 11 common log format presets
  - Emoji icons for visual identification
  - Better form validation
  - Improved error handling
- 🔎 **Pattern Search** - Visual overhaul with interactive features
  - Card-based result display
  - Expandable line number lists
  - Real-time chart updates
  - Better file selection UX
- 📊 **Timeline Generation** - Complete rewrite
  - Fixed: Now shows actual log volume instead of cumulative index
  - Added: Multiple visualization options
  - Added: Stacked view by log level with color coding
  - Added: Interactive zoom/pan capabilities
  - Added: Click to navigate to specific log lines
  - Added: Smart aggregation algorithm
  - Added: Comprehensive statistics
- 🎨 **Visual Design** - Modern, cohesive interface
  - VS Code native theme integration
  - Consistent design language across all panels
  - Better spacing and typography
  - Smooth transitions and animations
  - Responsive layouts for different panel sizes

#### Improved
- ⚡ **Performance** - Optimized data processing and chart rendering
- 🐛 **Error Handling** - Better error messages and recovery
- ♿ **Accessibility** - ARIA labels, keyboard navigation, high contrast support
- 📱 **Responsiveness** - Better layout on smaller panels
- 🔧 **Configuration** - Persistent settings across sessions
- 📝 **Documentation** - Comprehensive README and FEATURES guide

#### Fixed
- 🐛 Timeline showing incorrect data (cumulative index vs actual counts)
- 🐛 Missing feedback during long operations
- 🐛 Theme colors not adapting properly
- 🐛 Chart not properly updating on view changes
- 🐛 File path validation issues

### Technical Details
- **Dependencies Updated**:
  - Chart.js upgraded to 4.4.0
  - Added chartjs-adapter-date-fns 3.0.0
  - Added chartjs-plugin-zoom 2.0.1
- **New Interfaces**: TimelineEntry, AggregatedData for type safety
- **Improved Architecture**: Better separation of concerns, cleaner code
- **Better TypeScript**: Enhanced type definitions and error handling

### Breaking Changes
None - All changes are additive and backward compatible.

### Migration Guide
No migration needed. All existing configurations and workflows continue to work.

---

## [2.0.0] - Previous Version

### Added
- Initial sidebar panel implementation
- Basic timeline visualization
- Pattern-based search functionality
- Similar line counting feature
- Date/time navigation commands

### Features
- Navigate to specific date and time in log files
- Set log date formats and regex patterns
- Calculate counts of similar lines
- Draw timeline chart of log records
- Search for patterns using JSON configuration

---

## [1.0.0] - Initial Release

### Added
- Command-based log navigation
- Basic date format configuration
- Regular expression matching for timestamps
- Simple search functionality

---

## Future Enhancements

Ideas for upcoming versions:

### Planned Features
- 🔄 Real-time log monitoring with watch mode
- 📚 Pattern template library for common formats
- 🎨 Custom color scheme preferences
- 🖼️ Export charts as PNG/SVG images
- 📁 Multi-file log analysis and comparison
- 🔔 Anomaly detection and alerting
- 📊 Performance metrics dashboard
- 🔍 Advanced filtering (by log level, time range)
- 💾 Save/load search configurations
- 🌐 Remote log file support
- 🤖 AI-powered log analysis suggestions
- 📱 Better mobile/tablet support
- 🔌 Plugin system for custom parsers

### Community Requests
See [GitHub Issues](https://github.com/AcaciaMan/acacia-log/issues) for feature requests and vote on your favorites!

---

## Version History Summary

| Version | Release Date | Highlights |
|---------|--------------|------------|
| 2.1.1 | 2025-10-05 | Major UI/UX overhaul, interactive charts, enhanced features |
| 2.0.0 | - | Sidebar panels, pattern search, basic timeline |
| 1.0.0 | - | Initial release with command-based navigation |

---

For detailed feature documentation, see [FEATURES.md](FEATURES.md).  
For usage examples and tips, see [README.md](README.md).