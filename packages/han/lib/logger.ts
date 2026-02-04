/**
 * Simple Logger with Levels
 *
 * Provides structured logging with configurable verbosity.
 * Log level is controlled via HAN_LOG_LEVEL environment variable.
 *
 * Levels (in order of verbosity):
 * - debug: Verbose debugging information
 * - info: General operational information
 * - warn: Warning conditions
 * - error: Error conditions (always shown)
 *
 * Default level: "warn" (only show warnings and errors)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Get the configured log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.HAN_LOG_LEVEL?.toLowerCase();
  if (level && level in LOG_LEVELS) {
    return level as LogLevel;
  }
  // Default to warn - only warnings and errors (when not set)
  return 'warn';
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const configuredLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

/**
 * Format a log message with timestamp and level
 */
function formatMessage(
  level: LogLevel,
  prefix: string,
  ...args: unknown[]
): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  const message = args
    .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ');
  return `${timestamp} [${levelStr}] [${prefix}] ${message}`;
}

/**
 * Create a logger instance with a prefix
 */
export function createLogger(prefix: string) {
  return {
    debug(...args: unknown[]): void {
      if (shouldLog('debug')) {
        console.log(formatMessage('debug', prefix, ...args));
      }
    },

    info(...args: unknown[]): void {
      if (shouldLog('info')) {
        console.log(formatMessage('info', prefix, ...args));
      }
    },

    warn(...args: unknown[]): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', prefix, ...args));
      }
    },

    error(...args: unknown[]): void {
      if (shouldLog('error')) {
        console.error(formatMessage('error', prefix, ...args));
      }
    },

    /** Check if debug logging is enabled */
    isDebugEnabled(): boolean {
      return shouldLog('debug');
    },

    /** Check if info logging is enabled */
    isInfoEnabled(): boolean {
      return shouldLog('info');
    },
  };
}

/**
 * Default logger for general use
 */
export const log = createLogger('han');
