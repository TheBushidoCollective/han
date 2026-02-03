/**
 * Unit tests for hash-cycle-detector.ts
 * Tests hash cycle detection for hook recursion prevention
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type CycleDetectionResult,
  HashCycleDetector,
} from '../lib/hooks/index.ts';

let testDir: string;
let projectDir: string;

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-cycle-detect-test-${Date.now()}-${random}`);
  projectDir = join(testDir, 'project');
  mkdirSync(projectDir, { recursive: true });
}

function teardown(): void {
  if (testDir && existsSync(testDir)) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe('HashCycleDetector', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('recordHashes - basic functionality', () => {
    test('records initial hashes without detecting cycles', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'content');

      const detector = new HashCycleDetector();
      const result = detector.recordHashes(projectDir, ['**/*.ts'], null);

      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
    });

    test('tracks multiple files independently', () => {
      writeFileSync(join(projectDir, 'a.ts'), 'content a');
      writeFileSync(join(projectDir, 'b.ts'), 'content b');

      const detector = new HashCycleDetector();
      const result = detector.recordHashes(projectDir, ['**/*.ts'], null);

      expect(result.hasCycle).toBe(false);

      // buildManifest uses relative paths as keys
      const historyA = detector.getModificationHistory('a.ts');
      const historyB = detector.getModificationHistory('b.ts');

      // Both files should have one entry each
      expect(historyA.length).toBe(1);
      expect(historyB.length).toBe(1);
    });

    test('records hook info for each hash transition', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'original');

      const detector = new HashCycleDetector();

      // Initial capture (no hook info)
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // Modify file and record with hook info
      writeFileSync(join(projectDir, 'file.ts'), 'modified by biome');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'jutsu-biome',
        hook: 'lint',
        directory: projectDir,
      });

      // buildManifest uses relative paths as keys
      const history = detector.getModificationHistory('file.ts');

      expect(history.length).toBe(2);
      expect(history[0].hook).toBe('initial/capture');
      expect(history[1].hook).toBe('jutsu-biome/lint');
    });

    test('does not record duplicate consecutive hashes', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'content');

      const detector = new HashCycleDetector();

      // Record same hash multiple times
      detector.recordHashes(projectDir, ['**/*.ts'], null);
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'plugin-a',
        hook: 'hook-a',
        directory: projectDir,
      });
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'plugin-b',
        hook: 'hook-b',
        directory: projectDir,
      });

      // buildManifest uses relative paths as keys
      const history = detector.getModificationHistory('file.ts');

      // Should only have one entry since content never changed
      expect(history.length).toBe(1);
    });
  });

  describe('recordHashes - cycle detection', () => {
    test('detects cycle when file returns to previous hash', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      // Initial state A
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // Change to state B
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'biome',
        hook: 'lint',
        directory: projectDir,
      });

      // Change back to state A - CYCLE!
      writeFileSync(join(projectDir, 'file.ts'), 'state A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'eslint',
        hook: 'fix',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(1);
      expect(result.cycles[0].filePath).toContain('file.ts');
      expect(result.cycles[0].previouslySeenAt).toBe(0); // First hash was at index 0
    });

    test('detects cycle in A->B->C->A pattern', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      // State A
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // State B
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // State C
      writeFileSync(join(projectDir, 'file.ts'), 'state C');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      // Back to state A - CYCLE!
      writeFileSync(join(projectDir, 'file.ts'), 'state A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook3',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
      expect(result.cycles[0].previouslySeenAt).toBe(0);
    });

    test('detects cycle in A->B->A->B pattern (immediate cycle)', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      // State A
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // State B
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'biome',
        hook: 'lint',
        directory: projectDir,
      });

      // Back to A (cycle detected here)
      writeFileSync(join(projectDir, 'file.ts'), 'state A');
      const result1 = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'eslint',
        hook: 'fix',
        directory: projectDir,
      });

      expect(result1.hasCycle).toBe(true);

      // Back to B (another cycle)
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      const result2 = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'biome',
        hook: 'lint',
        directory: projectDir,
      });

      expect(result2.hasCycle).toBe(true);
    });

    test('no cycle when file changes to new state', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      // State A
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // State B
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // State C (new state, not a cycle)
      writeFileSync(join(projectDir, 'file.ts'), 'state C');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(false);
    });

    test('detects cycles in multiple files simultaneously', () => {
      writeFileSync(join(projectDir, 'a.ts'), 'file A state 1');
      writeFileSync(join(projectDir, 'b.ts'), 'file B state 1');

      const detector = new HashCycleDetector();

      // Initial state
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // Change both files
      writeFileSync(join(projectDir, 'a.ts'), 'file A state 2');
      writeFileSync(join(projectDir, 'b.ts'), 'file B state 2');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // Revert both files - two cycles!
      writeFileSync(join(projectDir, 'a.ts'), 'file A state 1');
      writeFileSync(join(projectDir, 'b.ts'), 'file B state 1');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(2);
    });

    test('detects cycle in only one of multiple files', () => {
      writeFileSync(join(projectDir, 'cycling.ts'), 'state A');
      writeFileSync(join(projectDir, 'normal.ts'), 'content 1');

      const detector = new HashCycleDetector();

      // Initial
      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // Change both
      writeFileSync(join(projectDir, 'cycling.ts'), 'state B');
      writeFileSync(join(projectDir, 'normal.ts'), 'content 2');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // Only cycling.ts goes back
      writeFileSync(join(projectDir, 'cycling.ts'), 'state A');
      writeFileSync(join(projectDir, 'normal.ts'), 'content 3');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(1);
      expect(result.cycles[0].filePath).toContain('cycling.ts');
    });
  });

  describe('getModificationHistory', () => {
    test('returns empty array for unknown file', () => {
      const detector = new HashCycleDetector();

      const history = detector.getModificationHistory('nonexistent/file.ts');

      expect(history).toEqual([]);
    });

    test('returns full modification history with truncated hashes', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state 1');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      writeFileSync(join(projectDir, 'file.ts'), 'state 2');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'biome',
        hook: 'lint',
        directory: projectDir,
      });

      writeFileSync(join(projectDir, 'file.ts'), 'state 3');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'prettier',
        hook: 'format',
        directory: projectDir,
      });

      // buildManifest uses relative paths as keys
      const history = detector.getModificationHistory('file.ts');

      expect(history.length).toBe(3);
      // Hashes should be truncated to 8 chars
      expect(history[0].hash.length).toBe(8);
      expect(history[1].hash.length).toBe(8);
      expect(history[2].hash.length).toBe(8);

      // All hashes should be different
      expect(history[0].hash).not.toBe(history[1].hash);
      expect(history[1].hash).not.toBe(history[2].hash);

      // Hook info should be correct
      expect(history[0].hook).toBe('initial/capture');
      expect(history[1].hook).toBe('biome/lint');
      expect(history[2].hook).toBe('prettier/format');
    });
  });

  describe('formatCycleReport', () => {
    test('returns empty string when no cycles', () => {
      const detector = new HashCycleDetector();

      const result: CycleDetectionResult = {
        hasCycle: false,
        cycles: [],
      };

      expect(detector.formatCycleReport(result)).toBe('');
    });

    test('formats cycle report with modification history', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'biome',
        hook: 'lint',
        directory: projectDir,
      });

      writeFileSync(join(projectDir, 'file.ts'), 'state A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'eslint',
        hook: 'fix',
        directory: projectDir,
      });

      const report = detector.formatCycleReport(result);

      expect(report).toContain('RECURSION DETECTED');
      expect(report).toContain('file.ts');
      expect(report).toContain('previously seen');
      expect(report).toContain('Modification history');
      expect(report).toContain('initial/capture');
      expect(report).toContain('biome/lint');
      expect(report).toContain('eslint/fix');
      expect(report).toContain('<-- cycle');
      expect(report).toContain('two hooks are modifying the same file');
    });
  });

  describe('reset', () => {
    test('clears all tracked history', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'content');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // buildManifest uses relative paths as keys
      let history = detector.getModificationHistory('file.ts');
      expect(history.length).toBe(1);

      detector.reset();

      history = detector.getModificationHistory('file.ts');
      expect(history.length).toBe(0);
    });

    test('allows fresh tracking after reset', () => {
      writeFileSync(join(projectDir, 'file.ts'), 'state A');

      const detector = new HashCycleDetector();

      // Create a cycle situation
      detector.recordHashes(projectDir, ['**/*.ts'], null);
      writeFileSync(join(projectDir, 'file.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // Reset
      detector.reset();

      // Now going back to state A should not be a cycle
      // because we reset the history
      writeFileSync(join(projectDir, 'file.ts'), 'state A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], null);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles empty directory', () => {
      const detector = new HashCycleDetector();
      const result = detector.recordHashes(projectDir, ['**/*.ts'], null);

      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
    });

    test('handles nested directories', () => {
      mkdirSync(join(projectDir, 'src', 'utils'), { recursive: true });
      writeFileSync(join(projectDir, 'src', 'index.ts'), 'state A');
      writeFileSync(join(projectDir, 'src', 'utils', 'helper.ts'), 'helper A');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      // Modify both
      writeFileSync(join(projectDir, 'src', 'index.ts'), 'state B');
      writeFileSync(join(projectDir, 'src', 'utils', 'helper.ts'), 'helper B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // Only nested file reverts
      writeFileSync(join(projectDir, 'src', 'utils', 'helper.ts'), 'helper A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(1);
      expect(result.cycles[0].filePath).toContain('helper.ts');
    });

    test('handles files with special characters', () => {
      writeFileSync(join(projectDir, 'my-file.test.ts'), 'state A');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      writeFileSync(join(projectDir, 'my-file.test.ts'), 'state B');
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      writeFileSync(join(projectDir, 'my-file.test.ts'), 'state A');
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
    });

    test('handles very long file content changes', () => {
      const longContent1 = 'a'.repeat(10000);
      const longContent2 = 'b'.repeat(10000);

      writeFileSync(join(projectDir, 'large.ts'), longContent1);

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts'], null);

      writeFileSync(join(projectDir, 'large.ts'), longContent2);
      detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      writeFileSync(join(projectDir, 'large.ts'), longContent1);
      const result = detector.recordHashes(projectDir, ['**/*.ts'], {
        plugin: 'hook2',
        hook: 'run',
        directory: projectDir,
      });

      expect(result.hasCycle).toBe(true);
    });

    test('handles multiple glob patterns', () => {
      writeFileSync(join(projectDir, 'app.ts'), 'ts state A');
      writeFileSync(join(projectDir, 'style.css'), 'css state A');

      const detector = new HashCycleDetector();

      detector.recordHashes(projectDir, ['**/*.ts', '**/*.css'], null);

      writeFileSync(join(projectDir, 'app.ts'), 'ts state B');
      writeFileSync(join(projectDir, 'style.css'), 'css state B');
      detector.recordHashes(projectDir, ['**/*.ts', '**/*.css'], {
        plugin: 'hook1',
        hook: 'run',
        directory: projectDir,
      });

      // Only CSS file reverts
      writeFileSync(join(projectDir, 'style.css'), 'css state A');
      const result = detector.recordHashes(
        projectDir,
        ['**/*.ts', '**/*.css'],
        {
          plugin: 'hook2',
          hook: 'run',
          directory: projectDir,
        }
      );

      expect(result.hasCycle).toBe(true);
      expect(result.cycles.length).toBe(1);
      expect(result.cycles[0].filePath).toContain('style.css');
    });
  });
});
