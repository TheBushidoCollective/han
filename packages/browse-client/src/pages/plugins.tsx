/**
 * Plugins Page (/plugins)
 *
 * Shows only USER scope plugins (installed in user settings).
 * For project/local plugins, see /repos/{repoId}/plugins
 */
import PluginListPage from '@/components/pages/PluginListPage';

export default function Page() {
  return <PluginListPage scopeMode="user" />;
}
