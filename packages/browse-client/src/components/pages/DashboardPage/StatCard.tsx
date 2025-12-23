/**
 * Stat Card Component
 *
 * Displays a statistic with label, value, and optional sub-value.
 */

import type React from 'react';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  subValue,
  onClick,
}: StatCardProps): React.ReactElement {
  return (
    <Card onClick={onClick} hoverable={!!onClick}>
      <VStack gap="xs">
        <Text color="secondary" size="sm">
          {label}
        </Text>
        <Heading size="xl">{value}</Heading>
        {subValue && (
          <Text color="muted" size="xs">
            {subValue}
          </Text>
        )}
      </VStack>
    </Card>
  );
}
