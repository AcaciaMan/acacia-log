import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Filter options applied to the Log Files tree view */
export interface FilterOptions {
    /** Date-based filter.
     *  A file passes when its modified date OR created date falls in the range. */
    dateFilter?: {
        /** Preset range or custom start date */
        range: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom';
        /** Used only when range === 'custom'. Start of the day to include files from. */
        customDate?: Date;
    };
    /** Limit to these file extensions (e.g. ['.log', '.txt', '.jsonl']).
     *  Empty / undefined means all supported types. */
    fileTypes?: string[];
}

/**
 * Represents a log file or folder in the tree view
 */
export class LogTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri?: vscode.Uri,
        public readonly isFolder?: boolean,
        public readonly metadata?: {
            size?: number;
            lastModified?: Date;
            created?: Date;
            totalLines?: number;
            timestampPattern?: string;
            timestampDetected?: boolean;
            formatDisplay?: string;
        }
    ) {
        super(label, collapsibleState);
        
        this.resourceUri = resourceUri;
        
        // Set icon based on type
        if (isFolder) {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else {
            this.iconPath = new vscode.ThemeIcon('file-text');
        }
        
        // Add custom tooltip with metadata
        if (metadata) {
            this.tooltip = this._buildTooltip(metadata);
            this.description = this._buildDescription(metadata);
        }
        
        // Add context value for context menu
        this.contextValue = isFolder ? 'logFolder' : 'logFile';
        
        // Set command to handle clicks - this fires on every click, even if item is already selected
        if (!isFolder && resourceUri) {
            this.command = {
                command: 'acacia-log.logExplorer.onFileClick',
                title: 'Handle File Click',
                arguments: [this]
            };
        }
    }

    /** Whether full metadata (line count, timestamp detection) has been loaded */
    public initialized: boolean = false;

    /**
     * Apply full metadata to this item, updating tooltip and description.
     * Called lazily on hover or click.
     */
    applyFullMetadata(metadata: {
        size?: number;
        lastModified?: Date;
        created?: Date;
        totalLines?: number;
        timestampPattern?: string;
        timestampDetected?: boolean;
        formatDisplay?: string;
    }): void {
        // Merge into existing metadata
        const merged = Object.assign({}, this.metadata ?? {}, metadata);
        // Re-build tooltip and description using private helpers via cast
        (this as unknown as { metadata: typeof merged }).metadata = merged;
        this.tooltip = this._buildTooltip(merged);
        this.description = this._buildDescription(merged);
        this.initialized = true;
    }

    private _buildTooltip(meta: NonNullable<LogTreeItem['metadata']>): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${this.label}**\n\n`);
        if (this.resourceUri) {
            tooltip.appendMarkdown(`📁 ${this.resourceUri.fsPath}\n\n`);
        }
        if (meta.size !== undefined) {
            tooltip.appendMarkdown(`📊 Size: ${this.formatSize(meta.size)}\n\n`);
        }
        if (meta.totalLines !== undefined) {
            tooltip.appendMarkdown(`📝 Lines: ${meta.totalLines.toLocaleString()}\n\n`);
        }
        if (meta.timestampDetected !== undefined) {
            const icon = meta.timestampDetected ? '🟢' : '🔴';
            const status = meta.timestampDetected ? 'Detected' : 'Not detected';
            tooltip.appendMarkdown(`${icon} Timestamp: ${status}\n\n`);
            if (meta.timestampDetected && meta.timestampPattern) {
                tooltip.appendMarkdown(`⏱️ Pattern: ${meta.timestampPattern}\n\n`);
            }
        }
        if (meta.lastModified) {
            tooltip.appendMarkdown(`🕒 Modified: ${meta.lastModified.toLocaleString()}\n\n`);
        }
        if (meta.created) {
            tooltip.appendMarkdown(`📅 Created: ${meta.created.toLocaleString()}\n\n`);
        }
        return tooltip;
    }

    private _buildDescription(meta: NonNullable<LogTreeItem['metadata']>): string {
        const parts: string[] = [];
        if (meta.size !== undefined) {
            parts.push(this.formatSize(meta.size));
        }
        if (meta.totalLines !== undefined) {
            parts.push(`${meta.totalLines.toLocaleString()} lines`);
        }
        if (meta.timestampDetected !== undefined) {
            const icon = meta.timestampDetected ? '🟢' : '🔴';
            parts.push(`${icon}`);
        }
        return parts.join(' • ');
    }
    
    
    private formatSize(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(2)} KB`;
        } else {
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    }
}

/**
 * Provides tree data for log files and folders
 */
export class LogTreeProvider implements vscode.TreeDataProvider<LogTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<LogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private watchedFolders: Set<string> = new Set();
    private fileWatchers: vscode.FileSystemWatcher[] = [];
    /** Cache of fully-loaded metadata keyed by file path */
    private metadataCache = new Map<string, Awaited<ReturnType<LogTreeProvider['getFileMetadata']>>>();
    /** Currently active filter */
    private currentFilter: FilterOptions = {};

    constructor(private context: vscode.ExtensionContext) {
        this.loadWatchedFolders();
    }
    
    refresh(): void {
        this.metadataCache.clear();
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: LogTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Called by VS Code when a tree item is about to be shown (e.g. on hover).
     * Used to lazily load full metadata (line count + timestamp detection) for
     * log files that were not initialised on first render.
     */
    async resolveTreeItem(
        item: LogTreeItem,
        element: LogTreeItem,
        token: vscode.CancellationToken
    ): Promise<LogTreeItem> {
        if (!element.initialized && element.resourceUri && !element.isFolder) {
            const filePath = element.resourceUri.fsPath;
            let metadata = this.metadataCache.get(filePath);
            if (!metadata) {
                metadata = await this.getFileMetadata(filePath);
                if (!token.isCancellationRequested) {
                    this.metadataCache.set(filePath, metadata);
                }
            }
            if (!token.isCancellationRequested) {
                element.applyFullMetadata(metadata);
                // Notify the tree view to re-render this item with the updated description/tooltip
                this._onDidChangeTreeData.fire(element);
            }
        }
        return element;
    }
    
    /**
     * Public helper to eagerly load full metadata for a given item.
     * Call this from the click handler so metadata is up-to-date before
     * it is passed to other providers.
     */
    async loadMetadata(item: LogTreeItem): Promise<void> {
        if (item.initialized || item.isFolder || !item.resourceUri) {
            return;
        }
        const filePath = item.resourceUri.fsPath;
        let metadata = this.metadataCache.get(filePath);
        if (!metadata) {
            metadata = await this.getFileMetadata(filePath);
            this.metadataCache.set(filePath, metadata);
        }
        item.applyFullMetadata(metadata);
        // Notify the tree view to re-render this item with the updated description/tooltip
        this._onDidChangeTreeData.fire(item);
    }

    // ── Filter ────────────────────────────────────────────────────────────────

    /** Replace the active filter and rebuild the tree. */
    setFilter(options: FilterOptions): void {
        this.currentFilter = options;
        vscode.commands.executeCommand('setContext', 'acacia-log.filterActive', this.hasActiveFilter());
        this.refresh();
    }

    /** Return the currently active filter (read-only copy). */
    getFilter(): FilterOptions {
        return { ...this.currentFilter };
    }

    /** True when at least one filter criterion is enabled. */
    hasActiveFilter(): boolean {
        return !!(
            this.currentFilter.dateFilter ||
            (this.currentFilter.fileTypes && this.currentFilter.fileTypes.length > 0)
        );
    }

    /**
     * Check whether a file's basic metadata passes the currently active date filter.
     * A file passes when its modified date OR created date falls in the range.
     * Returns true when no date filter is set.
     */
    private matchesDateFilter(meta: { lastModified?: Date; created?: Date }): boolean {
        const filter = this.currentFilter.dateFilter;
        if (!filter) {
            return true;
        }
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const inRange = (fileDate: Date): boolean => {
            switch (filter.range) {
                case 'today':
                    return fileDate >= startOfToday;
                case 'yesterday': {
                    const startOfYesterday = new Date(startOfToday);
                    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                    return fileDate >= startOfYesterday && fileDate < startOfToday;
                }
                case 'last7days': {
                    const cutoff = new Date(startOfToday);
                    cutoff.setDate(cutoff.getDate() - 7);
                    return fileDate >= cutoff;
                }
                case 'last30days': {
                    const cutoff = new Date(startOfToday);
                    cutoff.setDate(cutoff.getDate() - 30);
                    return fileDate >= cutoff;
                }
                case 'custom':
                    return filter.customDate ? fileDate >= filter.customDate : true;
            }
            return true;
        };

        // Pass when either modified or created date matches
        if (meta.lastModified && inRange(meta.lastModified)) { return true; }
        if (meta.created && inRange(meta.created)) { return true; }
        // If neither date is available, show the file
        if (!meta.lastModified && !meta.created) { return true; }
        return false;
    }

    /**
     * Check whether a filename passes the active file-type filter.
     * Returns true when no file-type filter is set.
     */
    private matchesFileTypeFilter(filename: string): boolean {
        const types = this.currentFilter.fileTypes;
        if (!types || types.length === 0) {
            return true;
        }
        const lower = filename.toLowerCase();
        const ext = path.extname(lower);
        // Support compound extensions like "app.log.1"
        if (types.includes('.log') && lower.includes('.log.')) {
            return true;
        }
        return types.includes(ext);
    }

    // ─────────────────────────────────────────────────────────────────────────

    async getChildren(element?: LogTreeItem): Promise<LogTreeItem[]> {
        if (!element) {
            // Root level: show watched folders
            return this.getRootItems();
        } else {
            // Child level: show contents of folder
            return this.getChildItems(element);
        }
    }
    
    private async getRootItems(): Promise<LogTreeItem[]> {
        const items: LogTreeItem[] = [];
        
        // Add workspace folders
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                const logFiles = await this.findLogFilesInFolder(folder.uri.fsPath);
                if (logFiles.length > 0) {
                    const item = new LogTreeItem(
                        folder.name,
                        vscode.TreeItemCollapsibleState.Expanded,
                        folder.uri,
                        true
                    );
                    items.push(item);
                }
            }
        }
        
        // Add manually watched folders
        for (const folderPath of this.watchedFolders) {
            if (fs.existsSync(folderPath)) {
                const folderName = path.basename(folderPath);
                const item = new LogTreeItem(
                    folderName,
                    vscode.TreeItemCollapsibleState.Expanded,
                    vscode.Uri.file(folderPath),
                    true
                );
                items.push(item);
            }
        }
        
        // If no items, show a placeholder
        if (items.length === 0) {
            const placeholder = new LogTreeItem(
                'No log files found',
                vscode.TreeItemCollapsibleState.None
            );
            placeholder.iconPath = new vscode.ThemeIcon('info');
            placeholder.contextValue = 'placeholder';
            return [placeholder];
        }
        
        return items;
    }
    
    private async getChildItems(element: LogTreeItem): Promise<LogTreeItem[]> {
        if (!element.resourceUri || !element.isFolder) {
            return [];
        }
        
        const folderPath = element.resourceUri.fsPath;
        const items: LogTreeItem[] = [];
        
        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            
            // Sort: folders first, then files
            const sortedEntries = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) {
                    return -1;
                }
                if (!a.isDirectory() && b.isDirectory()) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });
            
            // Track whether we have already fully-initialised the first log file
            let firstLogFileInitialized = false;

            for (const entry of sortedEntries) {
                const entryPath = path.join(folderPath, entry.name);
                const uri = vscode.Uri.file(entryPath);
                
                if (entry.isDirectory()) {
                    // Check if folder contains log files
                    const hasLogFiles = await this.containsLogFiles(entryPath);
                    if (hasLogFiles) {
                        items.push(new LogTreeItem(
                            entry.name,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            uri,
                            true
                        ));
                    }
                } else if (this.isLogFile(entry.name)) {
                    // ── File-type filter (no I/O) ──────────────────────────
                    if (!this.matchesFileTypeFilter(entry.name)) {
                        continue;
                    }

                    // ── Basic stat (cheap) for date filter check ───────────
                    const basicMeta = await this.getBasicFileMetadata(entryPath);
                    if (!this.matchesDateFilter(basicMeta)) {
                        continue;
                    }

                    // ── Build tree item ────────────────────────────────────
                    let fileItem: LogTreeItem;
                    if (!firstLogFileInitialized) {
                        // Fully initialise the first matching log file immediately
                        const metadata = await this.getFileMetadata(entryPath);
                        this.metadataCache.set(entryPath, metadata);
                        fileItem = new LogTreeItem(
                            entry.name,
                            vscode.TreeItemCollapsibleState.None,
                            uri,
                            false,
                            metadata
                        );
                        fileItem.initialized = true;
                        firstLogFileInitialized = true;
                    } else {
                        // Lazy: reuse the basicMeta already fetched above;
                        // full metadata (line count + timestamp) is loaded on
                        // hover (resolveTreeItem) or on click.
                        fileItem = new LogTreeItem(
                            entry.name,
                            vscode.TreeItemCollapsibleState.None,
                            uri,
                            false,
                            basicMeta
                        );
                        // initialized stays false → resolveTreeItem will hydrate it
                    }
                    items.push(fileItem);
                }
            }
        } catch (error) {
            console.error(`Error reading folder ${folderPath}:`, error);
        }
        
        return items;
    }
    
    private async findLogFilesInFolder(folderPath: string): Promise<string[]> {
        const logFiles: string[] = [];
        
        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && this.isLogFile(entry.name)) {
                    logFiles.push(path.join(folderPath, entry.name));
                }
            }
        } catch (error) {
            // Folder might not exist or not accessible
        }
        
        return logFiles;
    }
    
    private async containsLogFiles(folderPath: string): Promise<boolean> {
        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && this.isLogFile(entry.name)) {
                    return true;
                }
                if (entry.isDirectory()) {
                    const subFolderPath = path.join(folderPath, entry.name);
                    if (await this.containsLogFiles(subFolderPath)) {
                        return true;
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return false;
    }
    
    private isLogFile(filename: string): boolean {
        const logExtensions = ['.log', '.txt', '.out', '.err', '.trace', '.jsonl', '.ndjson'];
        const lowerFilename = filename.toLowerCase();
        return logExtensions.some(ext => lowerFilename.endsWith(ext)) || lowerFilename.includes('.log.');
    }
    
    /**
     * Fast metadata: only file-system stats, no LogFileHandler.
     * Used for log files 2..N so the tree renders immediately.
     */
    private async getBasicFileMetadata(filePath: string): Promise<{
        size?: number;
        lastModified?: Date;
        created?: Date;
    }> {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                lastModified: stats.mtime,
                created: stats.birthtime
            };
        } catch (error) {
            return {};
        }
    }

    private async getFileMetadata(filePath: string): Promise<{
        size?: number;
        lastModified?: Date;
        created?: Date;
        totalLines?: number;
        timestampPattern?: string;
        timestampDetected?: boolean;
        formatDisplay?: string;
    }> {
        try {
            const stats = await fs.promises.stat(filePath);
            
            // Initialize LogFileHandler to detect timestamp format and get line count
            let totalLines: number | undefined;
            let timestampPattern: string | undefined;
            let timestampDetected: boolean | undefined;
            let formatDisplay: string | undefined;
            
            try {
                const { LogFileHandler } = require('../utils/log-file-reader');
                const { getFormatDisplayString } = require('../utils/timestamp-detect');
                const handler = new LogFileHandler(filePath);
                const result = await handler.initialize();
                
                totalLines = handler.totalLines;
                timestampDetected = result.detected;
                timestampPattern = result.detected ? result.format?.pattern ?? undefined : undefined;
                formatDisplay = result.detected ? getFormatDisplayString(result) : undefined;
            } catch (detectionError) {
                console.warn(`Timestamp detection failed for ${filePath}:`, detectionError);
                // Continue with basic metadata even if detection fails
            }
            
            return {
                size: stats.size,
                lastModified: stats.mtime,
                created: stats.birthtime,
                totalLines,
                timestampPattern,
                timestampDetected,
                formatDisplay
            };
        } catch (error) {
            console.error(`Error getting metadata for ${filePath}:`, error);
            return {};
        }
    }
    
    /**
     * Add a folder to watch for log files
     */
    async addFolder(): Promise<void> {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Folder to Watch for Log Files'
        });
        
        if (folderUri && folderUri[0]) {
            const folderPath = folderUri[0].fsPath;
            this.watchedFolders.add(folderPath);
            this.saveWatchedFolders();
            this.setupFileWatcher(folderPath);
            this.refresh();
            vscode.window.showInformationMessage(`Added log folder: ${path.basename(folderPath)}`);
        }
    }
    
    /**
     * Remove a folder from watching
     */
    async removeFolder(item: LogTreeItem): Promise<void> {
        if (item.resourceUri) {
            const folderPath = item.resourceUri.fsPath;
            this.watchedFolders.delete(folderPath);
            this.saveWatchedFolders();
            this.refresh();
            vscode.window.showInformationMessage(`Removed log folder: ${item.label}`);
        }
    }
    
    /**
     * Open file in editor
     */
    async openFile(item: LogTreeItem): Promise<void> {
        if (item.resourceUri) {
            await vscode.commands.executeCommand('vscode.open', item.resourceUri);
        }
    }
    
    /**
     * Reveal file in system explorer
     */
    async revealInExplorer(item: LogTreeItem): Promise<void> {
        if (item.resourceUri) {
            await vscode.commands.executeCommand('revealFileInOS', item.resourceUri);
        }
    }
    
    private setupFileWatcher(folderPath: string): void {
        const pattern = new vscode.RelativePattern(folderPath, '**/*.{log,txt,out,err,trace}');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        watcher.onDidChange(() => this.refresh());
        
        this.fileWatchers.push(watcher);
    }
    
    private loadWatchedFolders(): void {
        const folders = this.context.globalState.get<string[]>('watchedLogFolders', []);
        this.watchedFolders = new Set(folders);
        
        // Setup watchers for loaded folders
        for (const folder of folders) {
            if (fs.existsSync(folder)) {
                this.setupFileWatcher(folder);
            }
        }
    }
    
    private saveWatchedFolders(): void {
        this.context.globalState.update('watchedLogFolders', Array.from(this.watchedFolders));
    }
    
    dispose(): void {
        this.fileWatchers.forEach(watcher => watcher.dispose());
    }
}
