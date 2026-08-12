import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HarnessBadge } from './HarnessBadge.tsx';

describe('HarnessBadge', () => {
  test('renders nothing for Claude Code', () => {
    // Badging the default would put a badge on nearly every session, which is
    // noise. A badge appearing is the signal.
    expect(renderToStaticMarkup(<HarnessBadge harness="claude-code" />)).toBe(
      ''
    );
  });

  test('renders nothing when the harness is absent', () => {
    expect(renderToStaticMarkup(<HarnessBadge harness={null} />)).toBe('');
    expect(renderToStaticMarkup(<HarnessBadge harness={undefined} />)).toBe('');
  });

  test('renders a badge for every non-default harness', () => {
    for (const harness of [
      'omp',
      'opencode',
      'gemini-cli',
      'kiro',
      'codex',
      'antigravity',
    ]) {
      const html = renderToStaticMarkup(<HarnessBadge harness={harness} />);
      expect(html).toContain('<span');
      expect(html.length).toBeGreaterThan(0);
    }
  });

  test('uses the display name where the id is not presentable', () => {
    expect(
      renderToStaticMarkup(<HarnessBadge harness="gemini-cli" />)
    ).toContain('Gemini CLI');
    expect(renderToStaticMarkup(<HarnessBadge harness="opencode" />)).toContain(
      'OpenCode'
    );
  });

  test('falls back to the raw id for a harness it does not know', () => {
    // A new bridge should still be visible rather than silently unlabelled.
    expect(
      renderToStaticMarkup(<HarnessBadge harness="future-agent" />)
    ).toContain('future-agent');
  });
});
