/**
 * Session Detail Page (/sessions/:id)
 *
 * Since session IDs are globally unique UUIDs, we can access
 * them directly without needing a project context.
 */
import SessionDetailPage from '@/components/pages/SessionDetailPage';

export default function Page() {
  return <SessionDetailPage />;
}
