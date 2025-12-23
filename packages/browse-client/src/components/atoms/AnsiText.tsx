/**
 * AnsiText Component
 *
 * Renders ANSI escape sequences as styled text using span elements.
 * Compatible with React Native Web (uses inline styles, no HTML-specific tags).
 */

import Anser from 'anser';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

export interface AnsiTextProps {
  children: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * ANSI color palette - standard 16 colors
 */
const ANSI_COLORS: Record<string, string> = {
  // Standard colors (0-7)
  'ansi-black': '#000000',
  'ansi-red': '#cc0000',
  'ansi-green': '#4e9a06',
  'ansi-yellow': '#c4a000',
  'ansi-blue': '#3465a4',
  'ansi-magenta': '#75507b',
  'ansi-cyan': '#06989a',
  'ansi-white': '#d3d7cf',
  // Bright colors (8-15)
  'ansi-bright-black': '#555753',
  'ansi-bright-red': '#ef2929',
  'ansi-bright-green': '#8ae234',
  'ansi-bright-yellow': '#fce94f',
  'ansi-bright-blue': '#729fcf',
  'ansi-bright-magenta': '#ad7fa8',
  'ansi-bright-cyan': '#34e2e2',
  'ansi-bright-white': '#eeeeec',
};

/**
 * Convert anser parsed bundle to CSS style object
 */
function bundleToStyle(bundle: Anser.AnserJsonEntry): CSSProperties {
  const style: CSSProperties = {};

  // Handle foreground color
  if (bundle.fg) {
    const colorKey = `ansi-${bundle.fg}`;
    style.color = ANSI_COLORS[colorKey] || bundle.fg;
  }

  // Handle background color
  if (bundle.bg) {
    const colorKey = `ansi-${bundle.bg}`;
    style.backgroundColor = ANSI_COLORS[colorKey] || bundle.bg;
  }

  // Handle decorations
  if (bundle.decorations) {
    for (const decoration of bundle.decorations) {
      switch (decoration) {
        case 'bold':
          style.fontWeight = 'bold';
          break;
        case 'dim':
          style.opacity = 0.7;
          break;
        case 'italic':
          style.fontStyle = 'italic';
          break;
        case 'underline':
          style.textDecoration = 'underline';
          break;
        case 'blink':
          // Skip blink - not well supported
          break;
        case 'reverse':
          // Swap fg/bg would need state tracking
          break;
        case 'hidden':
          style.visibility = 'hidden';
          break;
        case 'strikethrough':
          style.textDecoration = style.textDecoration
            ? `${style.textDecoration} line-through`
            : 'line-through';
          break;
      }
    }
  }

  return style;
}

/**
 * ANSI escape sequence pattern - matches ESC[...m sequences
 * Using template literal with String.fromCharCode to avoid control character lint issues
 */
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(0x1b)}\\[[\\d;]*m`);

/**
 * Check if text contains ANSI escape sequences
 */
export function containsAnsi(text: string): boolean {
  return ANSI_PATTERN.test(text);
}

/**
 * AnsiText renders text with ANSI escape sequences as styled spans.
 * Falls back to plain text if no ANSI sequences are detected.
 */
export function AnsiText({
  children,
  style,
  className,
}: AnsiTextProps): ReactNode {
  const parsed = useMemo(() => {
    if (!containsAnsi(children)) {
      return null;
    }
    return Anser.ansiToJson(children, {
      json: true,
      remove_empty: true,
      use_classes: false,
    });
  }, [children]);

  // No ANSI sequences - return plain text
  if (!parsed) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

  // Render parsed ANSI with styled spans
  return (
    <span className={className} style={style}>
      {parsed.map((bundle, index) => {
        const bundleStyle = bundleToStyle(bundle);
        const hasStyle = Object.keys(bundleStyle).length > 0;

        if (!hasStyle) {
          return bundle.content;
        }

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: ANSI parsing is deterministic, list order is stable
          <span key={index} style={bundleStyle}>
            {bundle.content}
          </span>
        );
      })}
    </span>
  );
}
