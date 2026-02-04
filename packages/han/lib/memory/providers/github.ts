/**
 * GitHub Memory Provider
 *
 * Extracts observations from GitHub PRs, Issues, and Reviews using the
 * hashi-github MCP server.
 *
 * @example
 * ```typescript
 * import { createGitHubProvider } from "./providers/github";
 *
 * const provider = createGitHubProvider(mcpClient, availableTools);
 *
 * if (await provider.isAvailable()) {
 *   const observations = await provider.extract({ since: Date.now() - 7 * 24 * 60 * 60 * 1000 });
 *   // Extract from PRs, reviews, and issues from last 7 days
 * }
 * ```
 */

import type {
  ExtractedObservation,
  ExtractOptions,
  MemoryProvider,
} from '../types.ts';

/**
 * MCP client interface for calling tools
 */
export interface MCPClient {
  callTool(name: string, params: unknown): Promise<unknown>;
}

/**
 * GitHub Pull Request from MCP
 */
interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  author: string;
  state: string;
  created_at: number;
  merged_at: number | null;
  files: string[];
}

/**
 * GitHub Review from MCP
 */
interface GitHubReview {
  id: number;
  author: string;
  body: string;
  state: string;
  submitted_at: number;
  files_commented: string[];
}

/**
 * GitHub Issue from MCP
 */
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  author: string;
  state: string;
  created_at: number;
  labels: string[];
  assignees: string[];
}

/**
 * Creates a GitHub memory provider
 *
 * @param mcpClient - MCP client for calling GitHub tools
 * @param availableTools - Set of available MCP tool names
 * @returns GitHub memory provider
 */
export function createGitHubProvider(
  mcpClient: MCPClient,
  availableTools: Set<string>
): MemoryProvider {
  // Required MCP tool names
  const REQUIRED_TOOLS = [
    'mcp__plugin_hashi-github_github__list_pull_requests',
    'mcp__plugin_hashi-github_github__pull_request_read',
    'mcp__plugin_hashi-github_github__list_issues',
  ];

  // Cache PRs for enrichment
  const cachedPRs: Map<number, GitHubPullRequest> = new Map();

  return {
    name: 'github',

    async isAvailable(): Promise<boolean> {
      // Check if all required tools are available
      return REQUIRED_TOOLS.every((tool) => availableTools.has(tool));
    },

    async extract(options: ExtractOptions): Promise<ExtractedObservation[]> {
      const observations: ExtractedObservation[] = [];

      // Extract from Pull Requests
      try {
        const prResult = (await mcpClient.callTool(
          'mcp__plugin_hashi-github_github__list_pull_requests',
          {
            state: 'all',
            since: options.since,
          }
        )) as { pull_requests: GitHubPullRequest[] };

        const prs = prResult.pull_requests || [];

        for (const pr of prs) {
          // Cache PR for enrichment
          cachedPRs.set(pr.number, pr);

          // Determine type: merged = decision, open = discussion
          const type = pr.state === 'merged' ? 'decision' : 'discussion';

          // Use merged_at for merged PRs, created_at for open ones
          const timestamp = pr.merged_at || pr.created_at;

          observations.push({
            source: `github:pr:${pr.number}`,
            type,
            timestamp,
            author: pr.author,
            summary: pr.title,
            detail: pr.body,
            files: pr.files,
          });

          // Extract reviews for this PR
          try {
            const reviewResult = (await mcpClient.callTool(
              'mcp__plugin_hashi-github_github__pull_request_read',
              { pr: pr.number }
            )) as { reviews?: GitHubReview[] };

            const reviews = reviewResult.reviews || [];

            for (const review of reviews) {
              observations.push({
                source: `github:review:${pr.number}:${review.id}`,
                type: 'discussion',
                timestamp: review.submitted_at,
                author: review.author,
                summary: `Review on PR #${pr.number}: ${pr.title}`,
                detail: review.body,
                files: review.files_commented,
              });
            }
          } catch (error) {
            // Review extraction failed, continue with other PRs
            console.error(
              `Failed to extract reviews for PR #${pr.number}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error('Failed to extract PRs:', error);
      }

      // Extract from Issues
      try {
        const issueResult = (await mcpClient.callTool(
          'mcp__plugin_hashi-github_github__list_issues',
          {
            state: 'all',
            since: options.since,
          }
        )) as { issues: GitHubIssue[] };

        const issues = issueResult.issues || [];

        for (const issue of issues) {
          // Build detail with labels and assignees
          let detail = issue.body;
          if (issue.labels.length > 0) {
            detail += `\n\nlabels: ${issue.labels.join(', ')}`;
          }
          if (issue.assignees.length > 0) {
            detail += `\nassignees: ${issue.assignees.join(', ')}`;
          }

          observations.push({
            source: `github:issue:${issue.number}`,
            type: 'issue',
            timestamp: issue.created_at,
            author: issue.author,
            summary: issue.title,
            detail,
            files: [], // Issues don't have specific files
          });
        }
      } catch (error) {
        console.error('Failed to extract issues:', error);
      }

      return observations;
    },

    async enrich(
      observations: ExtractedObservation[]
    ): Promise<ExtractedObservation[]> {
      // Enrich git commits with PR context
      // Match commits to PRs by checking if commit files overlap with PR files

      for (const obs of observations) {
        if (obs.source.startsWith('git:commit:')) {
          // Find PR that contains these files
          for (const [prNumber, pr] of cachedPRs) {
            // Check if any of the commit's files are in the PR
            const hasOverlap = obs.files.some((file) =>
              pr.files.includes(file)
            );

            if (hasOverlap) {
              obs.pr_context = {
                number: prNumber,
                title: pr.title,
                description: pr.body,
              };
              break; // Use first matching PR
            }
          }
        }
      }

      return observations;
    },
  };
}
