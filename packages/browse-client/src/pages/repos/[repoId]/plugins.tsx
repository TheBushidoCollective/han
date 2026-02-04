/**
 * Repo Plugins Page (/repos/:repoId/plugins)
 *
 * Shows PROJECT and LOCAL scope plugins for this project.
 * For user plugins, see /plugins
 */
import PluginListPage from "@/components/pages/PluginListPage";

export default function Page() {
	return <PluginListPage scopeMode="project" />;
}
