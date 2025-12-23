/**
 * Dashboard Page Utilities
 *
 * Helper functions for dashboard display.
 */

/**
 * Get frustration level badge variant
 */
export function getFrustrationVariant(
  rate: number
): 'success' | 'warning' | 'danger' | 'default' {
  if (rate === 0) return 'success';
  if (rate < 0.1) return 'default';
  if (rate < 0.25) return 'warning';
  return 'danger';
}

/**
 * Get frustration level label
 */
export function getFrustrationLabel(rate: number): string {
  if (rate === 0) return 'None';
  if (rate < 0.1) return 'Low';
  if (rate < 0.25) return 'Moderate';
  return 'High';
}

/**
 * Get badge variant for task type
 */
export function getTaskTypeVariant(
  type: string | null | undefined
): 'default' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'IMPLEMENTATION':
      return 'success';
    case 'FIX':
      return 'danger';
    case 'REFACTOR':
      return 'warning';
    case 'RESEARCH':
      return 'default';
    default:
      return 'default';
  }
}
