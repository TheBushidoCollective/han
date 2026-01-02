/**
 * Repo Detail Page (/repos/:repoId)
 *
 * Uses the same DashboardPage layout as the global dashboard,
 * but with project-specific filtering.
 */
import { useParams } from 'react-router-dom';
import DashboardPage from '@/components/pages/DashboardPage';

export default function Page() {
  const { repoId } = useParams<{ repoId: string }>();
  return <DashboardPage repoId={repoId} />;
}
