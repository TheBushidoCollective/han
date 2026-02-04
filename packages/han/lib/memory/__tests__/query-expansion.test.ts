import { describe, expect, test } from 'bun:test';
import {
  ACRONYMS,
  expandQuery,
  getExpansions,
  hasExpansion,
  SYNONYMS,
} from '../query-expansion.ts';

describe('expandQuery', () => {
  describe('level=none', () => {
    test('returns original query escaped for FTS5', () => {
      const result = expandQuery('vcs strategy', { level: 'none' });
      expect(result.expanded).toBe('"vcs" "strategy"');
      expect(result.expansionsApplied).toBe(0);
      expect(result.original).toBe('vcs strategy');
    });

    test('escapes quotes in terms', () => {
      const result = expandQuery('test "quoted" term', { level: 'none' });
      // Each internal quote is doubled, then wrapped in quotes
      // "quoted" -> ""quoted"" -> """quoted"""
      expect(result.expanded).toBe('"test" """quoted""" "term"');
    });

    test('handles empty query', () => {
      const result = expandQuery('', { level: 'none' });
      expect(result.expanded).toBe('');
      expect(result.terms).toEqual([]);
    });
  });

  describe('level=minimal (default)', () => {
    test('expands known acronyms', () => {
      const result = expandQuery('vcs', { level: 'minimal' });
      expect(result.expanded).toContain('"vcs"');
      expect(result.expanded).toContain('"version control"');
      expect(result.expanded).toContain('OR');
      expect(result.expansionsApplied).toBe(1);
    });

    test('does not expand unknown terms', () => {
      const result = expandQuery('foobar', { level: 'minimal' });
      expect(result.expanded).toBe('"foobar"');
      expect(result.expansionsApplied).toBe(0);
    });

    test('does not expand synonyms in minimal mode', () => {
      const result = expandQuery('refactor', { level: 'minimal' });
      // refactor is a synonym, not an acronym
      expect(result.expanded).toBe('"refactor"');
      expect(result.expansionsApplied).toBe(0);
    });

    test('handles multi-word queries', () => {
      const result = expandQuery('pr review', { level: 'minimal' });
      expect(result.expanded).toContain('"pull request"');
      expect(result.terms).toContain('pr');
      expect(result.terms).toContain('review');
    });

    test('expands common development acronyms', () => {
      // CI
      const ci = expandQuery('ci', { level: 'minimal' });
      expect(ci.expanded).toContain('"continuous integration"');

      // API
      const api = expandQuery('api', { level: 'minimal' });
      expect(api.expanded).toContain('"application programming interface"');

      // DB
      const db = expandQuery('db', { level: 'minimal' });
      expect(db.expanded).toContain('"database"');
    });
  });

  describe('level=full', () => {
    test('expands both acronyms and synonyms', () => {
      const result = expandQuery('refactor', { level: 'full' });
      expect(result.expanded).toContain('"refactor"');
      expect(result.expanded).toContain('"refactoring"');
      expect(result.expanded).toContain('OR');
      expect(result.expansionsApplied).toBe(1);
    });

    test('still expands acronyms', () => {
      const result = expandQuery('pr', { level: 'full' });
      expect(result.expanded).toContain('"pull request"');
    });

    test('expands common dev synonyms', () => {
      // debug -> debugging, troubleshoot, fix
      const debug = expandQuery('debug', { level: 'full' });
      expect(debug.expanded).toContain('"debugging"');

      // deploy -> deployment, release, ship
      const deploy = expandQuery('deploy', { level: 'full' });
      expect(deploy.expanded).toContain('"deployment"');

      // config -> configuration, settings
      const config = expandQuery('config', { level: 'full' });
      expect(config.expanded).toContain('"configuration"');
    });
  });

  describe('FTS5 syntax', () => {
    test('produces valid FTS5 syntax with OR groups', () => {
      const result = expandQuery('vcs strategy', { level: 'minimal' });
      // Should have format: (term1 OR term2 OR ...) term3
      expect(result.expanded).toMatch(/\(.*OR.*\)/);
      // No implicit AND - terms are space-separated
      expect(result.expanded).not.toContain('AND');
    });

    test('single terms are quoted without parentheses', () => {
      const result = expandQuery('foobar baz', { level: 'minimal' });
      expect(result.expanded).toBe('"foobar" "baz"');
    });

    test('phrases (multi-word expansions) are quoted', () => {
      const result = expandQuery('vcs', { level: 'minimal' });
      // "version control" should be quoted as a phrase
      expect(result.expanded).toContain('"version control"');
    });
  });

  describe('maxTerms option', () => {
    test('limits expansion terms per word', () => {
      // VCS has 4 expansions, limit to 2 total (1 original + 1 expansion)
      const result = expandQuery('vcs', { level: 'minimal', maxTerms: 2 });
      // Should have original + 1 expansion = 2 terms
      expect(result.terms.length).toBeLessThanOrEqual(2);
    });

    test('default maxTerms is 5', () => {
      const result = expandQuery('vcs', { level: 'minimal' });
      // VCS has 4 expansions + original = 5 terms (within default limit)
      expect(result.terms.length).toBeLessThanOrEqual(5);
    });
  });

  describe('case handling', () => {
    test('converts query to lowercase for matching', () => {
      const upper = expandQuery('VCS', { level: 'minimal' });
      const lower = expandQuery('vcs', { level: 'minimal' });
      // Both should expand the same way
      expect(upper.expansionsApplied).toBe(lower.expansionsApplied);
    });

    test('handles mixed case queries', () => {
      const result = expandQuery('CI CD Pipeline', { level: 'minimal' });
      expect(result.expansionsApplied).toBe(2); // CI and CD should both expand
    });
  });

  describe('deduplication', () => {
    test('deduplicates terms within a group', () => {
      // Manually check that the terms array has unique values
      const result = expandQuery('vcs', { level: 'minimal' });
      const uniqueTerms = [...new Set(result.terms)];
      expect(result.terms.length).toBe(uniqueTerms.length);
    });
  });
});

describe('hasExpansion', () => {
  test('returns true for known acronyms', () => {
    expect(hasExpansion('vcs')).toBe(true);
    expect(hasExpansion('pr')).toBe(true);
    expect(hasExpansion('api')).toBe(true);
  });

  test('returns false for unknown terms in minimal mode', () => {
    expect(hasExpansion('refactor', 'minimal')).toBe(false);
    expect(hasExpansion('unknown')).toBe(false);
  });

  test('returns true for synonyms in full mode', () => {
    expect(hasExpansion('refactor', 'full')).toBe(true);
    expect(hasExpansion('debug', 'full')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(hasExpansion('VCS')).toBe(true);
    expect(hasExpansion('Pr')).toBe(true);
  });
});

describe('getExpansions', () => {
  test('returns expansions for known acronyms', () => {
    const expansions = getExpansions('vcs');
    expect(expansions).toContain('version control');
    expect(expansions).toContain('git');
  });

  test('returns empty array for unknown terms', () => {
    const expansions = getExpansions('unknown');
    expect(expansions).toEqual([]);
  });

  test('includes synonyms in full mode', () => {
    const minimal = getExpansions('refactor', 'minimal');
    const full = getExpansions('refactor', 'full');
    expect(minimal).toEqual([]);
    expect(full).toContain('refactoring');
  });

  test('deduplicates results', () => {
    const expansions = getExpansions('pr');
    const unique = [...new Set(expansions)];
    expect(expansions.length).toBe(unique.length);
  });
});

describe('ACRONYMS map', () => {
  test('contains common VCS acronyms', () => {
    expect(ACRONYMS.vcs).toBeDefined();
    expect(ACRONYMS.scm).toBeDefined();
    expect(ACRONYMS.pr).toBeDefined();
    expect(ACRONYMS.mr).toBeDefined();
  });

  test('contains CI/CD acronyms', () => {
    expect(ACRONYMS.ci).toBeDefined();
    expect(ACRONYMS.cd).toBeDefined();
    expect(ACRONYMS.cicd).toBeDefined();
  });

  test('contains authentication acronyms', () => {
    expect(ACRONYMS.auth).toBeDefined();
    expect(ACRONYMS.oauth).toBeDefined();
    expect(ACRONYMS.jwt).toBeDefined();
    expect(ACRONYMS.sso).toBeDefined();
    expect(ACRONYMS.mfa).toBeDefined();
    expect(ACRONYMS['2fa']).toBeDefined();
  });

  test('contains API acronyms', () => {
    expect(ACRONYMS.api).toBeDefined();
    expect(ACRONYMS.rest).toBeDefined();
    expect(ACRONYMS.grpc).toBeDefined();
    expect(ACRONYMS.sdk).toBeDefined();
  });

  test('contains database acronyms', () => {
    expect(ACRONYMS.db).toBeDefined();
    expect(ACRONYMS.sql).toBeDefined();
    expect(ACRONYMS.orm).toBeDefined();
    expect(ACRONYMS.fts).toBeDefined();
  });
});

describe('SYNONYMS map', () => {
  test('contains version control synonyms', () => {
    expect(SYNONYMS.branch).toBeDefined();
    expect(SYNONYMS.merge).toBeDefined();
    expect(SYNONYMS.commit).toBeDefined();
  });

  test('contains code action synonyms', () => {
    expect(SYNONYMS.refactor).toBeDefined();
    expect(SYNONYMS.debug).toBeDefined();
    expect(SYNONYMS.deploy).toBeDefined();
    expect(SYNONYMS.build).toBeDefined();
    expect(SYNONYMS.test).toBeDefined();
  });

  test('contains common abbreviations', () => {
    expect(SYNONYMS.repo).toBeDefined();
    expect(SYNONYMS.env).toBeDefined();
    expect(SYNONYMS.config).toBeDefined();
  });
});
