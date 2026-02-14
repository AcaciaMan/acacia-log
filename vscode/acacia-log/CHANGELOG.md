# Change Log

All notable changes to the "acacia-log" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

### Enhanced
- Improved sidebar organization with tree view at the top
- Better log file discovery across workspace and custom folders

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