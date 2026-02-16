import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogFileHandler } from '../utils/log-file-reader';
import { getFormatDisplayString } from '../utils/timestamp-detect';

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
            this.tooltip = this.createTooltip();
            
            // Add description with key metadata
            this.description = this.createDescription();
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
    
    private createTooltip(): vscode.MarkdownString {
        const meta = this.metadata!;
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
    
    private createDescription(): string {
        const meta = this.metadata!;
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
    
    constructor(private context: vscode.ExtensionContext) {
        this.loadWatchedFolders();
    }
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: LogTreeItem): vscode.TreeItem {
        return element;
    }
    
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
                    // Get file metadata
                    const metadata = await this.getFileMetadata(entryPath);
                    items.push(new LogTreeItem(
                        entry.name,
                        vscode.TreeItemCollapsibleState.None,
                        uri,
                        false,
                        metadata
                    ));
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
        const logExtensions = ['.log', '.txt', '.out', '.err', '.trace'];
        const lowerFilename = filename.toLowerCase();
        return logExtensions.some(ext => lowerFilename.endsWith(ext)) || lowerFilename.includes('.log.');
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
