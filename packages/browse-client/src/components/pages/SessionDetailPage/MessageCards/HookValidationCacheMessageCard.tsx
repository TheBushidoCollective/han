/**
 * HookValidationCacheMessageCard Component
 *
 * Renders hook validation cache events that track file hashes.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { HookValidationCacheMessageCard_message$key } from './__generated__/HookValidationCacheMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookValidationCacheMessageCardFragment = graphql`
  fragment HookValidationCacheMessageCard_message on HookValidationCacheMessage {
    id
    timestamp
    rawJson
    plugin
    hook
    directory
    fileCount
  }
`;

interface HookValidationCacheMessageCardProps {
  fragmentRef: HookValidationCacheMessageCard_message$key;
}

/**
 * Get role info for hook validation cache message
 */
function getHookValidationCacheRoleInfo(): MessageRoleInfo {
  return {
    label: 'Cache',
    color: '#58a6ff',
    icon: '💾',
  };
}

export function HookValidationCacheMessageCard({
  fragmentRef,
}: HookValidationCacheMessageCardProps): React.ReactElement {
  const data = useFragment(HookValidationCacheMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookValidationCacheRoleInfo();

  const badges = (
    <HStack gap="xs">
      <Badge variant="info">{data.fileCount} files</Badge>
    </HStack>
  );

  return (
    <MessageWrapper type="han_event" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={roleInfo}
        timestamp={data.timestamp}
        badges={badges}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <Box
          style={{
            borderLeft: '3px solid #58a6ff',
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Hook:
              </Text>
              <Text size="sm" weight="medium">
                {data.plugin}/{data.hook}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Directory:
              </Text>
              <Text
                size="xs"
                style={{
                  fontFamily: 'monospace',
                  color: '#8b949e',
                }}
              >
                {data.directory ?? '.'}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Files tracked:
              </Text>
              <Text size="sm">{data.fileCount}</Text>
            </HStack>
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
