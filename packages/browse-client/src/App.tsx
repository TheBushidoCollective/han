import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRoutes } from 'react-router-dom';
import { Box, Center, Text } from '@/components/atoms';
import type { ToastType } from '@/components/organisms';
import { ToastContainer } from '@/components/organisms';
import { Sidebar } from '@/components/templates/Sidebar';
import { ModeProvider } from '@/contexts';
import {
  type MemoryUpdateEvent,
  useMemoryUpdates,
} from '@/hooks/useSubscription';
import { RelayProvider } from '@/relay';
import { colors, fonts } from '@/theme';
import routes from '~react-pages';

function formatMemoryEvent(event: MemoryUpdateEvent): string {
  const typeLabels: Record<string, string> = {
    SESSION: 'Session',
    SUMMARY: 'Summary',
    RULE: 'Rule',
    OBSERVATION: 'Observation',
    RELOAD: 'Page',
  };
  const actionLabels: Record<string, string> = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
  };

  const type = typeLabels[event.type] || event.type;
  const action = actionLabels[event.action] || event.action;

  return `${type} ${action}`;
}

const appStyle = {
  display: 'flex' as const,
  flexDirection: 'row' as const,
  minHeight: '100vh',
  backgroundColor: colors.bg.primary,
  color: colors.text.primary,
  fontFamily: fonts.body,
};

const mainContentStyle = {
  flex: 1,
  marginLeft: 220,
  height: '100vh',
  overflowY: 'auto' as const,
  overflowX: 'hidden' as const,
  display: 'flex' as const,
  flexDirection: 'column' as const,
};

const loadingStyle = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  height: '100%',
  color: colors.text.muted,
};

export function App() {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType['type'] = 'info') => {
      const id = toastCounter;
      setToastCounter((c) => c + 1);
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        dismissToast(id);
      }, 5000);
    },
    [toastCounter, dismissToast]
  );

  const handleMemoryUpdate = useCallback(
    (event: MemoryUpdateEvent) => {
      if (event.type === 'RELOAD') {
        window.location.reload();
        return;
      }

      if (event.type === 'SESSION') {
        return;
      }

      const message = formatMemoryEvent(event);
      addToast(message, 'info');
    },
    [addToast]
  );

  const { error } = useMemoryUpdates(handleMemoryUpdate);

  useEffect(() => {
    if (error) {
      console.warn('Subscription error:', error.message);
    }
  }, [error]);

  // Routes from vite-plugin-pages
  const routeElement = useRoutes(routes);

  return (
    <ModeProvider>
      <RelayProvider>
        <Box style={appStyle}>
          <Sidebar />
          <Box style={mainContentStyle}>
            <Suspense
              fallback={
                <Center style={loadingStyle}>
                  <Text color="muted">Loading...</Text>
                </Center>
              }
            >
              {routeElement}
            </Suspense>
          </Box>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </Box>
      </RelayProvider>
    </ModeProvider>
  );
}
