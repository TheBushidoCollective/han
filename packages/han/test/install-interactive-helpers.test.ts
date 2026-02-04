/**
 * Tests for exported helper functions in install-interactive.tsx
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from 'bun:test';

import { formatToolUsage, parseMarkdown } from '../lib/install/index.ts';

describe('install-interactive.tsx helper functions', () => {
  describe('formatToolUsage', () => {
    describe('Read tool', () => {
      test('formats read with file_path', () => {
        const result = formatToolUsage('Read', { file_path: '/src/index.ts' });
        expect(result).toBe('📄 Reading: /src/index.ts');
      });

      test('formats read with path', () => {
        const result = formatToolUsage('read_file', { path: '/src/main.ts' });
        expect(result).toBe('📄 Reading: /src/main.ts');
      });

      test('formats read without path', () => {
        const result = formatToolUsage('read', {});
        expect(result).toBe('📄 Reading file');
      });

      test('handles lowercase read', () => {
        const result = formatToolUsage('read', { file_path: '/config.json' });
        expect(result).toBe('📄 Reading: /config.json');
      });
    });

    describe('Grep tool', () => {
      test('formats grep with pattern and path', () => {
        const result = formatToolUsage('grep', {
          pattern: 'function',
          path: '/src',
        });
        expect(result).toBe('🔍 Grep: "function" in /src');
      });

      test('formats grep with regex and directory', () => {
        const result = formatToolUsage('Grep', {
          regex: 'class\\s+',
          directory: '/lib',
        });
        expect(result).toBe('🔍 Grep: "class\\s+" in /lib');
      });

      test('formats grep with pattern only', () => {
        const result = formatToolUsage('grep', { pattern: 'import' });
        expect(result).toBe('🔍 Grep: "import"');
      });

      test('formats grep without pattern', () => {
        const result = formatToolUsage('grep', {});
        expect(result).toBe('🔍 Searching');
      });
    });

    describe('Glob tool', () => {
      test('formats glob with pattern and path', () => {
        const result = formatToolUsage('glob', {
          pattern: '**/*.ts',
          path: '/src',
        });
        expect(result).toBe('📁 Glob: **/*.ts in /src');
      });

      test('formats glob with glob and directory', () => {
        const result = formatToolUsage('Glob', {
          glob: '*.json',
          directory: '/config',
        });
        expect(result).toBe('📁 Glob: *.json in /config');
      });

      test('formats glob with pattern only', () => {
        const result = formatToolUsage('glob', { pattern: '*.md' });
        expect(result).toBe('📁 Glob: *.md');
      });

      test('formats glob without pattern', () => {
        const result = formatToolUsage('glob', {});
        expect(result).toBe('📁 Finding files');
      });
    });

    describe('Bash tool', () => {
      test('formats bash with short command', () => {
        const result = formatToolUsage('bash', { command: 'npm test' });
        expect(result).toBe('💻 Bash: npm test');
      });

      test('formats bash with cmd parameter', () => {
        const result = formatToolUsage('Bash', { cmd: 'git status' });
        expect(result).toBe('💻 Bash: git status');
      });

      test('truncates long commands', () => {
        const longCommand =
          'npm run build && npm run test && npm run lint && npm run format && npm run deploy';
        const result = formatToolUsage('bash', { command: longCommand });
        expect(result).toBe(`💻 Bash: ${longCommand.slice(0, 57)}...`);
        expect(result.length).toBeLessThan(75); // 💻 Bash:  = ~10 chars + 57 + ...
      });

      test('formats bash without command', () => {
        const result = formatToolUsage('bash', {});
        expect(result).toBe('💻 Running command');
      });

      test('handles non-string command', () => {
        const result = formatToolUsage('bash', { command: 123 });
        expect(result).toBe('💻 Running command');
      });
    });

    describe('Unknown tools', () => {
      test('formats unknown tool with wrench emoji', () => {
        const result = formatToolUsage('CustomTool', {});
        expect(result).toBe('🔧 CustomTool');
      });

      test('preserves tool name case', () => {
        const result = formatToolUsage('MySpecialTool', {});
        expect(result).toBe('🔧 MySpecialTool');
      });
    });

    describe('Edge cases', () => {
      test('handles undefined toolInput', () => {
        const result = formatToolUsage('read');
        expect(result).toBe('📄 Reading file');
      });

      test('handles empty toolName', () => {
        const result = formatToolUsage('', {});
        expect(result).toBe('🔧 ');
      });
    });
  });

  describe('parseMarkdown', () => {
    test('parses plain text', () => {
      const result = parseMarkdown('Hello world');
      expect(result).toBe('Hello world');
    });

    test('strips bold markdown', () => {
      const result = parseMarkdown('**bold text**');
      expect(result).toBe('bold text');
    });

    test('strips italic markdown', () => {
      const result = parseMarkdown('*italic text*');
      expect(result).toBe('italic text');
    });

    test('strips code blocks', () => {
      const result = parseMarkdown('`code`');
      expect(result).toBe('code');
    });

    test('converts HTML entities', () => {
      const result = parseMarkdown('&lt;div&gt; &amp; &quot;text&quot;');
      expect(result).toBe('<div> & "text"');
    });

    test('converts apostrophe entity', () => {
      const result = parseMarkdown('it&#39;s working');
      expect(result).toBe("it's working");
    });

    test('strips links', () => {
      const result = parseMarkdown('[link text](https://example.com)');
      expect(result).toBe('link text');
    });

    test('handles multiline markdown', () => {
      const result = parseMarkdown('Line 1\n\nLine 2');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    test('handles headers', () => {
      const result = parseMarkdown('# Header\n\nContent');
      expect(result).toContain('Header');
      expect(result).toContain('Content');
    });

    test('handles bullet lists', () => {
      const result = parseMarkdown('- Item 1\n- Item 2');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    test('trims whitespace', () => {
      const result = parseMarkdown('  text with spaces  ');
      expect(result).toBe('text with spaces');
    });

    test('handles empty string', () => {
      const result = parseMarkdown('');
      expect(result).toBe('');
    });

    test('handles complex markdown', () => {
      const input = '**Bold** and *italic* with `code` and [link](url)';
      const result = parseMarkdown(input);
      expect(result).toContain('Bold');
      expect(result).toContain('italic');
      expect(result).toContain('code');
      expect(result).toContain('link');
    });
  });
});
