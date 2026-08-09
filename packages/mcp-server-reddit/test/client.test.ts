import { describe, expect, test } from 'bun:test';

import { buildRedditUrl } from '../src/client.js';

describe('buildRedditUrl', () => {
  test('anonymous requests target www.reddit.com with a .json suffix', () => {
    const url = new URL(
      buildRedditUrl('anonymous', '/r/bun/hot', { limit: 5 })
    );
    expect(url.origin).toBe('https://www.reddit.com');
    expect(url.pathname).toBe('/r/bun/hot.json');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  test('does not double up an existing .json suffix', () => {
    const url = new URL(buildRedditUrl('anonymous', '/r/bun/hot.json'));
    expect(url.pathname).toBe('/r/bun/hot.json');
  });

  test('authenticated requests target the OAuth host without a suffix', () => {
    for (const mode of ['user', 'app'] as const) {
      const url = new URL(buildRedditUrl(mode, '/user/someone/saved'));
      expect(url.origin).toBe('https://oauth.reddit.com');
      expect(url.pathname).toBe('/user/someone/saved');
    }
  });

  test('always requests the unescaped JSON shape', () => {
    const url = new URL(buildRedditUrl('user', '/api/v1/me'));
    expect(url.searchParams.get('raw_json')).toBe('1');
  });

  test('drops undefined and empty parameters', () => {
    const url = new URL(
      buildRedditUrl('user', '/user/someone/saved', {
        after: undefined,
        type: '',
        limit: 25,
      })
    );
    expect(url.searchParams.has('after')).toBe(false);
    expect(url.searchParams.has('type')).toBe(false);
    expect(url.searchParams.get('limit')).toBe('25');
  });

  test('serializes booleans and numbers', () => {
    const url = new URL(
      buildRedditUrl('user', '/search', { restrict_sr: true, limit: 10 })
    );
    expect(url.searchParams.get('restrict_sr')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('10');
  });
});
