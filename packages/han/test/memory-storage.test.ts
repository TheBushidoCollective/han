/**
 * Unit tests for Han Memory storage layer
 * Tests path resolution, observation storage, and search functionality
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createMemoryStore,
  generateId,
  getProjectIndexPath,
  type IndexedObservation,
  normalizeGitRemote,
  type RawObservation,
  type SessionSummary,
  setMemoryRoot,
} from '../lib/memory/index.ts';

/**
 * Clean up any existing observations for a gitRemote.
 * Re-asserts memoryRootOverride before cleanup to guard against
 * parallel tests racing on the shared global setMemoryRoot.
 */
function cleanupGitRemote(gitRemote: string): void {
  try {
    // Re-assert our test's memory root in case a parallel test changed it
    setMemoryRoot(testDir);
    const indexPath = getProjectIndexPath(gitRemote);
    const dataFile = `${indexPath}/observations.jsonl`;
    if (existsSync(dataFile)) {
      rmSync(dataFile);
    }
  } catch {
    // Ignore cleanup errors
  }
}

let testDir: string;

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-memory-test-${Date.now()}-${random}`);
  mkdirSync(testDir, { recursive: true });

  // Override memory root to use test directory
  setMemoryRoot(testDir);
}

function teardown(): void {
  // Reset memory root
  setMemoryRoot(null);

  if (testDir && existsSync(testDir)) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe('Memory Path Resolution', () => {
  describe('normalizeGitRemote', () => {
    test('normalizes SSH git URL', () => {
      expect(normalizeGitRemote('git@github.com:org/repo.git')).toBe(
        'github.com_org_repo'
      );
    });

    test('normalizes HTTPS git URL', () => {
      expect(normalizeGitRemote('https://github.com/org/repo')).toBe(
        'github.com_org_repo'
      );
    });

    test('normalizes HTTPS git URL with .git suffix', () => {
      expect(normalizeGitRemote('https://github.com/org/repo.git')).toBe(
        'github.com_org_repo'
      );
    });

    test('normalizes GitLab URL', () => {
      expect(normalizeGitRemote('git@gitlab.com:team/project.git')).toBe(
        'gitlab.com_team_project'
      );
    });

    test('normalizes nested paths', () => {
      expect(
        normalizeGitRemote('https://github.com/org/team/nested/repo')
      ).toBe('github.com_org_team_nested_repo');
    });
  });

  describe('generateId', () => {
    test('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    test('generates IDs with timestamp prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });
});

describe('Memory Storage', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('Personal Memory', () => {
    test('returns empty array when no observations exist', () => {
      const store = createMemoryStore();
      const observations = store.getSessionObservations('nonexistent');
      expect(observations).toEqual([]);
    });

    test('returns empty array when no summaries exist', () => {
      const store = createMemoryStore();
      const recent = store.getRecentSessions(5);
      expect(recent).toEqual([]);
    });

    test('appends and retrieves observations', () => {
      const store = createMemoryStore();
      const sessionId = 'test-session-1';

      const obs1: RawObservation = {
        id: generateId(),
        session_id: sessionId,
        timestamp: Date.now(),
        tool: 'Read',
        input_summary: 'Reading src/main.ts',
        output_summary: 'File contents returned',
        files_read: ['src/main.ts'],
        files_modified: [],
      };

      const obs2: RawObservation = {
        id: generateId(),
        session_id: sessionId,
        timestamp: Date.now() + 1000,
        tool: 'Edit',
        input_summary: 'Editing src/main.ts',
        output_summary: 'File updated',
        files_read: [],
        files_modified: ['src/main.ts'],
      };

      store.appendObservation(sessionId, obs1);
      store.appendObservation(sessionId, obs2);

      const retrieved = store.getSessionObservations(sessionId);
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].tool).toBe('Read');
      expect(retrieved[1].tool).toBe('Edit');
    });

    test('stores and retrieves session summaries', () => {
      const store = createMemoryStore();
      const sessionId = 'test-session-2';

      const summary: SessionSummary = {
        session_id: sessionId,
        project: 'test-project',
        started_at: Date.now() - 3600000,
        ended_at: Date.now(),
        summary: 'Implemented authentication feature',
        work_items: [
          {
            description: 'Added login form',
            files: ['src/auth/login.tsx'],
            outcome: 'completed',
          },
        ],
        in_progress: ['Add password reset'],
        decisions: [
          {
            description: 'Use JWT for authentication',
            rationale: 'Standard approach, works with our API',
          },
        ],
      };

      store.storeSessionSummary(sessionId, summary);

      const recent = store.getRecentSessions(5);
      expect(recent).toHaveLength(1);
      expect(recent[0].summary).toBe('Implemented authentication feature');
      expect(recent[0].work_items).toHaveLength(1);
    });

    test('returns recent sessions in reverse chronological order', () => {
      const store = createMemoryStore();

      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const sessionId = `session-${i}`;
        const summary: SessionSummary = {
          session_id: sessionId,
          project: 'test-project',
          started_at: Date.now() + i * 1000,
          ended_at: Date.now() + i * 1000 + 1000,
          summary: `Session ${i}`,
          work_items: [],
          in_progress: [],
          decisions: [],
        };
        store.storeSessionSummary(sessionId, summary);
      }

      const recent = store.getRecentSessions(3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('Team Memory', () => {
    test('indexes and searches observations', async () => {
      // Re-assert memory root to guard against parallel test races
      setMemoryRoot(testDir);
      const gitRemote = `git@github.com:test/search-repo-${generateId()}.git`;
      cleanupGitRemote(gitRemote);
      const store = createMemoryStore();

      const observations: IndexedObservation[] = [
        {
          id: generateId(),
          source: 'git:commit:abc123',
          type: 'commit',
          timestamp: Date.now(),
          author: 'alice',
          summary: 'Add authentication middleware',
          detail: 'Implemented JWT validation for API routes',
          files: ['src/auth/middleware.ts'],
          patterns: ['authentication', 'jwt'],
        },
        {
          id: generateId(),
          source: 'git:commit:def456',
          type: 'commit',
          timestamp: Date.now() + 1000,
          author: 'bob',
          summary: 'Fix payment processing bug',
          detail: 'Corrected decimal precision issue in payment calculations',
          files: ['src/payments/calculator.ts'],
          patterns: ['payments', 'bugfix'],
        },
      ];

      setMemoryRoot(testDir);
      await store.indexObservations(gitRemote, observations);

      // Search for authentication
      setMemoryRoot(testDir);
      const authResults = await store.search(gitRemote, 'authentication JWT');
      expect(authResults.length).toBeGreaterThan(0);
      expect(authResults[0].observation.author).toBe('alice');

      // Search for payments
      setMemoryRoot(testDir);
      const paymentResults = await store.search(gitRemote, 'payment bug');
      expect(paymentResults.length).toBeGreaterThan(0);
      expect(paymentResults[0].observation.author).toBe('bob');
    });

    test('filters by author', async () => {
      // Re-assert memory root to guard against parallel test races
      setMemoryRoot(testDir);
      const gitRemote = `git@github.com:test/author-filter-${generateId()}.git`;
      cleanupGitRemote(gitRemote);
      const store = createMemoryStore();

      const observations: IndexedObservation[] = [
        {
          id: generateId(),
          source: 'git:commit:abc',
          type: 'commit',
          timestamp: Date.now(),
          author: 'alice',
          summary: 'Feature by Alice',
          detail: 'Implementation details',
          files: [],
          patterns: [],
        },
        {
          id: generateId(),
          source: 'git:commit:def',
          type: 'commit',
          timestamp: Date.now(),
          author: 'bob',
          summary: 'Feature by Bob',
          detail: 'Implementation details',
          files: [],
          patterns: [],
        },
      ];

      setMemoryRoot(testDir);
      await store.indexObservations(gitRemote, observations);

      setMemoryRoot(testDir);
      const results = await store.search(gitRemote, 'feature', {
        authors: ['alice'],
      });
      expect(results).toHaveLength(1);
      expect(results[0].observation.author).toBe('alice');
    });

    test('filters by type', async () => {
      // Re-assert memory root to guard against parallel test races
      setMemoryRoot(testDir);
      const gitRemote = `git@github.com:test/type-filter-${generateId()}.git`;
      cleanupGitRemote(gitRemote);
      const store = createMemoryStore();

      const observations: IndexedObservation[] = [
        {
          id: generateId(),
          source: 'git:commit:abc',
          type: 'commit',
          timestamp: Date.now(),
          author: 'alice',
          summary: 'Commit message',
          detail: 'Details',
          files: [],
          patterns: [],
        },
        {
          id: generateId(),
          source: 'github:pr:123',
          type: 'pr',
          timestamp: Date.now(),
          author: 'bob',
          summary: 'PR title',
          detail: 'Details',
          files: [],
          patterns: [],
        },
      ];

      setMemoryRoot(testDir);
      await store.indexObservations(gitRemote, observations);

      setMemoryRoot(testDir);
      const results = await store.search(gitRemote, 'details', {
        types: ['pr'],
      });
      expect(results).toHaveLength(1);
      expect(results[0].observation.type).toBe('pr');
    });

    test('filters by timeframe', async () => {
      // Re-assert memory root to guard against parallel test races
      setMemoryRoot(testDir);
      const gitRemote = `git@github.com:test/timeframe-filter-${generateId()}.git`;
      cleanupGitRemote(gitRemote);
      const store = createMemoryStore();
      const now = Date.now();

      const observations: IndexedObservation[] = [
        {
          id: generateId(),
          source: 'git:commit:old',
          type: 'commit',
          timestamp: now - 86400000 * 30, // 30 days ago
          author: 'alice',
          summary: 'Old commit',
          detail: 'Details',
          files: [],
          patterns: [],
        },
        {
          id: generateId(),
          source: 'git:commit:recent',
          type: 'commit',
          timestamp: now - 86400000, // 1 day ago
          author: 'bob',
          summary: 'Recent commit',
          detail: 'Details',
          files: [],
          patterns: [],
        },
      ];

      setMemoryRoot(testDir);
      await store.indexObservations(gitRemote, observations);

      setMemoryRoot(testDir);
      const results = await store.search(gitRemote, 'commit', {
        timeframe: {
          start: now - 86400000 * 7, // Last 7 days
        },
      });
      expect(results).toHaveLength(1);
      expect(results[0].observation.summary).toBe('Recent commit');
    });

    test('returns empty results for no matches', async () => {
      const gitRemote = 'git@github.com:test/empty-results.git';
      const store = createMemoryStore();
      const results = await store.search(gitRemote, 'nonexistent query');
      expect(results).toEqual([]);
    });
  });

  describe('Index Metadata', () => {
    test('creates and updates metadata', () => {
      const gitRemote = 'git@github.com:test/meta-create.git';
      const store = createMemoryStore();

      // Initially null
      expect(store.getIndexMetadata(gitRemote)).toBeNull();

      // Create metadata
      store.updateIndexMetadata(gitRemote, {
        sources: {
          git: {
            indexed_at: Date.now(),
            item_count: 100,
          },
        },
      });

      const meta = store.getIndexMetadata(gitRemote);
      expect(meta).not.toBeNull();
      expect(meta?.sources.git.item_count).toBe(100);
    });

    test('merges metadata updates', () => {
      const gitRemote = 'git@github.com:test/meta-merge.git';
      const store = createMemoryStore();

      // First update
      store.updateIndexMetadata(gitRemote, {
        sources: {
          git: {
            indexed_at: Date.now(),
            item_count: 50,
          },
        },
      });

      // Second update
      store.updateIndexMetadata(gitRemote, {
        sources: {
          github: {
            indexed_at: Date.now(),
            item_count: 25,
          },
        },
      });

      const meta = store.getIndexMetadata(gitRemote);
      expect(meta?.sources.git).toBeDefined();
      expect(meta?.sources.github).toBeDefined();
    });
  });
});
