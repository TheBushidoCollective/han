/**
 * Hook Check State Message Card
 *
 * Displays when hooks are checked to determine if validation is needed.
 */

import { graphql, useFragment } from 'react-relay';
import { Box, HStack, Text, VStack } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge';
import type { HookCheckStateMessageCard_message$key } from './__generated__/HookCheckStateMessageCard_message.graphql';
import { MessageWrapper, useMessageContext } from './shared.tsx';

const HookCheckStateMessageFragment = graphql`
  fragment HookCheckStateMessageCard_message on HookCheckStateMessage {
    id
    timestamp
    hookType
    fingerprint
    hooksCount
  }
`;

interface HookCheckStateMessageCardProps {
  fragmentRef: HookCheckStateMessageCard_message$key;
}

export function HookCheckStateMessageCard({
  fragmentRef,
}: HookCheckStateMessageCardProps) {
  const message = useFragment(HookCheckStateMessageFragment, fragmentRef);
  const { isExpanded } = useMessageContext();

  return (
    <MessageWrapper>
      <VStack gap="sm">
        <HStack gap="sm" style={{ alignItems: 'center' }}>
          <Text size="sm" weight="semibold">
            Hook Check: {message.hookType}
          </Text>
          <Badge variant="info">{message.hooksCount} hook(s) pending</Badge>
        </HStack>

        {isExpanded && (
          <Box
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#6b7280',
              marginTop: '4px',
            }}
          >
            <Text size="xs" color="muted">
              Fingerprint: {message.fingerprint.substring(0, 16)}...
            </Text>
          </Box>
        )}
      </VStack>
    </MessageWrapper>
  );
}
