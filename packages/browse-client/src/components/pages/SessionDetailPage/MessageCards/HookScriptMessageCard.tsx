/**
 * HookScriptMessageCard Component
 *
 * Renders generic bash/cat script execution events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { HookScriptMessageCard_message$key } from './__generated__/HookScriptMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookScriptMessageCardFragment = graphql`
  fragment HookScriptMessageCard_message on HookScriptMessage {
    id
    timestamp
    rawJson
    plugin
    command
    durationMs
    exitCode
    success
    output
  }
`;

interface HookScriptMessageCardProps {
  fragmentRef: HookScriptMessageCard_message$key;
}

/**
 * Get role info for hook script message
 */
function getHookScriptRoleInfo(
  success: boolean | null | undefined
): MessageRoleInfo {
  return {
    label: 'Script',
    color: success ? '#a371f7' : '#f85149',
    icon: '📜',
  };
}

/**
 * Extract a short description from the command
 */
function getCommandSummary(command: string | null | undefined): string {
  if (!command) return 'unknown';

  // Handle bash commands
  if (command.startsWith('bash ')) {
    const scriptPath = command.replace('bash ', '').replace(/"/g, '');
    const scriptName = scriptPath.split('/').pop() ?? scriptPath;
    return `bash: ${scriptName}`;
  }

  // Handle cat commands
  if (command.startsWith('cat ')) {
    const filePath = command.replace('cat ', '').replace(/"/g, '');
    const fileName = filePath.split('/').pop() ?? filePath;
    return `cat: ${fileName}`;
  }

  // Truncate long commands
  return command.length > 50 ? `${command.substring(0, 47)}...` : command;
}

export function HookScriptMessageCard({
  fragmentRef,
}: HookScriptMessageCardProps): React.ReactElement {
  const data = useFragment(HookScriptMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookScriptRoleInfo(data.success);

  const badges = (
    <HStack gap="xs">
      {data.success ? (
        <Badge variant="success">Success</Badge>
      ) : (
        <Badge variant="danger">Exit {data.exitCode}</Badge>
      )}
      {data.durationMs && <Badge variant="default">{data.durationMs}ms</Badge>}
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
            borderLeft: `3px solid ${data.success ? '#a371f7' : '#f85149'}`,
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Command:
              </Text>
              <Text
                size="sm"
                weight="medium"
                style={{ fontFamily: 'monospace' }}
              >
                {getCommandSummary(data.command)}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Plugin:
              </Text>
              <Text size="sm">{data.plugin ?? 'unknown'}</Text>
            </HStack>
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
