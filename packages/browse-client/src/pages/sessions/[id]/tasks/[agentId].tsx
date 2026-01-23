/**
 * Agent Task Detail Page (/sessions/:sessionId/tasks/:agentId)
 *
 * Shows the details of an agent task spawned during a session.
 * The agent task is essentially a sub-session with its own messages,
 * tools, and execution context.
 */
import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Heading, Text, VStack } from '@/components/atoms';
import SessionDetailPage from '@/components/pages/SessionDetailPage';
import { colors, spacing } from '@/theme';

export default function AgentTaskPage() {
  const { id: sessionId, agentId } = useParams<{
    id: string;
    agentId: string;
  }>();

  if (!sessionId || !agentId) {
    return (
      <Box
        style={{
          padding: spacing.xl,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <VStack gap="md">
          <Heading size="xl">Invalid Task</Heading>
          <Text style={{ color: colors.text.muted }}>
            Missing session ID or agent ID
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Suspense
      fallback={
        <Box
          style={{
            padding: spacing.xl,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <Text style={{ color: colors.text.muted }}>Loading task...</Text>
        </Box>
      }
    >
      {/*
        Render the agent's session using SessionDetailPage.
        The agentId IS the session ID for the spawned agent.
        We pass it as the session parameter.
      */}
      <SessionDetailPage
        sessionIdOverride={agentId}
        parentSessionId={sessionId}
        isAgentTask={true}
      />
    </Suspense>
  );
}
