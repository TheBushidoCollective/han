/**
 * Nav Card Component
 *
 * Navigation card for repo sub-pages.
 */

import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '@/components/atoms';
import { Card } from '@/components/atoms/Card.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface NavCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
}

export function NavCard({
  title,
  description,
  icon,
  href,
}: NavCardProps): React.ReactElement {
  const navigate = useNavigate();
  return (
    <Card
      hoverable
      onClick={() => navigate(href)}
      style={{ padding: theme.spacing.md }}
    >
      <HStack gap="md" align="center">
        <Text size="xl">{icon}</Text>
        <VStack gap="xs">
          <Text weight="semibold">{title}</Text>
          <Text color="muted" size="sm">
            {description}
          </Text>
        </VStack>
      </HStack>
    </Card>
  );
}
