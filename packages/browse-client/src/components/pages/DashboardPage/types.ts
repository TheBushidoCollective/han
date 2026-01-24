/**
 * Dashboard Page Types
 *
 * Shared interfaces for dashboard page components.
 * Note: Session-related types are now handled by Relay fragments.
 */

/**
 * Memory event from subscription
 */
export interface MemoryEvent {
  memoryUpdated: {
    type: 'SESSION' | 'SUMMARY' | 'RULE' | 'OBSERVATION' | 'RELOAD';
    action: 'CREATED' | 'UPDATED' | 'DELETED';
    path: string;
    timestamp: string;
  };
}
