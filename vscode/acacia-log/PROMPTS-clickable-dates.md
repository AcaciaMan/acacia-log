# Prompts: Clickable Dates → Navigate to Log Line

These prompts implement the feature where dates/timestamps shown in HTML report
webviews can be clicked to jump to the corresponding line in the source log file.

All four views follow the same pattern:
1. Embed `filePath` in the JSON data injected into the webview.
2. Wrap each displayed date in a `<span class="nav-date">` with `data-file` and
   `data-line` attributes.
3. Add a click handler that calls `vscode.postMessage({ command: 'navigateToLine', … })`.
4. In the TypeScript provider, handle the `navigateToLine` message by opening the
   file and revealing the requested line.

---

## Prompt 1 — Gap Report (logGapReportProvider.ts + logGapReport.html)

```
Context
-------
File: src/logSearch/logGapReportProvider.ts
File: resources/logGapReport.html

The Gap Report webview panel already receives a `window.REPORT_DATA` object that
contains `gaps[]`, where every gap has:
  • gap.line           – 1-based line number of the start of the gap
  • gap.timestamp      – ISO string (start of gap)
  • gap.nextTimestamp  – ISO string (end of gap)

Task
----
1. In `logGapReportProvider.ts → generateHtmlContent()`, add `filePath` to the
   `reportData` object that is serialised into the page:

       filePath: filePath,   // absolute path of the log file being analysed

2. In `logGapReportProvider.ts → openHtmlReport()`, extend the
   `onDidReceiveMessage` handler to handle a new message command:

       case 'navigateToLine': {
           const uri  = vscode.Uri.file(message.filePath);
           const line = Math.max(0, (message.line as number) - 1); // 0-based
           const doc  = await vscode.workspace.openTextDocument(uri);
           const editor = await vscode.window.showTextDocument(doc, {
               viewColumn: vscode.ViewColumn.One,
               preview: false
           });
           const pos = new vscode.Position(line, 0);
           editor.selection = new vscode.Selection(pos, pos);
           editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
           break;
       }

3. In `resources/logGapReport.html`, add a CSS class for clickable dates:

       .nav-date {
           cursor: pointer;
           color: var(--vscode-textLink-foreground);
           text-decoration: underline dotted;
       }
       .nav-date:hover { text-decoration: underline; }

4. In the same HTML file, acquire the VS Code API at the top of the <script>
   block (before the IIFE), and add a delegated click listener:

       const vscode = acquireVsCodeApi();

       document.addEventListener('click', e => {
           const el = e.target.closest('.nav-date');
           if (!el) return;
           vscode.postMessage({
               command: 'navigateToLine',
               filePath: el.dataset.file,
               line: parseInt(el.dataset.line, 10)
           });
       });

5. Inside the IIFE where each gap card is rendered (in the `data.gaps.forEach`
   block), replace the plain text timestamp display with clickable spans.
   The "From" timestamp corresponds to `gap.line` (the gap starts at that line):

       <strong>From:</strong>
       <span class="nav-date"
             data-file="${escapeAttr(data.filePath)}"
             data-line="${gap.line}">
         ${escapeHtml(gap.timestamp)}
       </span>

   For the "To" timestamp there is no separate stored line number; omit the
   nav-date class (or navigate to gap.line + 1 if you want a best-effort jump).

6. Similarly, in the Similar Lines section, the `line.firstTimestamp` and
   `line.lastTimestamp` dates do NOT have line numbers, so leave them as plain
   text unless the similar-lines analyser is extended later.

Helper to escape HTML attribute values (add near `escapeHtml`):
       function escapeAttr(s) { return (s || '').replace(/"/g, '&quot;'); }
```

---

## Prompt 2 — Chunk Statistics (logChunkStatsProvider.ts + logChunkStats.html)

```
Context
-------
File: src/logSearch/logChunkStatsProvider.ts
File: resources/logChunkStats.html

The Chunk Stats webview already has `window.REPORT_DATA` whose shape includes:
  • data.minChunk / data.maxChunk – each has: line, timestamp, nextTimestamp, text
  • data.outliers[]               – same shape as minChunk/maxChunk

Task
----
1. In `logChunkStatsProvider.ts → buildHtmlReport()`, add `filePath` to
   `reportData`:

       filePath: filePath,

2. In `logChunkStatsProvider.ts → openReportPanel()`, extend the
   `onDidReceiveMessage` handler with:

       case 'navigateToLine': {
           const uri  = vscode.Uri.file(message.filePath);
           const line = Math.max(0, (message.line as number) - 1);
           const doc  = await vscode.workspace.openTextDocument(uri);
           const editor = await vscode.window.showTextDocument(doc, {
               viewColumn: vscode.ViewColumn.One,
               preview: false
           });
           const pos = new vscode.Position(line, 0);
           editor.selection = new vscode.Selection(pos, pos);
           editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
           break;
       }

3. In `resources/logChunkStats.html`, add the same CSS class and delegated
   click listener as described in Prompt 1 (items 3 & 4).

4. In the `renderChunk(prefix, chunk)` function, change the "From" and "To"
   detail lines from plain `textContent` assignment to innerHTML with clickable
   spans:

       function renderChunk(prefix, chunk) {
           if (!chunk) return;
           document.getElementById(prefix + 'Duration').textContent = chunk.duration;
           document.getElementById(prefix + 'Line').textContent     = 'Line: ' + chunk.line.toLocaleString();
           document.getElementById(prefix + 'From').innerHTML =
               'From: <span class="nav-date" data-file="' + escapeAttr(data.filePath) +
               '" data-line="' + chunk.line + '">' + fmtDate(chunk.timestamp) + '</span>';
           document.getElementById(prefix + 'To').textContent =
               'To:   ' + fmtDate(chunk.nextTimestamp);   // no next-line stored
           document.getElementById(prefix + 'Text').textContent = chunk.text || '(no text available)';
       }

5. In the outliers table, make the "From" date cells clickable.  Change the
   `<td>` that renders `fmtDate(o.timestamp)` to:

       <td style="white-space:nowrap;font-size:0.82em;">
         <span class="nav-date"
               data-file="${escapeAttr(data.filePath)}"
               data-line="${o.line}">${fmtDate(o.timestamp)}</span>
       </td>

   Leave the "To" cell as plain text (no stored next-line number).

6. Add `escapeAttr` helper near `escapeHtml`.
```

---

## Prompt 3 — Pattern Search Results (resultDocumentProvider.ts + providerPatternsSearch.ts + patternSearchResults.html)

```
Context
-------
File: src/utils/resultDocumentProvider.ts   – method: openPatternSearchResult()
File: src/logSearch/providerPatternsSearch.ts – calls resultProvider.openPatternSearchResult()
File: resources/patternSearchResults.html

The pattern search result stores matches as:
  line_match: string[]   // format: "lineNumber: matchedText"
  count: number

The webview currently does NOT receive the log file path, and the panel's
onDidReceiveMessage handler is not wired up at all.

Task
----
1. In `resultDocumentProvider.ts`, update the signature of
   `openPatternSearchResult` to accept `logFilePath`:

       async openPatternSearchResult(
           results: { [pattern: string]: { count: number; line_match: string[] } },
           logFilePath: string
       ): Promise<void>

   Embed `logFilePath` in the injected data script:

       window.RESULTS_DATA  = ${JSON.stringify(results)};
       window.LOG_FILE_PATH = ${JSON.stringify(logFilePath)};

2. After creating the webview panel, add a `navigateToLine` message handler:

       panel.webview.onDidReceiveMessage(async message => {
           if (message.command === 'navigateToLine') {
               const uri  = vscode.Uri.file(message.filePath);
               const line = Math.max(0, (message.line as number) - 1);
               try {
                   const doc    = await vscode.workspace.openTextDocument(uri);
                   const editor = await vscode.window.showTextDocument(doc, {
                       viewColumn: vscode.ViewColumn.One,
                       preview: false
                   });
                   const pos = new vscode.Position(line, 0);
                   editor.selection = new vscode.Selection(pos, pos);
                   editor.revealRange(new vscode.Range(pos, pos),
                       vscode.TextEditorRevealType.InCenter);
               } catch (err) {
                   vscode.window.showErrorMessage(
                       `Cannot open log file: ${err instanceof Error ? err.message : err}`);
               }
           }
       });

3. In `providerPatternsSearch.ts`, pass `logFilePath` when calling the method:

       await resultProvider.openPatternSearchResult(editorResults, logFilePath);

4. In `resources/patternSearchResults.html`, acquire the VS Code API and add
   a delegated click handler at the top of the <script> block:

       const vscode = acquireVsCodeApi();

       document.addEventListener('click', e => {
           const el = e.target.closest('.nav-line');
           if (!el) return;
           vscode.postMessage({
               command: 'navigateToLine',
               filePath: window.LOG_FILE_PATH,
               line: parseInt(el.dataset.line, 10)
           });
       });

5. In `displayDetailedResults`, make each line-number span a clickable `.nav-line`:

       // Replace the current template literal that builds each line entry:
       function buildLineHtml(match) {
           const colonIdx = match.indexOf(': ');
           if (colonIdx === -1) {
               return `<div><span class="match-text">${escapeHtml(match)}</span></div>`;
           }
           const lineNum  = match.substring(0, colonIdx);
           const matchTxt = match.substring(colonIdx + 2);
           return `<div>
               <span class="line-number nav-line" data-line="${lineNum}"
                     title="Click to navigate to line ${lineNum} in log file"
                     style="cursor:pointer;">Line ${lineNum}:</span>
               <span class="match-text">${escapeHtml(matchTxt)}</span>
           </div>`;
       }

   Use `buildLineHtml(match)` in both `displayDetailedResults` and
   `toggleAllLines` instead of the inline map callback.

6. Add CSS for the nav-line hover effect inside <style>:

       .line-number.nav-line:hover {
           color: var(--vscode-textLink-activeForeground, #4fc1ff);
           text-decoration: underline;
       }
```

---

## Prompt 4 — Chunk Stats Comparison (logChunkStatsComparisonProvider.ts + logChunkStatsComparison.html)

```
Context
-------
File: src/logSearch/logChunkStatsComparisonProvider.ts
File: resources/logChunkStatsComparison.html

The comparison view shows aggregate statistics (mean, median, p90, …) across
multiple files; it does NOT store specific line numbers for individual log entries.
There are no individual timestamps to click, but each file row shows the file name.

Task
----
Make each file name in the comparison table a clickable link that opens the log
file in the editor (at the top, line 1), so users can quickly open any of the
compared files.

1. In `logChunkStatsComparisonProvider.ts → openReportPanel()`, add a message
   handler:

       panel.webview.onDidReceiveMessage(async message => {
           if (message.command === 'exportHtml') {
               await this.exportReport();
           } else if (message.command === 'openFile') {
               try {
                   const uri = vscode.Uri.file(message.filePath);
                   const doc = await vscode.workspace.openTextDocument(uri);
                   await vscode.window.showTextDocument(doc, {
                       viewColumn: vscode.ViewColumn.One,
                       preview: false
                   });
               } catch (err) {
                   vscode.window.showErrorMessage(
                       `Cannot open file: ${err instanceof Error ? err.message : err}`);
               }
           }
       });

2. In `resources/logChunkStatsComparison.html`, acquire the VS Code API and
   add a delegated click handler:

       const vscode = acquireVsCodeApi();

       document.addEventListener('click', e => {
           const el = e.target.closest('.open-file');
           if (!el) return;
           vscode.postMessage({ command: 'openFile', filePath: el.dataset.file });
       });

3. Wherever the file name is displayed in the HTML template (file rows in the
   comparison table), replace the plain text with:

       <span class="open-file"
             data-file="${file.filePath}"
             title="Click to open ${file.fileName} in editor"
             style="cursor:pointer;text-decoration:underline dotted;
                    color:var(--vscode-textLink-foreground);">
         ${file.fileName}
       </span>

   Note: `file.filePath` is already present in the serialised data
   (`SerializedFileStats.filePath`).
```

---

## Shared helper: `navigateToLine` utility (optional refactor)

If you prefer to avoid repeating the navigation snippet in every provider, extract
it into `src/utils/navigateToDateTime.ts` (or a new `src/utils/navigateToLine.ts`):

```typescript
import * as vscode from 'vscode';

/**
 * Opens `filePath` in the editor and moves the cursor to `line` (1-based).
 */
export async function navigateToLine(filePath: string, line: number): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preview: false
    });
    const pos = new vscode.Position(Math.max(0, line - 1), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}
```

Then in each provider's `onDidReceiveMessage`:

```typescript
import { navigateToLine } from '../utils/navigateToLine';
// ...
case 'navigateToLine':
    await navigateToLine(message.filePath, message.line);
    break;
```
