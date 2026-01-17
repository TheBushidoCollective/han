/**
 * Plugin Card Component
 *
 * Displays a single plugin with toggle and remove actions.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { Plugin } from './types.ts';
import {
  formatScope,
  getCategoryBadgeVariant,
  getScopeBadgeVariant,
} from './utils.ts';

interface PluginCardProps {
  plugin: Plugin;
  onToggle: (plugin: Plugin) => void;
  onRemove: (plugin: Plugin) => void;
  isLoading: boolean;
}

export function PluginCard({
  plugin,
  onToggle,
  onRemove,
  isLoading,
}: PluginCardProps): React.ReactElement {
  return (
    <Card
      style={{
        opacity: plugin.enabled ? 1 : 0.7,
      }}
    >
      <VStack gap="md">
        <HStack justify="space-between" align="flex-start">
          <Text weight="semibold" size="md">
            {plugin.name}
          </Text>
          <HStack gap="xs">
            <Badge variant={getCategoryBadgeVariant(plugin.category)}>
              {plugin.category}
            </Badge>
            <Badge variant={getScopeBadgeVariant(plugin.scope)}>
              {formatScope(plugin.scope)}
            </Badge>
          </HStack>
        </HStack>
        <Text size="sm" color="muted">
          @{plugin.marketplace}
        </Text>
        <HStack gap="sm">
          <a
            href={`https://han.guru/plugins/${plugin.category?.toLowerCase() || 'core'}/${plugin.name}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-accent-primary)',
              textDecoration: 'none',
            }}
          >
            View on han.guru
          </a>
        </HStack>
        <HStack gap="sm">
          <Button
            size="sm"
            onClick={() => onToggle(plugin)}
            disabled={isLoading}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRemove(plugin)}
            disabled={isLoading}
          >
            Remove
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}
