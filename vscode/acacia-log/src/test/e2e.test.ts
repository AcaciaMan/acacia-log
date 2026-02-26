/**
 * End-to-end integration tests for the Acacia Log VS Code extension.
 *
 * These tests run inside a real VS Code instance via @vscode/test-electron
 * and exercise the extension's commands, providers, and features with real
 * VS Code APIs — no mocking.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  HOW TO RUN
 *
 *  1. Compile TypeScript first:
 *       npm run compile-tests
 *
 *  2. Run the E2E tests:
 *       npm run test:e2e
 *
 *  The test runner downloads a copy of VS Code (if needed), opens the
 *  `test-fixtures/` workspace, activates the extension, and runs these
 *  Mocha tests inside that VS Code instance.
 * ──────────────────────────────────────────────────────────────────────────
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Guard: these tests use Mocha's `suite`/`test` globals which are only
// available inside the VS Code test runner (@vscode/test-electron).
// When Jest accidentally picks up this file, skip gracefully.
if (typeof suite === 'undefined') {
  // Running under Jest — provide a stub so the file doesn't crash.
  describe('e2e (skipped — run via npm run test:e2e)', () => {
    it('is a placeholder', () => { /* intentionally empty */ });
  });
} else {

suite('Acacia Log E2E Tests', () => {
  // Paths relative to the compiled output location (out/test/)
  const fixturesDir = path.join(__dirname, '../../test-fixtures');
  const sampleLogPath = path.join(fixturesDir, 'sample.log');
  const sampleJsonlPath = path.join(fixturesDir, 'sample.jsonl');
  const patternsPath = path.join(fixturesDir, '.vscode/logPatterns.json');

  // ── Extension Activation ───────────────────────────────────────────────

  suite('Extension Activation', () => {
    test('Extension is present', () => {
      const ext = vscode.extensions.getExtension('manacacia.acacia-log');
      assert.ok(ext, 'Extension manacacia.acacia-log should be installed');
    });

    test('Extension activates successfully', async () => {
      const ext = vscode.extensions.getExtension('manacacia.acacia-log');
      assert.ok(ext, 'Extension should be present');

      if (!ext.isActive) {
        await ext.activate();
      }
      assert.strictEqual(ext.isActive, true, 'Extension should be active');
    });

    test('All expected commands are registered', async () => {
      const allCommands = await vscode.commands.getCommands(true);

      const expectedCommands = [
        'extension.setLogDateFormat',
        'extension.setLogDateRegex',
        'extension.setLogSearchDate',
        'extension.setLogSearchTime',
        'extension.calculateSimilarLineCounts',
        'extension.drawLogTimeline',
        'acacia-log.helloWorld',
        'acacia-log.loadMoreAbove',
        'acacia-log.loadMoreBelow',
        'acacia-log.toggleLensDecorations',
        'acacia-log.logExplorer.refresh',
        'acacia-log.logExplorer.addFolder',
        'acacia-log.logExplorer.removeFolder',
        'acacia-log.logExplorer.openFile',
        'acacia-log.logExplorer.showFileInfo',
        'acacia-log.logExplorer.revealInExplorer',
        'acacia-log.logExplorer.generateGapReport',
        'acacia-log.logExplorer.generateChunkStatsReport',
        'acacia-log.logExplorer.compareChunkStats',
        'acacia-log.logExplorer.convertJsonlToLog',
        'acacia-log.logExplorer.convertToJsonl',
        'acacia-log.logExplorer.filter',
        'acacia-log.logExplorer.clearFilter',
        'acacia-log.convertToJsonl',
        'acacia-log.openLogManagerPanel',
      ];

      for (const cmd of expectedCommands) {
        assert.ok(
          allCommands.includes(cmd),
          `Command "${cmd}" should be registered`
        );
      }
    });
  });

  // ── Log File Operations ─────────────────────────────────────────────────

  suite('Log File Operations', () => {
    test('Test fixture sample.log exists', () => {
      assert.ok(
        fs.existsSync(sampleLogPath),
        `Sample log should exist at ${sampleLogPath}`
      );
    });

    test('Open log file succeeds', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleLogPath);
      assert.ok(doc, 'Document should open');
      assert.ok(doc.lineCount > 0, 'Document should have content');
    });

    test('Log file has expected number of lines', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleLogPath);
      // 11 timestamped lines + 2 continuation lines = 13 lines (with trailing newline = 14)
      assert.ok(doc.lineCount >= 12, `Expected ≥12 lines, got ${doc.lineCount}`);
    });

    test('First line contains expected timestamp', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleLogPath);
      const firstLine = doc.lineAt(0).text;
      assert.ok(
        firstLine.includes('2026-01-15 10:00:00'),
        `First line should contain timestamp, got: ${firstLine}`
      );
    });

    test('Log file contains ERROR level entry', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleLogPath);
      let hasError = false;
      for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.includes('ERROR')) {
          hasError = true;
          break;
        }
      }
      assert.ok(hasError, 'Sample log should contain at least one ERROR line');
    });
  });

  // ── Settings ────────────────────────────────────────────────────────────

  suite('Settings', () => {
    test('Read acacia-log configuration', () => {
      const config = vscode.workspace.getConfiguration('acacia-log');
      assert.ok(config, 'Should be able to get configuration');
    });

    test('Update logDateFormat setting', async () => {
      const config = vscode.workspace.getConfiguration('acacia-log');
      const testFormat = 'yyyy-MM-dd HH:mm:ss';
      await config.update('logDateFormat', testFormat, vscode.ConfigurationTarget.Workspace);

      const updatedConfig = vscode.workspace.getConfiguration('acacia-log');
      const current = updatedConfig.get<string>('logDateFormat');
      assert.strictEqual(current, testFormat, 'logDateFormat should be updated');
    });

    test('Update logDateRegex setting', async () => {
      const config = vscode.workspace.getConfiguration('acacia-log');
      const testRegex = '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}';
      await config.update('logDateRegex', testRegex, vscode.ConfigurationTarget.Workspace);

      const updatedConfig = vscode.workspace.getConfiguration('acacia-log');
      const current = updatedConfig.get<string>('logDateRegex');
      assert.strictEqual(current, testRegex, 'logDateRegex should be updated');
    });

    test('Update logSearchDate setting', async () => {
      const config = vscode.workspace.getConfiguration('acacia-log');
      await config.update('logSearchDate', '2026-01-15', vscode.ConfigurationTarget.Workspace);

      const updatedConfig = vscode.workspace.getConfiguration('acacia-log');
      assert.strictEqual(
        updatedConfig.get<string>('logSearchDate'),
        '2026-01-15'
      );
    });

    test('Update logSearchTime setting', async () => {
      const config = vscode.workspace.getConfiguration('acacia-log');
      await config.update('logSearchTime', '10:00:05', vscode.ConfigurationTarget.Workspace);

      const updatedConfig = vscode.workspace.getConfiguration('acacia-log');
      assert.strictEqual(
        updatedConfig.get<string>('logSearchTime'),
        '10:00:05'
      );
    });
  });

  // ── Tree View ───────────────────────────────────────────────────────────

  suite('Tree View', () => {
    test('Log Explorer tree view command exists', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('acacia-log.logExplorer.refresh'),
        'Refresh command for logExplorer should exist'
      );
    });

    test('Refresh command runs without error', async () => {
      // Should not throw
      await vscode.commands.executeCommand('acacia-log.logExplorer.refresh');
    });
  });

  // ── Lens Decorations ───────────────────────────────────────────────────

  suite('Lens Decorations', () => {
    test('Toggle decorations command runs without error', async () => {
      await vscode.commands.executeCommand('acacia-log.toggleLensDecorations');
      // Toggle again to restore original state
      await vscode.commands.executeCommand('acacia-log.toggleLensDecorations');
    });
  });

  // ── JSONL Conversion ───────────────────────────────────────────────────

  suite('JSONL Conversion', () => {
    test('Test fixture sample.jsonl exists', () => {
      assert.ok(
        fs.existsSync(sampleJsonlPath),
        `Sample JSONL should exist at ${sampleJsonlPath}`
      );
    });

    test('Open JSONL file succeeds', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleJsonlPath);
      assert.ok(doc, 'JSONL document should open');
      assert.ok(doc.lineCount > 0, 'JSONL document should have content');
    });

    test('JSONL file contains valid JSON lines', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleJsonlPath);
      for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i).text.trim();
        if (line.length === 0) { continue; }
        assert.doesNotThrow(
          () => JSON.parse(line),
          `Line ${i + 1} should be valid JSON: ${line.substring(0, 60)}...`
        );
      }
    });

    test('JSONL entries have timestamp and text fields', async () => {
      const doc = await vscode.workspace.openTextDocument(sampleJsonlPath);
      const line = doc.lineAt(0).text.trim();
      const parsed = JSON.parse(line);
      assert.ok('timestamp' in parsed, 'Entry should have a timestamp field');
      assert.ok('text' in parsed, 'Entry should have a text field');
    });

    test('Convert log to JSONL command exists', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('acacia-log.convertToJsonl'),
        'convertToJsonl command should be registered'
      );
    });

    test('Convert JSONL to log command exists', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('acacia-log.logExplorer.convertJsonlToLog'),
        'convertJsonlToLog command should be registered'
      );
    });
  });

  // ── Pattern Search ─────────────────────────────────────────────────────

  suite('Pattern Search', () => {
    test('Test fixture logPatterns.json exists', () => {
      assert.ok(
        fs.existsSync(patternsPath),
        `logPatterns.json should exist at ${patternsPath}`
      );
    });

    test('logPatterns.json is valid JSON', () => {
      const content = fs.readFileSync(patternsPath, 'utf8');
      const parsed = JSON.parse(content);
      assert.ok(parsed.logPatterns, 'Should have logPatterns key');
    });

    test('logPatterns.json contains expected patterns', () => {
      const content = fs.readFileSync(patternsPath, 'utf8');
      const parsed = JSON.parse(content);
      assert.ok(parsed.logPatterns.error, 'Should have error pattern');
      assert.ok(parsed.logPatterns.warn, 'Should have warn pattern');
      assert.ok(parsed.logPatterns.info, 'Should have info pattern');
    });

    test('Pattern entries have regexp field', () => {
      const content = fs.readFileSync(patternsPath, 'utf8');
      const parsed = JSON.parse(content);
      for (const [key, pattern] of Object.entries(parsed.logPatterns)) {
        assert.ok(
          (pattern as any).regexp,
          `Pattern "${key}" should have a regexp field`
        );
      }
    });
  });

  // ── Navigate to Date/Time ──────────────────────────────────────────────

  suite('Navigate to Date/Time', () => {
    test('Set configuration and open log file for navigation', async () => {
      // Configure settings for the sample log format
      const config = vscode.workspace.getConfiguration('acacia-log');
      await config.update('logDateRegex', '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}', vscode.ConfigurationTarget.Workspace);
      await config.update('logDateFormat', 'yyyy-MM-dd HH:mm:ss', vscode.ConfigurationTarget.Workspace);
      await config.update('logSearchDate', '2026-01-15', vscode.ConfigurationTarget.Workspace);
      await config.update('logSearchTime', '10:00:10', vscode.ConfigurationTarget.Workspace);

      // Open the log file
      const doc = await vscode.workspace.openTextDocument(sampleLogPath);
      await vscode.window.showTextDocument(doc);

      // Verify the active editor points to the log file
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor, 'Should have an active editor');
      assert.ok(
        editor.document.uri.fsPath.endsWith('sample.log'),
        'Active editor should be sample.log'
      );
    });
  });

  // ── Hello World Smoke Test ─────────────────────────────────────────────

  suite('Smoke Tests', () => {
    test('Hello world command runs without error', async () => {
      await vscode.commands.executeCommand('acacia-log.helloWorld');
    });

    test('Multiple commands can be executed sequentially', async () => {
      await vscode.commands.executeCommand('acacia-log.logExplorer.refresh');
      await vscode.commands.executeCommand('acacia-log.toggleLensDecorations');
      await vscode.commands.executeCommand('acacia-log.toggleLensDecorations');
    });
  });
});

} // end else (Mocha guard)