/**
 * Stat Card Component
 *
 * Displays a statistic with label and value.
 */

import type React from 'react';
import { Card } from '@/components/atoms/Card.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps): React.ReactElement {
  return (
    <Card>
      <VStack gap="xs">
        <Text size="xl" weight={600}>
          {value}
        </Text>
        <Text size="sm" color="secondary">
          {label}
        </Text>
      </VStack>
    </Card>
  );
}
