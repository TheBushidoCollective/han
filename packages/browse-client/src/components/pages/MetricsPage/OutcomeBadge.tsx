/**
 * Outcome Badge Component
 *
 * Displays a badge for task outcome with appropriate color.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';

interface OutcomeBadgeProps {
  outcome: string | null | undefined;
}

export function OutcomeBadge({
  outcome,
}: OutcomeBadgeProps): React.ReactElement {
  if (!outcome) return <Badge variant="default">-</Badge>;

  const variants: Record<
    string,
    'default' | 'success' | 'warning' | 'danger' | 'purple'
  > = {
    SUCCESS: 'success',
    PARTIAL: 'warning',
    FAILURE: 'danger',
  };
  return (
    <Badge variant={variants[outcome] || 'default'}>
      {outcome.toLowerCase()}
    </Badge>
  );
}
