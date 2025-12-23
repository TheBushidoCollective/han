/**
 * MarkdownContent Organism
 *
 * Centralized markdown and terminal output rendering component.
 * Detects content type and renders appropriately:
 * - Markdown content → parsed and rendered with consistent styling
 * - Terminal output with ANSI codes → rendered with color support
 * - Plain text → rendered in monospace preformatted style
 *
 * Uses the AnsiText atom for ANSI escape sequence handling.
 */

import Anser from 'anser';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { marked } from 'marked';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { AnsiText, containsAnsi } from '@/components/atoms/AnsiText.tsx';
import { Box } from '@/components/atoms/Box.tsx';

// Register highlight.js languages
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('plaintext', plaintext);

// Configure marked for safe rendering with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Custom renderer for code blocks with syntax highlighting
 */
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  // Check if code block contains ANSI codes - render with AnsiText styling
  if (containsAnsi(text)) {
    // Return a special marker that we'll replace after parsing
    const encodedText = encodeURIComponent(text);
    return `<pre class="code-block code-ansi" data-ansi="${encodedText}"></pre>`;
  }

  // Try to highlight with the specified language
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  try {
    const highlighted = hljs.highlight(text, { language }).value;
    return `<pre class="code-block"><code class="hljs language-${language}">${highlighted}</code></pre>`;
  } catch {
    return `<pre class="code-block"><code>${text}</code></pre>`;
  }
};

marked.use({ renderer });

/**
 * Markdown content styles
 */
const markdownStyles: CSSProperties = {
  fontSize: '0.9rem',
  lineHeight: 1.6,
  color: 'var(--text-primary, #e1e4e8)',
};

/**
 * Content type detection result
 */
type ContentType = 'markdown' | 'ansi' | 'plain';

/**
 * Detect the type of content to render
 * Priority: ANSI (terminal output) > Markdown > Plain text
 */
function detectContentType(content: string): ContentType {
  // Check for ANSI escape codes first (terminal output)
  if (containsAnsi(content)) {
    // If content has ANSI but also looks like markdown (headers, lists, etc.),
    // strip ANSI and render as markdown
    const stripped = Anser.ansiToText(content);
    if (looksLikeMarkdown(stripped)) {
      return 'markdown';
    }
    return 'ansi';
  }

  // Check for markdown indicators
  if (looksLikeMarkdown(content)) {
    return 'markdown';
  }

  // Default to plain text
  return 'plain';
}

/**
 * Check if content appears to be markdown
 * Looks for common markdown patterns
 */
function looksLikeMarkdown(content: string): boolean {
  // Common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers: # Header
    /^\s*[-*+]\s+/m, // Unordered lists: - item, * item, + item
    /^\s*\d+\.\s+/m, // Ordered lists: 1. item
    /\*\*[^*]+\*\*/, // Bold: **text**
    /\*[^*]+\*/, // Italic: *text*
    /__[^_]+__/, // Bold: __text__
    /_[^_]+_/, // Italic: _text_
    /`[^`]+`/, // Inline code: `code`
    /```[\s\S]*?```/, // Code blocks: ```code```
    /^\s*>\s+/m, // Blockquotes: > quote
    /\[.+\]\(.+\)/, // Links: [text](url)
    /!\[.+\]\(.+\)/, // Images: ![alt](url)
    /^\s*\|.+\|/m, // Tables: | col | col |
    /^\s*---+\s*$/m, // Horizontal rules: ---
  ];

  // Content is likely markdown if it matches any pattern
  return markdownPatterns.some((pattern) => pattern.test(content));
}

/**
 * Strip ANSI escape sequences from text
 */
function stripAnsi(text: string): string {
  if (!containsAnsi(text)) return text;
  return Anser.ansiToText(text);
}

export interface MarkdownContentProps {
  /** The content to render */
  children: string;
  /** Force a specific content type (override auto-detection) */
  forceType?: ContentType;
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to truncate long content */
  truncate?: boolean;
  /** Maximum length before truncation (default: 500) */
  maxLength?: number;
  /** Callback for expand/collapse */
  onToggleExpand?: () => void;
  /** Whether content is expanded (when truncate is true) */
  expanded?: boolean;
}

/**
 * MarkdownContent - Centralized content renderer
 *
 * Automatically detects and renders:
 * - Markdown → parsed HTML with syntax highlighting
 * - ANSI terminal output → colored spans
 * - Plain text → preformatted monospace
 */
export function MarkdownContent({
  children,
  forceType,
  className = '',
  style,
  truncate = false,
  maxLength = 500,
  expanded = false,
}: MarkdownContentProps): ReactNode {
  const content = children || '';

  // Determine display content based on truncation
  const isLong = truncate && content.length > maxLength;
  const displayContent =
    isLong && !expanded ? `${content.slice(0, maxLength)}...` : content;

  // Detect content type
  const contentType = forceType ?? detectContentType(displayContent);

  // Memoize rendered content
  const rendered = useMemo(() => {
    switch (contentType) {
      case 'ansi':
        // Render ANSI with color support
        return (
          <pre className="terminal-output">
            <AnsiText>{displayContent}</AnsiText>
          </pre>
        );

      case 'markdown': {
        // Strip ANSI codes if present, then parse markdown
        const cleanContent = stripAnsi(displayContent);
        const html = marked.parse(cleanContent) as string;

        // Post-process to handle ANSI code blocks
        // Replace the data-ansi markers with actual AnsiText rendering
        // This is a workaround since marked doesn't support React components
        if (html.includes('data-ansi=')) {
          // For now, just render the HTML - AnsiText in code blocks
          // will be handled by CSS styling
        }

        return (
          <div
            className="markdown-body"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown rendering requires innerHTML
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      default:
        // Render plain text in preformatted style
        return (
          <pre className="plain-text">
            <code>{displayContent}</code>
          </pre>
        );
    }
  }, [contentType, displayContent]);

  const combinedClassName =
    `markdown-content ${contentType}-content ${className}`.trim();

  return (
    <Box
      className={combinedClassName}
      style={{
        ...markdownStyles,
        ...style,
      }}
    >
      {rendered}
    </Box>
  );
}

/**
 * Export utility functions for use in other components
 */
export { containsAnsi, stripAnsi, detectContentType, looksLikeMarkdown };
