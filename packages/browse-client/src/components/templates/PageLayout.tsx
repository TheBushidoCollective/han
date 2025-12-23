/**
 * Page Layout Template
 *
 * Main application layout with sidebar and content area.
 * This is the template that wraps all pages.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import type { ToastType } from '../organisms/index.ts';
import { ToastContainer } from '../organisms/index.ts';
import { Sidebar } from './Sidebar.tsx';

interface PageLayoutProps {
  children: ReactNode;
  toasts: ToastType[];
  onDismissToast: (id: number) => void;
}

export function PageLayout({
  children,
  toasts,
  onDismissToast,
}: PageLayoutProps): React.ReactElement {
  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">{children}</main>
      <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
    </div>
  );
}
