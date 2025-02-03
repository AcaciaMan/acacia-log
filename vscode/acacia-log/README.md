# acacia-log README

Acacia Log is a Visual Studio Code extension for navigating log files efficiently. It provides commands to set log date formats, regular expressions, and search for specific dates and times in log files.

## Features

- Navigate to a specific date and time in the log file.
- Set the date format used in the log files.
- Set the regular expression to match the date in the log files.
- Set the date to search for in the log files.
- Set the time to search for in the log files.
- Calculate counts of similar lines in the log file.
- Draw a timeline chart of log file records.

Added command calls through activity bar:

![Screenshot 2025-02-01 151004](https://github.com/user-attachments/assets/a13cf7f0-a801-4ccc-a39b-ca9e8881db8f)

Added patterns search in log file:

![Screenshot 2025-02-02 063654](https://github.com/user-attachments/assets/dc92f595-09ec-426c-9c4a-2b20267c18c4)

Added Pie Bar drawing:

![Screenshot 2025-02-03 045749](https://github.com/user-attachments/assets/a2d28974-9f11-436e-a1d3-2703b702038a)

![Extension Screenshot](https://github.com/user-attachments/assets/f9987ce4-6f63-4fe8-bafe-9d2c1738caef)

## Commands

This extension contributes the following commands:

- `extension.setLogDateFormat`: Sets the date format used in the log files.
- `extension.setLogDateRegex`: Sets the regular expression to match the date in the log files.
- `extension.setLogSearchDate`: Sets the date to search for in the log files (YYYY-MM-DD).
- `extension.setLogSearchTime`: Sets the time to search for in the log files and RUNS the search.
- `extension.calculateSimilarLineCounts`: Calculates counts of similar lines in the log file and displays them in descending order.
- `extension.drawLogTimeline`: Draws a chart containing a timeline of log file records.

## Extension Settings

This extension contributes the following settings:

- `acacia-log.logDateFormat`: The date format used in the log files. Default is `yyyy-MM-dd HH:mm:ss`.
- `acacia-log.logDateRegex`: The regular expression to match the date in the log files. Default is `\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}`.
- `acacia-log.logSearchDate`: The date to search for in the log files (YYYY-MM-DD).
- `acacia-log.logSearchTime`: The time to search for in the log files (HH:mm:ss).

## Requirements

There are no specific requirements or dependencies for this extension.

## Known Issues

There are no known issues at this time. Please report any issues you encounter on the [GitHub issues page](https://github.com/AcaciaMan/acacia-log/issues).

## Release Notes

### 1.0.0

- Initial release of Acacia Log.
- Added commands to navigate to a specific date and time in the log file.
- Added commands to set log date format, log date regular expression, log search date, and log search time.

### 0.0.2

- Added command to calculate counts of similar lines in the log file and display them in descending order.
- Added command to draw a timeline chart of log file records.

### 2.0.3

- Speed up Patterns search

### 2.0.4

- Fixed Patterns search

### 2.0.5s

- Fixed Draw Time Line

---

## Following extension guidelines

Ensure that your extension follows the [Visual Studio Code extension guidelines](https://code.visualstudio.com/api/references/extension-guidelines) to provide the best experience for users.