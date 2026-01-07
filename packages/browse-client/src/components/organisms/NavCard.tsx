/**
 * Nav Card Organism
 *
 * Navigation card for linking to sub-pages with icon, title, and description.
 * Unified component for navigation needs across the app.
 */

import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, HStack, Text, theme, VStack } from '../atoms/index.ts';

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
