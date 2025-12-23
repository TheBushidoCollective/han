/**
 * Stat Card Organism
 *
 * Displays a statistic with label, value, and optional sub-value.
 * Unified component for all stat display needs across the app.
 */

import type React from 'react';
import { Card, Heading, Text, theme, VStack } from '../atoms/index.ts';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  onClick?: () => void;
  centered?: boolean;
}

export function StatCard({
  label,
  value,
  subValue,
  onClick,
  centered = false,
}: StatCardProps): React.ReactElement {
  return (
    <Card
      onClick={onClick}
      hoverable={!!onClick}
      style={
        centered
          ? { padding: theme.spacing.md, textAlign: 'center' }
          : undefined
      }
    >
      <VStack gap="xs" align={centered ? 'center' : undefined}>
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
