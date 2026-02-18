/**
 * Similar lines analyzer for log files.
 * Groups lines by normalized pattern (numbers removed) and tracks occurrences with timestamps.
 */

import * as fs from "fs";
import * as readline from "readline";
import { DetectedFormat, FileDates } from "./timestamp-detect";
import { spawn } from "child_process";
import * as path from "path";

/**
 * Find VS Code's bundled ripgrep binary
 */
function findVSCodeRipgrep(): string | null {
  try {
    // VS Code bundles ripgrep in its installation directory
    // Try to find it through the @vscode/ripgrep package
    const rgPackage = require.resolve('@vscode/ripgrep');
    const rgPath = path.join(path.dirname(rgPackage), 'bin', process.platform === 'win32' ? 'rg.exe' : 'rg');
    
    if (fs.existsSync(rgPath)) {
      console.log('[SimilarLines] Found VS Code bundled ripgrep at:', rgPath);
      return rgPath;
    }
  } catch (error) {
    // Package not found, which is expected in some environments
  }

  // Alternative: try to find it in VS Code's resources directory
  try {
    // Get VS Code executable path from process.execPath
    const vscodeDir = path.dirname(path.dirname(process.execPath));
    const possiblePaths = [
      path.join(vscodeDir, 'resources', 'app', 'node_modules', '@vscode', 'ripgrep', 'bin', process.platform === 'win32' ? 'rg.exe' : 'rg'),
      path.join(vscodeDir, 'resources', 'app', 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', process.platform === 'win32' ? 'rg.exe' : 'rg'),
    ];

    for (const rgPath of possiblePaths) {
      if (fs.existsSync(rgPath)) {
        console.log('[SimilarLines] Found VS Code bundled ripgrep at:', rgPath);
        return rgPath;
      }
    }
  } catch (error) {
    console.error('[SimilarLines] Error finding VS Code ripgrep:', error);
  }

  return null;
}

export interface SimilarLineRecord {
  /** Normalized line pattern (with numbers replaced by placeholders) */
  pattern: string;
  /** Number of occurrences */
  count: number;
  /** First timestamp when this pattern appeared */
  firstTimestamp: Date;
  /** Last timestamp when this pattern appeared */
  lastTimestamp: Date;
  /** Example of the actual line (first occurrence) */
  exampleLine: string;
}

export interface SimilarLinesResult {
  lines: SimilarLineRecord[];
  totalLinesAnalyzed: number;
  totalUniquePatterns: number;
}

/**
 * Normalize a log line by replacing numbers with placeholders.
 * This helps group similar lines together.
 */
function normalizeLine(line: string, timestampMatch: string): string {
  // Remove the timestamp from the line
  let normalized = line.replace(timestampMatch, "").trim();
  
  // Replace all numbers (not part of timestamp) with #
  // This includes IDs, counts, memory addresses, etc.
  normalized = normalized.replace(/\b\d+\b/g, "#");
  normalized = normalized.replace(/0x[0-9a-fA-F]+/g, "0x#"); // hex addresses
  normalized = normalized.replace(/\d+\.\d+\.\d+\.\d+/g, "#.#.#.#"); // IP addresses
  
  return normalized;
}

/**
 * Analyze similar lines using Node.js streaming (fallback method).
 * Reads the file line by line, normalizes patterns, and counts occurrences.
 */
async function analyzeSimilarLinesStreaming(
  filePath: string,
  format: DetectedFormat,
  fileDates: FileDates,
  topN: number
): Promise<SimilarLinesResult> {
  const patternMap = new Map<string, {
    count: number;
    firstTs: Date;
    lastTs: Date;
    exampleLine: string;
  }>();

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let totalLinesAnalyzed = 0;
  let linesRead = 0;

  console.log(`[SimilarLines] Streaming analysis started for ${filePath}`);
  console.log(`[SimilarLines] Using regex: ${format.regex.source}`);

  for await (const line of rl) {
    linesRead++;
    const prefix = line.substring(0, 100);
    const match = prefix.match(format.regex);
    
    if (match) {
      const ts = format.parseFunc(match[0], fileDates);
      if (ts) {
        totalLinesAnalyzed++;
        
        const normalized = normalizeLine(line, match[0]);
        
        if (patternMap.has(normalized)) {
          const entry = patternMap.get(normalized)!;
          entry.count++;
          entry.lastTs = ts;
        } else {
          patternMap.set(normalized, {
            count: 1,
            firstTs: ts,
            lastTs: ts,
            exampleLine: line
          });
        }
      }
    }
  }

  console.log(`[SimilarLines] Streaming complete. Read ${linesRead} lines, analyzed ${totalLinesAnalyzed} with timestamps`);
  console.log(`[SimilarLines] Found ${patternMap.size} unique patterns`);

  rl.close();
  stream.destroy();

  // Convert to array and sort by count
  const sortedLines = Array.from(patternMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      firstTimestamp: data.firstTs,
      lastTimestamp: data.lastTs,
      exampleLine: data.exampleLine
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return {
    lines: sortedLines,
    totalLinesAnalyzed,
    totalUniquePatterns: patternMap.size
  };
}

/**
 * Analyze similar lines using ripgrep for better performance on large files.
 * Tries system ripgrep first, then VS Code's bundled ripgrep, then falls back to streaming.
 */
async function analyzeSimilarLinesRipgrep(
  filePath: string,
  format: DetectedFormat,
  fileDates: FileDates,
  topN: number
): Promise<SimilarLinesResult> {
  // Try system ripgrep first
  try {
    console.log('[SimilarLines] Attempting to use system ripgrep...');
    return await tryRipgrep('rg', filePath, format, fileDates, topN);
  } catch (error) {
    console.log('[SimilarLines] System ripgrep failed, trying VS Code bundled ripgrep...');
    
    // Try VS Code's bundled ripgrep
    const vscodeRg = findVSCodeRipgrep();
    if (vscodeRg) {
      try {
        return await tryRipgrep(vscodeRg, filePath, format, fileDates, topN);
      } catch (error) {
        console.log('[SimilarLines] VS Code ripgrep failed, falling back to streaming');
      }
    }
    
    // Fall back to streaming
    console.log('[SimilarLines] Using streaming method');
    return analyzeSimilarLinesStreaming(filePath, format, fileDates, topN);
  }
}

/**
 * Try to use ripgrep with a specific command path
 */
function tryRipgrep(
  rgCommand: string,
  filePath: string,
  format: DetectedFormat,
  fileDates: FileDates,
  topN: number
): Promise<SimilarLinesResult> {
  console.log(`[SimilarLines] Trying ripgrep command: ${rgCommand}`);
  
  return new Promise((resolve, reject) => {
    const patternMap = new Map<string, {
      count: number;
      firstTs: Date;
      lastTs: Date;
      exampleLine: string;
    }>();

    let totalLinesAnalyzed = 0;

    // Convert the regex to a string suitable for ripgrep
    // Extract the regex pattern from the RegExp object
    let regexPattern = format.regex.source;
    
    // Remove ^ anchor if present (ripgrep doesn't need it for line matching)
    if (regexPattern.startsWith('^')) {
      regexPattern = regexPattern.substring(1);
    }
    
    console.log(`[SimilarLines] Using regex pattern for ripgrep: ${regexPattern}`);
    
    // Spawn ripgrep process
    // --no-heading: don't group by file
    // --line-number: include line numbers
    // --no-filename: don't include filename in output
    const rg = spawn(rgCommand, [
      '--no-heading',
      '--line-number',
      '--no-filename',
      regexPattern,
      filePath
    ]);

    let buffer = '';
    let linesProcessed = 0;

    rg.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        
        linesProcessed++;
        
        // Parse line number and content (format: "123:log line content")
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          console.warn(`[SimilarLines] Could not parse line: ${line.substring(0, 50)}...`);
          continue;
        }
        
        const content = line.substring(colonIndex + 1);
        const prefix = content.substring(0, 100);
        const match = prefix.match(format.regex);
        
        if (match) {
          const ts = format.parseFunc(match[0], fileDates);
          if (ts) {
            totalLinesAnalyzed++;
            
            const normalized = normalizeLine(content, match[0]);
            
            if (patternMap.has(normalized)) {
              const entry = patternMap.get(normalized)!;
              entry.count++;
              entry.lastTs = ts;
            } else {
              patternMap.set(normalized, {
                count: 1,
                firstTs: ts,
                lastTs: ts,
                exampleLine: content
              });
            }
          }
        }
      }
    });

    rg.stderr.on('data', (data) => {
      console.error(`[SimilarLines] ripgrep stderr: ${data}`);
    });

    rg.on('error', (error) => {
      // ripgrep not available, reject so caller can try fallback
      reject(error);
    });

    rg.on('close', (code) => {
      console.log(`[SimilarLines] ripgrep process closed with code ${code}`);
      console.log(`[SimilarLines] Processed ${linesProcessed} lines from ripgrep output`);
      console.log(`[SimilarLines] Analyzed ${totalLinesAnalyzed} lines with valid timestamps`);
      console.log(`[SimilarLines] Found ${patternMap.size} unique patterns`);
      
      // If the process failed, reject
      if (code !== 0 && code !== 1) {
        // Exit code 1 means no matches found, which is ok
        // Other non-zero codes indicate errors
        reject(new Error(`ripgrep exited with code ${code}`));
        return;
      }
      
      // Process any remaining buffer
      if (buffer.trim()) {
        const colonIndex = buffer.indexOf(':');
        if (colonIndex !== -1) {
          const content = buffer.substring(colonIndex + 1);
          const prefix = content.substring(0, 100);
          const match = prefix.match(format.regex);
          
          if (match) {
            const ts = format.parseFunc(match[0], fileDates);
            if (ts) {
              totalLinesAnalyzed++;
              const normalized = normalizeLine(content, match[0]);
              
              if (patternMap.has(normalized)) {
                const entry = patternMap.get(normalized)!;
                entry.count++;
                entry.lastTs = ts;
              } else {
                patternMap.set(normalized, {
                  count: 1,
                  firstTs: ts,
                  lastTs: ts,
                  exampleLine: content
                });
              }
            }
          }
        }
      }

      // Convert to array and sort by count
      const sortedLines = Array.from(patternMap.entries())
        .map(([pattern, data]) => ({
          pattern,
          count: data.count,
          firstTimestamp: data.firstTs,
          lastTimestamp: data.lastTs,
          exampleLine: data.exampleLine
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);

      resolve({
        lines: sortedLines,
        totalLinesAnalyzed,
        totalUniquePatterns: patternMap.size
      });
    });
  });
}

/**
 * Find the top N most frequent similar lines in a log file.
 * Uses ripgrep for performance on large files, with fallback to streaming.
 */
export async function findTopSimilarLines(
  filePath: string,
  format: DetectedFormat,
  fileDates: FileDates,
  topN = 20
): Promise<SimilarLinesResult> {
  // Try ripgrep first for better performance
  return analyzeSimilarLinesRipgrep(filePath, format, fileDates, topN);
}
