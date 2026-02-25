import * as vscode from 'vscode';
import { LogTreeProvider, LogTreeItem, FilterOptions } from '../logManagement/logTreeProvider';
import { UnifiedLogViewProvider } from '../logSearch/unifiedLogViewProvider';
import { ILogContext } from '../utils/log-context';

export function registerTreeCommands(
    context: vscode.ExtensionContext,
    logTreeProvider: LogTreeProvider,
    unifiedLogViewProvider: UnifiedLogViewProvider,
    logContext: ILogContext
): void {
    // Double-click detection for tree view clicks
    let clickCount = 0;
    let clickTimer: NodeJS.Timeout | undefined;
    let lastClickedPath: string | undefined;
    const DOUBLE_CLICK_TIME = 300; // milliseconds

    // Register command that fires on every tree item click (even if already selected)
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.onFileClick', async (item: LogTreeItem) => {
            if (item.isFolder || !item.resourceUri) {
                return;
            }

            const currentPath = item.resourceUri.fsPath;

            // Update the current log file
            logContext.setActiveFile(currentPath);

            // If this is a different item, reset
            if (lastClickedPath !== currentPath) {
                clickCount = 0;
                lastClickedPath = currentPath;
                // Clear any existing timer
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = undefined;
                }
            }

            // Increment click count
            clickCount++;

            console.log('[Extension] Click #' + clickCount + ' on:', currentPath);

            // Clear any existing timer
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = undefined;
            }

            if (clickCount === 1) {
                // First click - wait to see if there's a second click
                console.log('[Extension] First click detected, waiting for potential double-click');
                clickTimer = setTimeout(async () => {
                    // Single click confirmed - ensure full metadata is loaded first
                    console.log('[Extension] Single-click confirmed - showing file info');
                    await logTreeProvider.loadMetadata(item);
                    await unifiedLogViewProvider.showFileInfo(item.resourceUri!, item.metadata);
                    clickCount = 0;
                    lastClickedPath = undefined;
                }, DOUBLE_CLICK_TIME);
            } else if (clickCount >= 2) {
                // Double click detected
                console.log('[Extension] Double-click detected - opening file in editor');
                await vscode.commands.executeCommand('vscode.open', item.resourceUri);
                clickCount = 0;
                lastClickedPath = undefined;
            }
        })
    );

    // Register tree view commands
    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.refresh', () => {
            logTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.filter', () => {
            showFilterDialog(logTreeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.clearFilter', () => {
            showFilterDialog(logTreeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.addFolder', () => {
            logTreeProvider.addFolder();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.removeFolder', (item: LogTreeItem) => {
            logTreeProvider.removeFolder(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.openFile', (item: LogTreeItem) => {
            logTreeProvider.openFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.showFileInfo', async (item: LogTreeItem) => {
            if (item.resourceUri) {
                await unifiedLogViewProvider.showFileInfo(item.resourceUri, item.metadata);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('acacia-log.logExplorer.revealInExplorer', (item: LogTreeItem) => {
            logTreeProvider.revealInExplorer(item);
        })
    );
}

// ── Filter dialog ────────────────────────────────────────────────────────────

interface ValuedQuickPickItem extends vscode.QuickPickItem {
    value?: string;
}

async function showFilterDialog(provider: LogTreeProvider): Promise<void> {
    const current = provider.getFilter();

    // Build summary of currently active filters for display
    const parts: string[] = [];
    if (current.dateFilter) {
        const rangeLabel: Record<string, string> = {
            today: 'Today', yesterday: 'Yesterday',
            last7days: 'Last 7 days', last30days: 'Last 30 days', custom: 'Custom'
        };
        parts.push(`Date: ${rangeLabel[current.dateFilter.range]}`);
    }
    if (current.fileTypes && current.fileTypes.length > 0) {
        parts.push(`Types: ${current.fileTypes.join(', ')}`);
    }
    const activeSummary = parts.length > 0 ? parts.join('  |  ') : '';

    // ── Step 1: action selection ──────────────────────────────────────────────
    const actionItems: ValuedQuickPickItem[] = [];
    if (provider.hasActiveFilter()) {
        actionItems.push({
            label: '$(close) Clear All Filters',
            description: activeSummary,
            value: 'clear'
        });
        actionItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    }
    actionItems.push({ label: '$(calendar) Filter by Date…', value: 'date' });
    actionItems.push({ label: '$(file-text) Filter by File Type…', value: 'type' });

    const action = await vscode.window.showQuickPick(actionItems, {
        title: 'Filter Log Files',
        placeHolder: activeSummary || 'Select a filter type…'
    }) as ValuedQuickPickItem | undefined;
    if (!action) { return; }

    if (action.value === 'clear') {
        provider.setFilter({});
        return;
    }

    // ── Date filter ───────────────────────────────────────────────────────────
    if (action.value === 'date') {
        const rangeItems: ValuedQuickPickItem[] = [
            { label: 'Today', description: 'Files modified or created today', value: 'today' },
            { label: 'Yesterday', description: 'Files modified or created yesterday', value: 'yesterday' },
            { label: 'Last 7 days', value: 'last7days' },
            { label: 'Last 30 days', value: 'last30days' },
            { label: '$(calendar) Custom date…', description: 'Enter a specific start date', value: 'custom' }
        ];
        // Mark currently active range
        if (current.dateFilter) {
            const cur = rangeItems.find(i => i.value === current.dateFilter!.range);
            if (cur) { cur.description = (cur.description ? cur.description + '  ' : '') + '[active]'; }
        }
        const rangePick = await vscode.window.showQuickPick(rangeItems, {
            title: 'Filter by date (modified or created)',
            placeHolder: 'Show files whose modified or created date falls in this range'
        }) as ValuedQuickPickItem | undefined;
        if (!rangePick) { return; }
        type DateRange = NonNullable<FilterOptions['dateFilter']>['range'];
        const range = rangePick.value as DateRange;

        if (range === 'custom') {
            const defaultDate = current.dateFilter?.customDate
                ? current.dateFilter.customDate.toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
            const input = await vscode.window.showInputBox({
                title: 'Custom start date',
                prompt: 'Show files modified or created on or after this date (YYYY-MM-DD)',
                value: defaultDate,
                validateInput: v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Use YYYY-MM-DD format'
            });
            if (!input) { return; }
            const [y, m, d] = input.split('-').map(Number);
            provider.setFilter({ ...current, dateFilter: { range: 'custom', customDate: new Date(y, m - 1, d) } });
        } else {
            provider.setFilter({ ...current, dateFilter: { range } });
        }
        return;
    }

    // ── File-type filter ──────────────────────────────────────────────────────
    if (action.value === 'type') {
        const allTypes = ['.log', '.txt', '.out', '.err', '.trace', '.jsonl', '.ndjson'];
        const activeTypes = current.fileTypes ?? [];
        const typeItems: ValuedQuickPickItem[] = allTypes.map(ext => ({
            label: `*${ext}`,
            value: ext,
            picked: activeTypes.length === 0 || activeTypes.includes(ext)
        }));
        const selected = await vscode.window.showQuickPick(typeItems, {
            title: 'Filter by file type',
            placeHolder: 'Deselect types to hide them',
            canPickMany: true
        }) as ValuedQuickPickItem[] | undefined;
        if (!selected) { return; }
        const chosen = selected.map(i => i.value as string);
        // All selected == no filter; subset == filter
        if (chosen.length === 0 || chosen.length === allTypes.length) {
            const { fileTypes: _removed, ...rest } = current;
            provider.setFilter(rest);
        } else {
            provider.setFilter({ ...current, fileTypes: chosen });
        }
    }
}
