/**
 * Status Item Component
 *
 * Displays a label-value pair in status grids.
 */

import type React from 'react';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';

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
      <Text weight={500}>{value}</Text>
    </HStack>
  );
}
