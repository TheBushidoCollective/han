/**
 * Tests for Team Memory MCP Tool
 *
 * NOTE: This test file carefully mocks only specific functions to avoid
 * leaking mocks to other test files. Do NOT use mock.module() for modules
 * that are also tested elsewhere (like research.ts or git.ts).
 *
 * The git provider is NOT mocked - it uses real git history from the test
 * environment, which is fine since we're testing the parallel search and
 * combination logic, not the git provider itself.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  formatTeamMemoryResult,
  queryTeamMemory,
} from '../lib/commands/mcp/team-memory.ts';
import type { SearchResult } from '../lib/memory/types.ts';

// Mock the memory module - only mock path helpers and vector store, NOT createResearchEngine
// This allows the real research engine to run with mocked data
// We do NOT mock the git provider - it uses real git history
const mockSearch = mock(() => Promise.resolve([] as SearchResult[]));

mock.module('../lib/memory/index.ts', () => {
  // Re-export the real createResearchEngine from research.ts
  const { createResearchEngine } = require('../lib/memory/research.ts');

  return {
    // Use the real research engine
    createResearchEngine,
    // Mock only path helpers and vector store
    getGitRemote: () => 'git@github.com:test/repo.git',
    getProjectIndexPath: () => '/tmp/test-memory/.index',
    getVectorStore: (_dbPath: string) =>
      Promise.resolve({
        search: mockSearch,
        index: mock(() => Promise.resolve()),
        clear: mock(() => Promise.resolve()),
        isAvailable: mock(() => Promise.resolve(true)),
        embed: mock(() => Promise.resolve([])),
        embedBatch: mock(() => Promise.resolve([])),
        close: mock(() => Promise.resolve()),
      }),
  };
});

describe('Team Memory MCP Tool', () => {
  beforeEach(() => {
    mockSearch.mockClear();
  });

  describe('queryTeamMemory', () => {
    test('returns error for empty question', async () => {
      const result = await queryTeamMemory({ question: '' });

      expect(result.success).toBe(false);
      expect(result.answer).toContain('cannot be empty');
      expect(result.confidence).toBe('low');
    });

    test('returns error for whitespace-only question', async () => {
      const result = await queryTeamMemory({ question: '   ' });

      expect(result.success).toBe(false);
      expect(result.answer).toContain('cannot be empty');
    });

    test('queries vector store with question', async () => {
      // Vector store returns results
      mockSearch.mockResolvedValueOnce([
        {
          observation: {
            id: 'test-id',
            source: 'git:commit:test',
            author: 'test@example.com',
            timestamp: 1700000000000,
            summary: 'Test',
            detail: 'Test detail',
            files: [],
            patterns: [],
            type: 'commit',
          },
          score: 0.5,
          excerpt: 'Test',
        },
      ]);

      await queryTeamMemory({ question: 'who knows about auth?' });

      // Vector store should be searched once with the question
      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith(
        'observations',
        'who knows about auth?',
        10
      );
    });

    test('uses custom limit when provided', async () => {
      mockSearch.mockResolvedValueOnce([]);

      await queryTeamMemory({ question: 'what changed?', limit: 20 });

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith(
        'observations',
        'what changed?',
        20
      );
    });

    test('always searches git history in parallel with vector store', async () => {
      // Vector store returns nothing
      mockSearch.mockResolvedValueOnce([]);

      const result = await queryTeamMemory({
        question: 'who knows about something?',
      });

      // Should always search git commits regardless of vector store results
      expect(result.success).toBe(true);
      expect(result.searched_sources).toContain('git:commits');
    });

    test('deduplicates results from vector store and git by source', async () => {
      // Vector store returns a result
      mockSearch.mockResolvedValueOnce([
        {
          observation: {
            id: 'git:commit:abc123',
            source: 'git:commit:abc123',
            author: 'alice@example.com',
            timestamp: 1700000000000,
            summary: 'Added authentication',
            detail: 'Implemented JWT auth',
            files: ['src/auth.ts'],
            patterns: ['auth', 'jwt'],
            type: 'commit' as const,
          },
          score: 0.9,
          excerpt: 'JWT implementation',
        },
      ]);

      const result = await queryTeamMemory({
        question: 'who knows about auth?',
      });

      expect(result.success).toBe(true);
      // Results should be deduplicated - no duplicate sources
      const sourceSet = new Set(result.citations.map((c) => c.source));
      expect(sourceSet.size).toBe(result.citations.length);
    });

    test('formats citations from search results', async () => {
      const authResult = {
        observation: {
          id: 'test-1',
          source: 'git:commit:abc123',
          author: 'alice@example.com',
          timestamp: 1700000000000,
          summary: 'Added authentication',
          detail: 'Implemented JWT auth',
          files: ['src/auth.ts'],
          patterns: ['auth', 'jwt'],
          type: 'commit' as const,
        },
        score: 0.85,
        excerpt: 'JWT implementation',
      };

      mockSearch.mockResolvedValueOnce([authResult]);

      const result = await queryTeamMemory({
        question: 'who knows about auth?',
      });

      expect(result.success).toBe(true);
      expect(result.citations.length).toBeGreaterThanOrEqual(1);

      // Find the auth citation (might have git history citations too)
      const authCitation = result.citations.find(
        (c) => c.source === 'git:commit:abc123'
      );
      expect(authCitation).toBeDefined();
      expect(authCitation?.author).toBe('alice@example.com');
    });
  });

  describe('formatTeamMemoryResult', () => {
    test('formats high confidence result with green indicator', () => {
      const result = {
        success: true,
        answer: 'Alice implemented the auth system',
        confidence: 'high' as const,
        citations: [
          {
            source: 'git:commit:abc123',
            excerpt: 'JWT implementation',
            author: 'alice@example.com',
            timestamp: 1700000000000,
          },
        ],
        caveats: [],
        searched_sources: ['query:who knows about auth?'],
      };

      const formatted = formatTeamMemoryResult(result);

      expect(formatted).toContain('🟢');
      expect(formatted).toContain('Confidence: high');
      expect(formatted).toContain('Alice implemented the auth system');
      expect(formatted).toContain('git:commit:abc123');
    });

    test('formats medium confidence result with yellow indicator', () => {
      const result = {
        success: true,
        answer: 'Some evidence found',
        confidence: 'medium' as const,
        citations: [],
        caveats: [],
        searched_sources: [],
      };

      const formatted = formatTeamMemoryResult(result);

      expect(formatted).toContain('🟡');
      expect(formatted).toContain('Confidence: medium');
    });

    test('formats low confidence result with red indicator', () => {
      const result = {
        success: true,
        answer: "Couldn't find much",
        confidence: 'low' as const,
        citations: [],
        caveats: [],
        searched_sources: [],
      };

      const formatted = formatTeamMemoryResult(result);

      expect(formatted).toContain('🔴');
      expect(formatted).toContain('Confidence: low');
    });

    test('includes caveats when present', () => {
      const result = {
        success: true,
        answer: 'The approach evolved',
        confidence: 'high' as const,
        citations: [],
        caveats: ['Approach has evolved over 45 days'],
        searched_sources: [],
      };

      const formatted = formatTeamMemoryResult(result);

      expect(formatted).toContain('Notes');
      expect(formatted).toContain('Approach has evolved over 45 days');
    });

    test('truncates long excerpts', () => {
      const longExcerpt = 'A'.repeat(300);
      const result = {
        success: true,
        answer: 'Answer',
        confidence: 'high' as const,
        citations: [
          {
            source: 'git:commit:abc123',
            excerpt: longExcerpt,
          },
        ],
        caveats: [],
        searched_sources: [],
      };

      const formatted = formatTeamMemoryResult(result);

      expect(formatted).toContain('...');
      // Should be truncated to 200 chars
      expect(formatted.split(longExcerpt.slice(0, 200)).length).toBe(2);
    });
  });
});
