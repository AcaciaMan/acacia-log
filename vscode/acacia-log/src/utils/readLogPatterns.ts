import * as fs from 'fs';
import * as path from 'path';

interface LogPattern {
  regexp: string;
  regexpoptions: string;
  bSearch: boolean;
}

interface LogPatterns {
  [key: string]: LogPattern;
}

interface LogPatternsFile {
  logPatterns: LogPatterns;
}

export function readLogPatterns(filePath: string): { key: string, regexp: string, regexpoptions: string }[] {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  const logPatternsFile: LogPatternsFile = JSON.parse(fileContent);

  let logPatternsObj = Object.entries(logPatternsFile.logPatterns)
  .filter(([_, pattern]) => pattern.bSearch)
  .map(([key, pattern]) => ({ key, regexp: pattern.regexp, regexpoptions: pattern.regexpoptions }));

  // check if regexpoptions is missing g flag, add it
  logPatternsObj = logPatternsObj.map(pattern => {
    if (!pattern.regexpoptions.includes('g')) {
      pattern.regexpoptions += 'g';
    }
    return pattern;
  });


  return logPatternsObj;
  
  
}