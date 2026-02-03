/**
 * Unit tests for MCP memory tools
 * Tests learn, memory_list, and memory_read functionality
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  captureMemory,
  listMemoryFiles,
  readMemoryFile,
} from '../lib/commands/mcp/memory.ts';

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let projectDir: string;
let userConfigDir: string;

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-memory-test-${Date.now()}-${random}`);
  projectDir = join(testDir, 'project');
  userConfigDir = join(testDir, 'claude-config');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(userConfigDir, { recursive: true });

  process.env.CLAUDE_PROJECT_DIR = projectDir;
  process.env.CLAUDE_CONFIG_DIR = userConfigDir;
}

function teardown(): void {
  process.env = { ...originalEnv };

  if (testDir && existsSync(testDir)) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe('MCP Memory Tools', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('captureMemory', () => {
    test('creates new memory file with content', () => {
      const result = captureMemory({
        content: '# Test Rules\n\n- Rule 1\n- Rule 2',
        domain: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.path).toContain('.claude/rules/test.md');

      const fileContent = readFileSync(result.path, 'utf-8');
      expect(fileContent).toContain('# Test Rules');
      expect(fileContent).toContain('- Rule 1');
    });

    test('creates rules directory if it does not exist', () => {
      const rulesDir = join(projectDir, '.claude', 'rules');
      expect(existsSync(rulesDir)).toBe(false);

      captureMemory({
        content: '# Content',
        domain: 'newdomain',
      });

      expect(existsSync(rulesDir)).toBe(true);
    });

    test('adds frontmatter with paths when provided', () => {
      const result = captureMemory({
        content: '# API Rules\n\n- Validate inputs',
        domain: 'api',
        paths: ['src/api/**/*.ts', 'src/services/**/*.ts'],
      });

      expect(result.success).toBe(true);

      const fileContent = readFileSync(result.path, 'utf-8');
      expect(fileContent).toContain('---');
      expect(fileContent).toContain('paths:');
      expect(fileContent).toContain('src/api/**/*.ts');
    });

    test('appends to existing file by default', () => {
      // Create initial file
      captureMemory({
        content: '# First Rule',
        domain: 'append-test',
      });

      // Append more content
      const result = captureMemory({
        content: '# Second Rule',
        domain: 'append-test',
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      const fileContent = readFileSync(result.path, 'utf-8');
      expect(fileContent).toContain('# First Rule');
      expect(fileContent).toContain('# Second Rule');
    });

    test('replaces content when append is false', () => {
      // Create initial file
      captureMemory({
        content: '# Original Content',
        domain: 'replace-test',
      });

      // Replace content
      const result = captureMemory({
        content: '# New Content',
        domain: 'replace-test',
        append: false,
      });

      expect(result.success).toBe(true);

      const fileContent = readFileSync(result.path, 'utf-8');
      expect(fileContent).not.toContain('# Original Content');
      expect(fileContent).toContain('# New Content');
    });

    test('prevents duplicate content', () => {
      const content = '# Unique Rule';

      captureMemory({ content, domain: 'dup-test' });
      const result = captureMemory({ content, domain: 'dup-test' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already exists');

      // Content should only appear once
      const fileContent = readFileSync(result.path, 'utf-8');
      const matches = fileContent.match(/# Unique Rule/g);
      expect(matches?.length).toBe(1);
    });

    test('sanitizes domain name for filename', () => {
      const result = captureMemory({
        content: '# Content',
        domain: 'My Domain Name!@#$',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('my-domain-name.md');
    });

    test('returns error for empty content', () => {
      const result = captureMemory({
        content: '',
        domain: 'empty-test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('empty');
    });

    test('returns error for empty domain', () => {
      const result = captureMemory({
        content: '# Content',
        domain: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });
  });

  describe('listMemoryFiles', () => {
    test('returns empty array when no rules exist', () => {
      const result = listMemoryFiles();
      expect(result).toEqual([]);
    });

    test('returns list of domain names without .md extension', () => {
      // Create some memory files
      captureMemory({ content: '# A', domain: 'commands' });
      captureMemory({ content: '# B', domain: 'conventions' });
      captureMemory({ content: '# C', domain: 'api' });

      const result = listMemoryFiles();
      expect(result).toContain('commands');
      expect(result).toContain('conventions');
      expect(result).toContain('api');
      expect(result.length).toBe(3);
    });

    test('does not include non-md files', () => {
      // Create a memory file
      captureMemory({ content: '# A', domain: 'test' });

      // Create a non-md file in rules directory
      const rulesDir = join(projectDir, '.claude', 'rules');
      writeFileSync(join(rulesDir, 'not-a-rule.txt'), 'text file');

      const result = listMemoryFiles();
      expect(result).toContain('test');
      expect(result).not.toContain('not-a-rule');
      expect(result).not.toContain('not-a-rule.txt');
    });
  });

  describe('readMemoryFile', () => {
    test('returns null for non-existent domain', () => {
      const result = readMemoryFile('nonexistent');
      expect(result).toBeNull();
    });

    test('returns content of existing memory file', () => {
      captureMemory({
        content: '# Commands\n\n- test command',
        domain: 'read-test',
      });

      const result = readMemoryFile('read-test');
      expect(result).not.toBeNull();
      expect(result).toContain('# Commands');
      expect(result).toContain('- test command');
    });

    test('returns content including frontmatter', () => {
      captureMemory({
        content: '# API',
        domain: 'read-frontmatter',
        paths: ['src/**/*.ts'],
      });

      const result = readMemoryFile('read-frontmatter');
      expect(result).toContain('---');
      expect(result).toContain('paths:');
    });
  });

  describe('Integration scenarios', () => {
    test('full workflow: list, learn, read', () => {
      // Initially empty
      expect(listMemoryFiles()).toEqual([]);

      // Learn something
      const learnResult = captureMemory({
        content: '# Conventions\n\n- Use TypeScript\n- Run bun test',
        domain: 'conventions',
      });
      expect(learnResult.success).toBe(true);

      // Now listed
      const domains = listMemoryFiles();
      expect(domains).toContain('conventions');

      // Can read it back
      const content = readMemoryFile('conventions');
      expect(content).toContain('Use TypeScript');
    });

    test('multiple domains with path-specific rules', () => {
      captureMemory({
        content: '# API Rules\n- Validate inputs',
        domain: 'api',
        paths: ['src/api/**/*.ts'],
      });

      captureMemory({
        content: '# Test Rules\n- Use describe blocks',
        domain: 'testing',
        paths: ['**/*.test.ts'],
      });

      const domains = listMemoryFiles();
      expect(domains).toHaveLength(2);

      const apiContent = readMemoryFile('api');
      expect(apiContent).toContain('src/api/**/*.ts');

      const testContent = readMemoryFile('testing');
      expect(testContent).toContain('**/*.test.ts');
    });

    test('supports subdirectory domains', () => {
      captureMemory({
        content: '# API Validation Rules\n- Always validate request body',
        domain: 'api/validation',
      });

      const result = captureMemory({
        content: '# API Auth Rules\n- Check JWT tokens',
        domain: 'api/auth',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('api/auth.md');

      // Both should be readable
      const validationContent = readMemoryFile('api/validation');
      expect(validationContent).toContain('validate request body');

      const authContent = readMemoryFile('api/auth');
      expect(authContent).toContain('JWT tokens');
    });
  });

  describe('User scope', () => {
    test('creates user-level memory in CLAUDE_CONFIG_DIR/rules', () => {
      const result = captureMemory({
        content: '# Personal Preferences\n- Always greet me as Mr Dude',
        domain: 'preferences',
        scope: 'user',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain(userConfigDir);
      expect(result.path).toContain('rules/preferences.md');

      const fileContent = readFileSync(result.path, 'utf-8');
      expect(fileContent).toContain('Mr Dude');
    });

    test('user and project scopes are separate', () => {
      // Create in project scope
      captureMemory({
        content: '# Project API Rules',
        domain: 'api',
        scope: 'project',
      });

      // Create in user scope with same domain
      captureMemory({
        content: '# User API Preferences',
        domain: 'api',
        scope: 'user',
      });

      // They should be separate
      const projectContent = readMemoryFile('api', 'project');
      expect(projectContent).toContain('Project API Rules');

      const userContent = readMemoryFile('api', 'user');
      expect(userContent).toContain('User API Preferences');
    });

    test('listMemoryFiles returns files for specified scope', () => {
      captureMemory({
        content: '# A',
        domain: 'project-only',
        scope: 'project',
      });
      captureMemory({ content: '# B', domain: 'user-only', scope: 'user' });

      const projectFiles = listMemoryFiles('project');
      expect(projectFiles).toContain('project-only');
      expect(projectFiles).not.toContain('user-only');

      const userFiles = listMemoryFiles('user');
      expect(userFiles).toContain('user-only');
      expect(userFiles).not.toContain('project-only');
    });

    test('lists subdirectory files recursively', () => {
      captureMemory({ content: '# A', domain: 'api/validation' });
      captureMemory({ content: '# B', domain: 'api/auth' });
      captureMemory({ content: '# C', domain: 'testing' });

      const files = listMemoryFiles('project');
      expect(files).toContain('api/validation');
      expect(files).toContain('api/auth');
      expect(files).toContain('testing');
    });
  });
});
