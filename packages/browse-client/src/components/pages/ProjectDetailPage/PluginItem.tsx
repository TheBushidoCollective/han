/**
 * Plugin Item Component
 *
 * Displays a plugin with category icon and status.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Link } from '@/components/atoms/Link.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { Plugin } from './types.ts';
import { categoryIcons, getPluginUrl, scopeLabels } from './utils.ts';

interface PluginItemProps {
  plugin: Plugin;
}

export function PluginItem({ plugin }: PluginItemProps): React.ReactElement {
  const pluginUrl = getPluginUrl(plugin);

  return (
    <Link href={pluginUrl} external style={{ textDecoration: 'none' }}>
      <Card
        hoverable
        style={{
          padding: theme.spacing.md,
          opacity: plugin.enabled ? 1 : 0.6,
        }}
      >
        <HStack justify="space-between" align="center">
          <HStack gap="sm" align="center">
            <Text size="lg">{categoryIcons[plugin.category] || '📦'}</Text>
            <VStack gap="xs">
              <Text weight={500}>{plugin.name}</Text>
              <Text color="muted" size="xs">
                {scopeLabels[plugin.scope] || plugin.scope} •{' '}
                {plugin.marketplace}
              </Text>
            </VStack>
          </HStack>
          <Badge variant={plugin.enabled ? 'success' : 'default'}>
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </HStack>
      </Card>
    </Link>
  );
}
