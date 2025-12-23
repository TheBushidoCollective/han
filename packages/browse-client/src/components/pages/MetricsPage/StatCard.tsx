/**
 * Stat Card Component
 *
 * Displays a metric value with label and optional subvalue.
 */

import type React from 'react';
import { Card } from '@/components/atoms/Card.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
}

export function StatCard({
  label,
  value,
  subvalue,
}: StatCardProps): React.ReactElement {
  return (
    <Card>
      <VStack gap="xs">
        <Text size="xl" weight={600}>
          {value}
        </Text>
        <Text size="sm" color="secondary">
          {label}
        </Text>
        {subvalue && (
          <Text size="xs" color="muted">
            {subvalue}
          </Text>
        )}
      </VStack>
    </Card>
  );
}
