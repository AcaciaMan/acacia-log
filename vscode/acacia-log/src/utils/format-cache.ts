/**
 * Cache and helper for auto-detected timestamp formats
 */
import * as vscode from 'vscode';
import { LogFileHandler } from './log-file-reader';
import { DetectedFormat, getFormatDisplayString } from './timestamp-detect';

// Cache detected formats by file URI
const formatCache = new Map<string, {
  format: DetectedFormat | null;
  detected: boolean;
  totalLines: number;
  timestamp: number;
}>();

const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get or detect the timestamp format for a document
 * Returns the detected format or null if detection fails
 */
export async function getOrDetectFormat(document: vscode.TextDocument): Promise<{
  format: DetectedFormat | null;
  detected: boolean;
  totalLines: number;
}> {
  const uri = document.uri.toString();
  
  // Check cache first
  const cached = formatCache.get(uri);
  if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_MS)) {
    return {
      format: cached.format,
      detected: cached.detected,
      totalLines: cached.totalLines
    };
  }
  
  try {
    // Detect format using LogFileHandler
    const filePath = document.uri.fsPath;
    const handler = new LogFileHandler(filePath);
    const result = await handler.initialize();
    
    const detectionResult = {
      format: result.detected ? result.format : null,
      detected: result.detected,
      totalLines: handler.totalLines
    };
    
    // Cache the result
    formatCache.set(uri, {
      ...detectionResult,
      timestamp: Date.now()
    });
    
    console.log(`[FormatCache] Detected format for ${document.fileName}:`, 
      result.detected ? result.format?.pattern : 'None');
    
    return detectionResult;
  } catch (error) {
    console.error(`[FormatCache] Error detecting format:`, error);
    return {
      format: null,
      detected: false,
      totalLines: 0
    };
  }
}

/**
 * Get format from cache or return null
 */
export function getCachedFormat(document: vscode.TextDocument): DetectedFormat | null {
  const uri = document.uri.toString();
  const cached = formatCache.get(uri);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_MS)) {
    return cached.format;
  }
  
  return null;
}

/**
 * Clear format cache for a document
 */
export function clearFormatCache(document: vscode.TextDocument): void {
  const uri = document.uri.toString();
  formatCache.delete(uri);
}

/**
 * Clear all cached formats
 */
export function clearAllFormatCache(): void {
  formatCache.clear();
}

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
    let luxonFormat = detectedFormat.pattern;
    
    // Map common patterns for timeline parsing
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
    
    const format = formatMap[luxonFormat] || luxonFormat;
    
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
