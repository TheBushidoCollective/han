/**
 * Status Item Molecule
 *
 * Displays a label-value pair in horizontal layout.
 * Used for key-value displays in status grids.
 */

import type React from 'react';
import { HStack, Text } from '../atoms/index.ts';

interface StatusItemProps {
  label: string;
  value: string | number;
}

export function StatusItem({
  label,
  value,
}: StatusItemProps): React.ReactElement {
  return (
    <HStack justify="space-between" align="center">
      <Text color="secondary" size="sm">
        {label}
      </Text>
      <Text weight="medium">{value}</Text>
    </HStack>
  );
}
