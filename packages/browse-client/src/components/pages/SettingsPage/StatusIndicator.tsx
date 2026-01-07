/**
 * Status Indicator Component
 *
 * Displays found/not found status badge.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';

interface StatusIndicatorProps {
  active: boolean;
}

export function StatusIndicator({
  active,
}: StatusIndicatorProps): React.ReactElement {
  return (
    <Badge variant={active ? 'success' : 'default'}>
      {active ? 'Found' : 'Not Found'}
    </Badge>
  );
}
