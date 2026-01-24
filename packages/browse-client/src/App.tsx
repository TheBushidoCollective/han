import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRoutes } from 'react-router-dom';
import type { ToastType } from '@/components/organisms';
import { ToastContainer } from '@/components/organisms';
import { Box, Center, Text } from '@/components/atoms';
import { Sidebar } from '@/components/templates/Sidebar';
import {
  type MemoryUpdateEvent,
  useMemoryUpdates,
} from '@/hooks/useSubscription';
import { RelayProvider } from '@/relay';
import { colors, fonts } from '@/theme';
import type { ViewStyle } from 'react-native';
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

const appStyle: ViewStyle = {
  display: 'flex',
  flexDirection: 'row',
  minHeight: '100vh' as unknown as number,
  backgroundColor: colors.bg.primary,
  color: colors.text.primary,
  fontFamily: fonts.body,
};

const mainContentStyle: ViewStyle = {
  flex: 1,
  marginLeft: 220,
  height: '100vh' as unknown as number,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const loadingStyle: ViewStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
  );
}
