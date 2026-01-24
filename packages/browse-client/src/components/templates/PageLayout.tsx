/**
 * Page Layout Template
 *
 * Main application layout with sidebar and content area.
 * This is the template that wraps all pages.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { colors, fonts, spacing } from '../../theme.ts';
import { Box } from '../atoms/index.ts';
import type { ToastType } from '../organisms/index.ts';
import { ToastContainer } from '../organisms/index.ts';
import { Sidebar } from './Sidebar.tsx';

interface PageLayoutProps {
  children: ReactNode;
  toasts: ToastType[];
  onDismissToast: (id: number) => void;
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
  padding: spacing.xl,
  marginLeft: 220,
  minHeight: '100vh' as unknown as number,
  overflowX: 'auto',
};

export function PageLayout({
  children,
  toasts,
  onDismissToast,
}: PageLayoutProps): React.ReactElement {
  return (
    <Box style={appStyle}>
      <Sidebar />
      <Box style={mainContentStyle}>{children}</Box>
      <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
    </Box>
  );
}
