/**
 * Unit tests for GitHub Memory Provider
 * Tests extraction of observations from GitHub PRs, Issues, and Reviews
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { createGitHubProvider } from '../lib/memory/providers/github.ts';
import type { ExtractedObservation } from '../lib/memory/types.ts';

// Mock MCP client interface
interface MCPClient {
  callTool(name: string, params: unknown): Promise<unknown>;
}

// Mock MCP tool responses
const mockPullRequests = [
  {
    number: 123,
    title: 'Add authentication system',
    body: 'Implements JWT-based auth with refresh tokens',
    author: 'alice',
    state: 'merged',
    created_at: 1700000000000,
    merged_at: 1700010000000,
    files: ['src/auth/jwt.ts', 'src/auth/refresh.ts'],
  },
  {
    number: 124,
    title: 'Fix payment processing',
    body: 'Resolves issue with Stripe webhooks',
    author: 'bob',
    state: 'open',
    created_at: 1700020000000,
    merged_at: null,
    files: ['src/payments/stripe.ts'],
  },
];

const mockPRReviews = {
  123: [
    {
      id: 1001,
      author: 'charlie',
      body: 'LGTM, nice work on the token refresh logic',
      state: 'APPROVED',
      submitted_at: 1700005000000,
      files_commented: ['src/auth/refresh.ts'],
    },
  ],
  124: [
    {
      id: 1002,
      author: 'alice',
      body: 'Should we add retry logic for webhook failures?',
      state: 'COMMENT',
      submitted_at: 1700025000000,
      files_commented: ['src/payments/stripe.ts'],
    },
  ],
};

const mockIssues = [
  {
    number: 50,
    title: 'Payment webhooks timing out',
    body: 'Stripe webhooks are failing under high load',
    author: 'dave',
    state: 'open',
    created_at: 1700015000000,
    labels: ['bug', 'payments'],
    assignees: ['bob'],
  },
  {
    number: 51,
    title: 'Add OAuth support',
    body: 'Support Google and GitHub OAuth providers',
    author: 'alice',
    state: 'open',
    created_at: 1700030000000,
    labels: ['enhancement', 'auth'],
    assignees: ['alice'],
  },
];

// Create mock MCP client
function createMockMCPClient(availableTools: string[] = []): {
  client: MCPClient;
  availableTools: Set<string>;
} {
  const tools = new Set(availableTools);

  const client: MCPClient = {
    async callTool(name: string, params: unknown) {
      if (!tools.has(name)) {
        throw new Error(`Tool ${name} not available`);
      }

      // Parse tool name to extract the actual GitHub operation
      if (name.includes('list_pull_requests')) {
        const p = params as { state?: string; since?: number };
        let prs = [...mockPullRequests];

        if (p.since !== undefined) {
          const since = p.since;
          prs = prs.filter((pr) => pr.created_at >= since);
        }

        return { pull_requests: prs };
      }

      if (
        name.includes('pull_request_read') ||
        name.includes('get_pr_reviews')
      ) {
        const p = params as { pr: number };
        return {
          reviews: mockPRReviews[p.pr as keyof typeof mockPRReviews] || [],
        };
      }

      if (name.includes('list_issues')) {
        const p = params as { state?: string; since?: number };
        let issues = [...mockIssues];

        if (p.since !== undefined) {
          const since = p.since;
          issues = issues.filter((issue) => issue.created_at >= since);
        }

        return { issues };
      }

      throw new Error(`Unknown tool: ${name}`);
    },
  };

  return { client, availableTools: tools };
}

describe('GitHub Provider - Availability', () => {
  test('returns true when hashi-github tools are available', async () => {
    const { client, availableTools } = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
      'mcp__plugin_hashi-github_github__pull_request_read',
      'mcp__plugin_hashi-github_github__list_issues',
    ]);

    const provider = createGitHubProvider(client, availableTools);
    expect(await provider.isAvailable()).toBe(true);
  });

  test('returns false when hashi-github tools are not available', async () => {
    const { client, availableTools } = createMockMCPClient([]);

    const provider = createGitHubProvider(client, availableTools);
    expect(await provider.isAvailable()).toBe(false);
  });

  test('returns false when only some tools are available', async () => {
    const { client, availableTools } = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
    ]);

    const provider = createGitHubProvider(client, availableTools);
    expect(await provider.isAvailable()).toBe(false);
  });
});

describe('GitHub Provider - Extract PRs', () => {
  let client: MCPClient;
  let availableTools: Set<string>;

  beforeEach(() => {
    const mock = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
      'mcp__plugin_hashi-github_github__pull_request_read',
      'mcp__plugin_hashi-github_github__list_issues',
    ]);
    client = mock.client;
    availableTools = mock.availableTools;
  });

  test('extracts merged PRs as decisions', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({});

    const prObservations = observations.filter((obs) =>
      obs.source.startsWith('github:pr:')
    );
    const mergedPR = prObservations.find(
      (obs) => obs.source === 'github:pr:123'
    );

    expect(mergedPR).toBeDefined();
    expect(mergedPR?.type).toBe('decision');
    expect(mergedPR?.author).toBe('alice');
    expect(mergedPR?.summary).toBe('Add authentication system');
    expect(mergedPR?.detail).toBe(
      'Implements JWT-based auth with refresh tokens'
    );
    expect(mergedPR?.files).toEqual(['src/auth/jwt.ts', 'src/auth/refresh.ts']);
    expect(mergedPR?.timestamp).toBe(1700010000000); // merged_at
  });

  test('extracts open PRs as discussions', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({});

    const openPR = observations.find((obs) => obs.source === 'github:pr:124');

    expect(openPR).toBeDefined();
    expect(openPR?.type).toBe('discussion');
    expect(openPR?.timestamp).toBe(1700020000000); // created_at
  });

  test('respects since filter', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({ since: 1700020000000 });

    const prObservations = observations.filter((obs) =>
      obs.source.startsWith('github:pr:')
    );

    // Should only include PR 124 (created at 1700020000000)
    expect(prObservations.length).toBe(1);
    expect(prObservations[0].source).toBe('github:pr:124');
  });
});

describe('GitHub Provider - Extract Reviews', () => {
  let client: MCPClient;
  let availableTools: Set<string>;

  beforeEach(() => {
    const mock = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
      'mcp__plugin_hashi-github_github__pull_request_read',
      'mcp__plugin_hashi-github_github__list_issues',
    ]);
    client = mock.client;
    availableTools = mock.availableTools;
  });

  test('extracts PR review comments as discussions', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({});

    const reviewObservations = observations.filter((obs) =>
      obs.source.startsWith('github:review:')
    );

    expect(reviewObservations.length).toBeGreaterThan(0);

    const review = reviewObservations.find(
      (obs) => obs.source === 'github:review:123:1001'
    );
    expect(review).toBeDefined();
    expect(review?.type).toBe('discussion');
    expect(review?.author).toBe('charlie');
    expect(review?.summary).toBe(
      'Review on PR #123: Add authentication system'
    );
    expect(review?.detail).toBe('LGTM, nice work on the token refresh logic');
    expect(review?.timestamp).toBe(1700005000000);
  });

  test('includes files commented on in reviews', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({});

    const review = observations.find(
      (obs) => obs.source === 'github:review:123:1001'
    );
    expect(review?.files).toEqual(['src/auth/refresh.ts']);
  });
});

describe('GitHub Provider - Extract Issues', () => {
  let client: MCPClient;
  let availableTools: Set<string>;

  beforeEach(() => {
    const mock = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
      'mcp__plugin_hashi-github_github__pull_request_read',
      'mcp__plugin_hashi-github_github__list_issues',
    ]);
    client = mock.client;
    availableTools = mock.availableTools;
  });

  test('extracts issues with correct type', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({});

    const issueObservations = observations.filter((obs) =>
      obs.source.startsWith('github:issue:')
    );

    expect(issueObservations.length).toBe(2);

    const issue = issueObservations.find(
      (obs) => obs.source === 'github:issue:50'
    );
    expect(issue).toBeDefined();
    expect(issue?.type).toBe('issue');
    expect(issue?.author).toBe('dave');
    expect(issue?.summary).toBe('Payment webhooks timing out');
    expect(issue?.detail).toContain(
      'Stripe webhooks are failing under high load'
    );
    expect(issue?.detail).toContain('labels: bug, payments');
    expect(issue?.detail).toContain('assignees: bob');
  });

  test('respects since filter for issues', async () => {
    const provider = createGitHubProvider(client, availableTools);
    const observations = await provider.extract({ since: 1700030000000 });

    const issueObservations = observations.filter((obs) =>
      obs.source.startsWith('github:issue:')
    );

    // Should only include issue 51
    expect(issueObservations.length).toBe(1);
    expect(issueObservations[0].source).toBe('github:issue:51');
  });
});

describe('GitHub Provider - Enrich', () => {
  let client: MCPClient;
  let availableTools: Set<string>;

  beforeEach(() => {
    const mock = createMockMCPClient([
      'mcp__plugin_hashi-github_github__list_pull_requests',
      'mcp__plugin_hashi-github_github__pull_request_read',
      'mcp__plugin_hashi-github_github__list_issues',
    ]);
    client = mock.client;
    availableTools = mock.availableTools;
  });

  test('adds PR context to git commits', async () => {
    const provider = createGitHubProvider(client, availableTools);

    // Mock git commit observations
    const gitCommits: ExtractedObservation[] = [
      {
        source: 'git:commit:abc123',
        type: 'commit',
        timestamp: 1700008000000,
        author: 'alice',
        summary: 'Implement JWT auth',
        detail: 'Added JWT token generation and validation',
        files: ['src/auth/jwt.ts'],
      },
      {
        source: 'git:commit:def456',
        type: 'commit',
        timestamp: 1700009000000,
        author: 'alice',
        summary: 'Add refresh token support',
        detail: 'Implemented token refresh mechanism',
        files: ['src/auth/refresh.ts'],
      },
    ];

    // First, extract GitHub observations to populate internal state
    await provider.extract({});

    // Now enrich the git commits
    const enriched = await provider.enrich?.(gitCommits);
    if (!enriched) throw new Error('enrich not implemented');

    // Check that commits matching PR files have PR context
    const commit1 = enriched.find((obs) => obs.source === 'git:commit:abc123');
    expect(commit1?.pr_context).toBeDefined();
    expect(commit1?.pr_context?.number).toBe(123);
    expect(commit1?.pr_context?.title).toBe('Add authentication system');

    const commit2 = enriched.find((obs) => obs.source === 'git:commit:def456');
    expect(commit2?.pr_context).toBeDefined();
    expect(commit2?.pr_context?.number).toBe(123);
  });

  test('leaves commits without matching PRs unchanged', async () => {
    const provider = createGitHubProvider(client, availableTools);

    const gitCommits: ExtractedObservation[] = [
      {
        source: 'git:commit:xyz789',
        type: 'commit',
        timestamp: 1700000000000,
        author: 'eve',
        summary: 'Update README',
        detail: 'Fixed typos',
        files: ['README.md'],
      },
    ];

    await provider.extract({});
    const enriched = await provider.enrich?.(gitCommits);
    if (!enriched) throw new Error('enrich not implemented');

    const commit = enriched.find((obs) => obs.source === 'git:commit:xyz789');
    expect(commit?.pr_context).toBeUndefined();
  });
});
