/**
 * Format-cache façade — delegates to LogContext singleton.
 *
 * All cache state now lives inside LogContext.  This module is kept as a
 * thin re-export layer so existing consumers (`require` / `import`) continue
 * to work without modification.
 */
import * as vscode from 'vscode';
import { LogContext } from './log-context';
import { DetectedFormat } from './timestamp-detect';

// Re-export types for backward compat
export { DetectedFormat, getFormatDisplayString } from './timestamp-detect';

/**
 * Get or detect the timestamp format for a document (delegated to LogContext)
 */
export async function getOrDetectFormat(document: vscode.TextDocument): Promise<{
  format: DetectedFormat | null;
  detected: boolean;
  totalLines: number;
}> {
  return LogContext.getInstance().getOrDetectFormat(document);
}

/**
 * Get format from cache or return null (delegated to LogContext)
 */
export function getCachedFormat(document: vscode.TextDocument): DetectedFormat | null {
  return LogContext.getInstance().getCachedFormat(document);
}

/**
 * Clear format cache for a document (delegated to LogContext)
 */
export function clearFormatCache(document: vscode.TextDocument): void {
  return LogContext.getInstance().clearFormatCache(document);
}

/**
 * Clear all cached formats (delegated to LogContext)
 */
export function clearAllFormatCache(): void {
  return LogContext.getInstance().clearAllFormatCache();
}

// ── Pure helper functions (no cache state) ────────────────────────────────────

/**
 * Get regex and format from detected format or fallback to config
 */
export function getRegexAndFormat(
  detectedFormat: DetectedFormat | null
): {
  regex: RegExp;
  format: string;
  useDetected: boolean;
} {
  if (detectedFormat) {
    // Convert luxon format patterns to match what the timeline expects
    const formatMap: Record<string, string> = {
      'yyyy-MM-ddTHH:mm:ss.SSS': 'yyyy-MM-dd\'T\'HH:mm:ss.SSS',
      'yyyy-MM-dd HH:mm:ss.SSS': 'yyyy-MM-dd HH:mm:ss.SSS',
      'yyyy-MM-dd HH:mm:ss': 'yyyy-MM-dd HH:mm:ss',
      'yyyy-MM-dd': 'yyyy-MM-dd',
      'dd-MM-yyyy HH:mm': 'dd-MM-yyyy HH:mm',
      'MM-dd-yyyy HH:mm': 'MM-dd-yyyy HH:mm',
      'dd/MM/yyyy HH:mm:ss': 'dd/MM/yyyy HH:mm:ss',
      'dd/MM/yyyy HH:mm': 'dd/MM/yyyy HH:mm',
      'MM/dd/yyyy HH:mm:ss': 'MM/dd/yyyy HH:mm:ss',
      'MM/dd/yyyy HH:mm': 'MM/dd/yyyy HH:mm',
      'dd.MM.yyyy HH:mm:ss': 'dd.MM.yyyy HH:mm:ss',
      'dd.MM.yyyy HH:mm': 'dd.MM.yyyy HH:mm',
      'dd-MMM-yyyy HH:mm:ss': 'dd-MMM-yyyy HH:mm:ss',
      'MMM dd, yyyy HH:mm:ss': 'MMM dd, yyyy HH:mm:ss',
      'MMM dd HH:mm:ss': 'MMM dd HH:mm:ss',
      'HH:mm:ss.SSS': 'HH:mm:ss.SSS',
      'HH:mm:ss': 'HH:mm:ss',
    };
    
    const format = formatMap[detectedFormat.pattern] || detectedFormat.pattern;
    
    return {
      regex: detectedFormat.regex,
      format: format,
      useDetected: true
    };
  }
  
  // Fallback to configuration
  const config = vscode.workspace.getConfiguration('acacia-log');
  const regexStr = config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
  const format = config.get<string>('logDateFormat') || 'yyyy-MM-dd HH:mm:ss';
  
  return {
    regex: new RegExp(regexStr),
    format: format,
    useDetected: false
  };
}

/**
 * Get regex pattern string from detected format for webview display
 */
export function getRegexPatternString(detectedFormat: DetectedFormat | null): string {
  if (detectedFormat) {
    return detectedFormat.regex.source;
  }
  const config = vscode.workspace.getConfiguration('acacia-log');
  return config.get<string>('logDateRegex') || '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
}
