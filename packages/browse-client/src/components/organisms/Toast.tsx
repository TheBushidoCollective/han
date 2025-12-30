/**
 * Toast Organism
 *
 * Notification toast component and container for displaying alerts.
 */

import type React from 'react';
import type { CSSProperties } from 'react';
import {
  colors,
  createStyles,
  fontSizes,
  radii,
  shadows,
  spacing,
} from '../../theme.ts';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const styles = createStyles({
  container: {
    position: 'fixed' as const,
    bottom: spacing.xl,
    right: spacing.xl,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.sm,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderRadius: radii.md,
    boxShadow: shadows.lg,
    minWidth: 280,
    maxWidth: 400,
  },
  message: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  dismiss: {
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.text.muted,
    fontSize: fontSizes.lg,
    cursor: 'pointer',
    padding: spacing.xs,
    lineHeight: 1,
  },
});

const toastTypeStyles: Record<Toast['type'], CSSProperties> = {
  info: {
    backgroundColor: colors.bg.tertiary,
    borderLeft: `4px solid ${colors.primary}`,
  },
  success: {
    backgroundColor: colors.bg.tertiary,
    borderLeft: `4px solid ${colors.success}`,
  },
  warning: {
    backgroundColor: colors.bg.tertiary,
    borderLeft: `4px solid ${colors.warning}`,
  },
};

export function ToastContainer({
  toasts,
  onDismiss,
}: ToastContainerProps): React.ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{ ...styles.toast, ...toastTypeStyles[toast.type] }}
        >
          <span style={styles.message}>{toast.message}</span>
          <button
            type="button"
            style={styles.dismiss}
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
