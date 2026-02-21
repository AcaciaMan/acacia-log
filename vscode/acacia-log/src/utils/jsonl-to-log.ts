import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── Field detection ───────────────────────────────────────────────────────────

/** Read up to `maxLines` lines and collect all JSON keys by frequency. */
async function detectFields(filePath: string, maxLines = 50): Promise<string[]> {
    const fieldCount = new Map<string, number>();
    const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
    let lineNum = 0;
    for await (const line of rl) {
        if (lineNum++ >= maxLines) { rl.close(); break; }
        if (!line.trim()) { continue; }
        try {
            const obj = JSON.parse(line);
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                for (const key of Object.keys(obj)) {
                    fieldCount.set(key, (fieldCount.get(key) ?? 0) + 1);
                }
            }
        } catch { /* skip non-JSON lines */ }
    }
    // Sort by frequency descending, then alphabetically
    return [...fieldCount.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k]) => k);
}

// ── Smart defaults ────────────────────────────────────────────────────────────

const TIMESTAMP_CANDIDATES = ['timestamp', 'time', 'ts', '@timestamp', 'datetime', 'date', 'created_at', 'logged_at'];
const LEVEL_CANDIDATES     = ['level', 'severity', 'log_level', 'loglevel', 'lvl', 'type'];
const MESSAGE_CANDIDATES   = ['message', 'msg', 'text', 'body', 'description', 'error', 'log'];

function pickBest(fields: string[], candidates: string[]): string | undefined {
    for (const c of candidates) {
        if (fields.includes(c)) { return c; }
    }
    return undefined;
}

// ── QuickPick helper ──────────────────────────────────────────────────────────

interface FieldPickItem extends vscode.QuickPickItem {
    fieldName: string | undefined;
}

async function pickField(
    fields: string[],
    candidates: string[],
    title: string,
    placeHolder: string
): Promise<string | undefined | null> {
    const best = pickBest(fields, candidates);
    const items: FieldPickItem[] = [
        { label: '$(circle-slash) (none)', description: 'Skip this field', fieldName: undefined },
        ...fields.map(f => ({
            label: f,
            description: f === best ? '★ recommended' : undefined,
            fieldName: f
        }))
    ];

    const pick = await vscode.window.showQuickPick(items, {
        title,
        placeHolder
    }) as FieldPickItem | undefined;

    if (pick === undefined) { return null; } // user cancelled
    return pick.fieldName;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function convertJsonlToLog(filePath: string): Promise<void> {

    // ── 1. Detect JSON fields ─────────────────────────────────────────────────
    let fields: string[];
    try {
        fields = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Detecting JSONL fields…' },
            () => detectFields(filePath)
        );
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to read file: ${e}`);
        return;
    }

    if (fields.length === 0) {
        vscode.window.showErrorMessage(
            `No JSON object keys detected in "${path.basename(filePath)}". Is this a valid JSONL file?`
        );
        return;
    }

    // ── 2. Field selection ────────────────────────────────────────────────────

    const tsField = await pickField(
        fields, TIMESTAMP_CANDIDATES,
        'JSONL → Log  (1/4)  Timestamp field',
        'Select the field containing the timestamp'
    );
    if (tsField === null) { return; }

    const lvlField = await pickField(
        fields, LEVEL_CANDIDATES,
        'JSONL → Log  (2/4)  Log level field',
        'Select the field containing the log level (ERROR, WARN, INFO…)'
    );
    if (lvlField === null) { return; }

    const msgField = await pickField(
        fields, MESSAGE_CANDIDATES,
        'JSONL → Log  (3/4)  Message field',
        'Select the field containing the main log message'
    );
    if (msgField === null) { return; }

    // Additional fields (multi-select, optional)
    const usedFields = new Set([tsField, lvlField, msgField].filter(Boolean));
    const extraCandidates = fields.filter(f => !usedFields.has(f));

    let extraFields: string[] = [];
    if (extraCandidates.length > 0) {
        const extraItems = extraCandidates.map(f => ({ label: f }));
        const extraPick = await vscode.window.showQuickPick(extraItems, {
            title: 'JSONL → Log  (4/4)  Additional fields (optional)',
            placeHolder: 'Ctrl/Cmd+click to select extra fields to append — Escape to skip',
            canPickMany: true
        });
        if (extraPick === undefined) { return; }
        extraFields = extraPick.map(i => i.label);
    }

    // ── 3. Output path ────────────────────────────────────────────────────────

    const ext     = path.extname(filePath);
    const base    = path.basename(filePath, ext);
    const dir     = path.dirname(filePath);
    const outPath = path.join(dir, `${base}.log`);

    if (fs.existsSync(outPath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `"${path.basename(outPath)}" already exists. Overwrite?`,
            { modal: true }, 'Overwrite'
        );
        if (overwrite !== 'Overwrite') { return; }
    }

    // ── 4. Convert ────────────────────────────────────────────────────────────

    let linesWritten = 0;
    let linesSkipped = 0;

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Converting ${path.basename(filePath)}…`,
                cancellable: false
            },
            async (progress) => {
                const totalBytes  = fs.statSync(filePath).size || 1;
                let reportedBytes = 0;

                const readStream  = fs.createReadStream(filePath, { encoding: 'utf8' });
                const writeStream = fs.createWriteStream(outPath,  { encoding: 'utf8' });
                const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

                for await (const rawLine of rl) {
                    reportedBytes += Buffer.byteLength(rawLine, 'utf8') + 1;

                    if (!rawLine.trim()) { continue; }

                    let obj: Record<string, unknown>;
                    try {
                        obj = JSON.parse(rawLine);
                    } catch {
                        // Pass non-JSON lines through unchanged
                        writeStream.write(rawLine + '\n');
                        linesSkipped++;
                        continue;
                    }

                    const parts: string[] = [];

                    if (tsField  && obj[tsField]  !== undefined) { parts.push(String(obj[tsField])); }
                    if (lvlField && obj[lvlField] !== undefined) { parts.push(`[${String(obj[lvlField]).toUpperCase()}]`); }
                    if (msgField && obj[msgField] !== undefined) { parts.push(String(obj[msgField])); }
                    for (const ef of extraFields) {
                        if (obj[ef] !== undefined) {
                            const val = obj[ef];
                            parts.push(`${ef}=${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
                        }
                    }

                    writeStream.write(parts.join(' ') + '\n');
                    linesWritten++;

                    if (linesWritten % 5000 === 0) {
                        progress.report({
                            increment: (reportedBytes / totalBytes) * 100,
                            message: `${linesWritten.toLocaleString()} lines…`
                        });
                        reportedBytes = 0;
                    }
                }

                await new Promise<void>((resolve, reject) =>
                    writeStream.end((err: Error | null) => (err ? reject(err) : resolve()))
                );
            }
        );
    } catch (e) {
        vscode.window.showErrorMessage(`Conversion failed: ${e}`);
        return;
    }

    // ── 5. Done ───────────────────────────────────────────────────────────────

    const skippedNote = linesSkipped > 0 ? ` (${linesSkipped} non-JSON lines passed through)` : '';
    const openAction = await vscode.window.showInformationMessage(
        `Converted ${linesWritten.toLocaleString()} lines → "${path.basename(outPath)}"${skippedNote}`,
        'Open File'
    );
    if (openAction === 'Open File') {
        const doc = await vscode.workspace.openTextDocument(outPath);
        await vscode.window.showTextDocument(doc);
    }
}
