/**
 * Status Indicator Molecule
 *
 * Displays found/not found status badge.
 * Simple boolean-to-badge mapping for existence checks.
 */

import type React from 'react';
import { Badge } from '../atoms/index.ts';

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
