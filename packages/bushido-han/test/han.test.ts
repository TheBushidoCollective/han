import { strictEqual } from 'node:assert';
import {
  type ExecSyncOptionsWithStringEncoding,
  execSync,
} from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test runs from dist/test, so go up to dist, then to lib/main.js
const binPath = join(__dirname, '..', 'lib', 'main.js');

function setup(): string {
  const testDir = join(__dirname, 'fixtures');
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

function teardown(): void {
  const testDir = join(__dirname, 'fixtures');
  rmSync(testDir, { recursive: true, force: true });
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error((error as Error).message);
    process.exit(1);
  }
}

interface ExecError extends Error {
  status?: number;
  code?: number;
  stderr?: Buffer | string;
}

// Test: shows help when no command provided
test('shows help when no command provided', () => {
  try {
    execSync(`node ${binPath} --help`, { encoding: 'utf8' });
    // Help command should exit with 0
  } catch (error) {
    const execError = error as ExecError;
    const stdout = execError.message || '';
    strictEqual(stdout.includes('Usage:') || stdout.includes('han'), true);
  }
});

// Test: shows error when validate has no command argument
test('shows error when validate has no command argument', () => {
  try {
    execSync(`node ${binPath} validate`, { encoding: 'utf8' });
    throw new Error('Should have failed');
  } catch (error) {
    const execError = error as ExecError;
    strictEqual(execError.status, 1);
    const stderr = execError.stderr?.toString() || '';
    strictEqual(
      stderr.includes('missing required argument') ||
        stderr.includes('error') ||
        stderr.length > 0,
      true
    );
  }
});

// Test: passes when no directories match filter
test('passes when no directories match filter', () => {
  const testDir = setup();
  try {
    const output = execSync(
      `node ${binPath} validate --dirs-with nonexistent.txt echo test`,
      { cwd: testDir, encoding: 'utf8' } as ExecSyncOptionsWithStringEncoding
    );
    strictEqual(
      output.includes('No directories found with nonexistent.txt'),
      true
    );
  } finally {
    teardown();
  }
});

// Test: runs command in matching directories
test('runs command in matching directories', () => {
  const testDir = setup();
  try {
    // Create test structure
    mkdirSync(join(testDir, 'pkg1'));
    mkdirSync(join(testDir, 'pkg2'));
    writeFileSync(join(testDir, 'pkg1', 'package.json'), '{}');
    writeFileSync(join(testDir, 'pkg2', 'package.json'), '{}');

    // Initialize git repo so directories are discovered
    execSync('git init', { cwd: testDir });
    execSync('git add .', { cwd: testDir });

    const output = execSync(
      `node ${binPath} validate --dirs-with package.json echo success`,
      {
        cwd: testDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      } as ExecSyncOptionsWithStringEncoding
    );

    strictEqual(output.includes('success'), true);
    strictEqual(output.includes('passed validation'), true);
  } finally {
    teardown();
  }
});

// Test: fails with exit code 2 when command fails
test('fails with exit code 2 when command fails', () => {
  const testDir = setup();
  try {
    mkdirSync(join(testDir, 'pkg1'));
    writeFileSync(join(testDir, 'pkg1', 'package.json'), '{}');

    // Initialize git repo
    execSync('git init', { cwd: testDir });
    execSync('git add .', { cwd: testDir });

    try {
      execSync(`node ${binPath} validate --dirs-with package.json exit 1`, {
        cwd: testDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      throw new Error('Should have failed');
    } catch (error) {
      const execError = error as ExecError;
      const exitCode = execError.status || execError.code;
      strictEqual(exitCode, 2, `Expected exit code 2, got ${exitCode}`);
      const stderr = execError.stderr?.toString() || '';
      strictEqual(
        stderr.includes('failed validation') || stderr.includes('Failed when'),
        true
      );
    }
  } finally {
    teardown();
  }
});

// Test: stops on first failure with --fail-fast
test('stops on first failure with --fail-fast', () => {
  const testDir = setup();
  try {
    mkdirSync(join(testDir, 'pkg1'));
    mkdirSync(join(testDir, 'pkg2'));
    writeFileSync(join(testDir, 'pkg1', 'package.json'), '{}');
    writeFileSync(join(testDir, 'pkg2', 'package.json'), '{}');

    // Initialize git repo
    execSync('git init', { cwd: testDir });
    execSync('git add .', { cwd: testDir });

    try {
      execSync(
        `node ${binPath} validate --fail-fast --dirs-with package.json exit 1`,
        { cwd: testDir, encoding: 'utf8', stdio: 'pipe' }
      );
      throw new Error('Should have failed');
    } catch (error) {
      const execError = error as ExecError;
      const exitCode = execError.status || execError.code;
      strictEqual(exitCode, 2, `Expected exit code 2, got ${exitCode}`);
      const stderr = execError.stderr?.toString() || '';
      strictEqual(stderr.includes('Failed when trying to run'), true);
    }
  } finally {
    teardown();
  }
});

console.log('\nAll tests passed! ✓');
