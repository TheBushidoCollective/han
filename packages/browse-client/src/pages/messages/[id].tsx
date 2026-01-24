/**
 * Message Detail Page (/messages/:id)
 *
 * Since message IDs are globally unique UUIDs, we can access
 * them directly without needing a session context.
 */
import MessageDetailPage from '@/components/pages/MessageDetailPage';

export default function Page() {
  return <MessageDetailPage />;
}
