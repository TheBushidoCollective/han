/**
 * Utility functions for RepoListPage
 */

/**
 * Convert a repo ID to a git URL format
 * e.g., "github-com-TheBushidoCollective-han" -> "github.com/TheBushidoCollective/han"
 */
export function formatRepoUrl(repoId: string): string {
  // Handle github-com prefix
  if (repoId.startsWith('github-com-')) {
    const rest = repoId.slice('github-com-'.length);
    // Split by dash, first part is org, rest is repo name
    const parts = rest.split('-');
    if (parts.length >= 2) {
      const org = parts[0];
      const repo = parts.slice(1).join('-');
      return `github.com/${org}/${repo}`;
    }
    return `github.com/${rest}`;
  }

  // Handle gitlab-com prefix
  if (repoId.startsWith('gitlab-com-')) {
    const rest = repoId.slice('gitlab-com-'.length);
    const parts = rest.split('-');
    if (parts.length >= 2) {
      const org = parts[0];
      const repo = parts.slice(1).join('-');
      return `gitlab.com/${org}/${repo}`;
    }
    return `gitlab.com/${rest}`;
  }

  // Handle bitbucket-org prefix
  if (repoId.startsWith('bitbucket-org-')) {
    const rest = repoId.slice('bitbucket-org-'.length);
    const parts = rest.split('-');
    if (parts.length >= 2) {
      const org = parts[0];
      const repo = parts.slice(1).join('-');
      return `bitbucket.org/${org}/${repo}`;
    }
    return `bitbucket.org/${rest}`;
  }

  // Fallback: replace first dash with dot, second dash with slash
  // This handles generic patterns like "host-org-repo"
  return repoId.replace(/-/, '.').replace(/-/, '/');
}
