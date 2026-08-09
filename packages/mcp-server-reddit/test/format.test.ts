import { describe, expect, test } from 'bun:test';

import {
  clamp,
  formatThing,
  formatThings,
  matchesQuery,
  toIso,
} from '../src/format.js';

const post = {
  kind: 't3',
  data: {
    id: 'abc123',
    name: 't3_abc123',
    title: 'Bun test runner tips',
    subreddit: 'bun',
    author: 'someone',
    score: 42,
    num_comments: 7,
    created_utc: 1_700_000_000,
    permalink: '/r/bun/comments/abc123/bun_test_runner_tips/',
    url: 'https://example.com/article',
    link_flair_text: 'Guide',
    selftext: 'Use the built in matchers.',
  },
};

const comment = {
  kind: 't1',
  data: {
    id: 'def456',
    name: 't1_def456',
    author: 'commenter',
    subreddit: 'rust',
    score: 5,
    created_utc: 1_700_000_500,
    permalink: '/r/rust/comments/xyz/thread/def456/',
    body: 'Lifetimes click eventually.',
    link_title: 'How did lifetimes finally click for you?',
  },
};

describe('toIso', () => {
  test('converts epoch seconds', () => {
    expect(toIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z');
  });

  test('returns empty for missing or malformed values', () => {
    expect(toIso(undefined)).toBe('');
    expect(toIso('nope')).toBe('');
    expect(toIso(Number.NaN)).toBe('');
  });
});

describe('clamp', () => {
  test('leaves short text alone', () => {
    expect(clamp('short', 10)).toEqual({ text: 'short' });
  });

  test('marks truncation', () => {
    const result = clamp('abcdefghij', 4);
    expect(result.text).toBe('abcd...');
    expect(result.truncated).toBe(true);
  });

  test('handles absent text', () => {
    expect(clamp(undefined)).toEqual({});
  });
});

describe('formatThing', () => {
  test('formats a post with an absolute permalink', () => {
    const result = formatThing(post);
    expect(result).toMatchObject({
      type: 'post',
      id: 'abc123',
      fullname: 't3_abc123',
      subreddit: 'bun',
      score: 42,
      flair: 'Guide',
    });
    expect((result as { permalink: string }).permalink).toBe(
      'https://www.reddit.com/r/bun/comments/abc123/bun_test_runner_tips/'
    );
  });

  test('keeps the parent post title on a saved comment', () => {
    const result = formatThing(comment);
    expect(result).toMatchObject({
      type: 'comment',
      post_title: 'How did lifetimes finally click for you?',
      body: 'Lifetimes click eventually.',
    });
  });

  test('reports unknown kinds rather than guessing', () => {
    expect(formatThing({ kind: 't6', data: {} })).toEqual({
      type: 'unknown',
      kind: 't6',
    });
  });
});

describe('formatThings', () => {
  test('drops kinds with nothing useful to report', () => {
    const items = formatThings([post, comment, { kind: 't6', data: {} }]);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.type)).toEqual(['post', 'comment']);
  });
});

describe('matchesQuery', () => {
  const formattedPost = formatThing(post);
  const formattedComment = formatThing(comment);

  test('matches on title', () => {
    expect(matchesQuery(formattedPost, 'test runner')).toBe(true);
  });

  test('matches on subreddit and is case insensitive', () => {
    expect(matchesQuery(formattedPost, 'BUN')).toBe(true);
  });

  test('matches a saved comment on its parent post title', () => {
    expect(matchesQuery(formattedComment, 'lifetimes')).toBe(true);
  });

  test('requires every term to appear', () => {
    expect(matchesQuery(formattedPost, 'bun kubernetes')).toBe(false);
  });

  test('an empty query matches everything', () => {
    expect(matchesQuery(formattedPost, '   ')).toBe(true);
  });
});
