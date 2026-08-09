import { describe, expect, test } from 'bun:test';

import {
  explainMissingUserAuth,
  readCredentials,
  resolveMode,
} from '../src/auth.js';

describe('readCredentials', () => {
  test('treats blank and whitespace values as absent', () => {
    const credentials = readCredentials({
      REDDIT_CLIENT_ID: '  ',
      REDDIT_CLIENT_SECRET: '',
      REDDIT_USERNAME: ' someone ',
    } as NodeJS.ProcessEnv);

    expect(credentials.clientId).toBeUndefined();
    expect(credentials.clientSecret).toBeUndefined();
    expect(credentials.username).toBe('someone');
  });

  test('falls back to a compliant default user agent', () => {
    const credentials = readCredentials({} as NodeJS.ProcessEnv);
    expect(credentials.userAgent).toContain('mcp-server-reddit');
  });
});

describe('resolveMode', () => {
  const base = { userAgent: 'test' };

  test('is anonymous without a client id', () => {
    expect(resolveMode({ ...base, refreshToken: 'x' })).toBe('anonymous');
  });

  test('is user with a refresh token', () => {
    expect(resolveMode({ ...base, clientId: 'a', refreshToken: 'x' })).toBe(
      'user'
    );
  });

  test('is user with a username and password pair', () => {
    expect(
      resolveMode({
        ...base,
        clientId: 'a',
        username: 'u',
        password: 'p',
      })
    ).toBe('user');
  });

  test('is app with a client id but no user grant', () => {
    expect(resolveMode({ ...base, clientId: 'a', clientSecret: 'b' })).toBe(
      'app'
    );
  });

  test('does not upgrade a half configured password grant', () => {
    expect(resolveMode({ ...base, clientId: 'a', username: 'u' })).toBe('app');
  });
});

describe('explainMissingUserAuth', () => {
  test('names the environment variables that are actually needed', () => {
    const message = explainMissingUserAuth('anonymous');
    expect(message).toContain('REDDIT_CLIENT_ID');
    expect(message).toContain('REDDIT_REFRESH_TOKEN');
    expect(message).toContain('prefs/apps');
  });

  test('distinguishes app-only auth from no auth at all', () => {
    expect(explainMissingUserAuth('app')).toContain('application-only');
  });
});
