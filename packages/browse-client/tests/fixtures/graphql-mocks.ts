/**
 * GraphQL Mock Data
 *
 * Mock responses for GraphQL queries used in tests.
 */

export const mockDashboardData = {
  data: {
    viewer: {
      id: 'viewer-1',
      projects: [{ id: 'project-1' }, { id: 'project-2' }, { id: 'project-3' }],
      sessions: [
        {
          id: 'session-1',
          sessionId: 'abc123',
          date: '2024-01-15',
          startedAt: new Date().toISOString(),
          projectName: 'han',
          summary: 'Working on dashboard improvements',
          messageCount: 42,
          currentTodo: {
            content: 'Write tests',
            activeForm: 'Writing tests',
            status: 'IN_PROGRESS',
          },
          todoCounts: {
            total: 5,
            pending: 2,
            inProgress: 1,
            completed: 2,
          },
          currentTask: null,
        },
        {
          id: 'session-2',
          sessionId: 'def456',
          date: '2024-01-14',
          startedAt: new Date(Date.now() - 86400000).toISOString(),
          projectName: 'browse-client',
          summary: 'Setting up Relay',
          messageCount: 28,
          currentTodo: null,
          todoCounts: null,
          currentTask: {
            id: 'task-1',
            taskId: 'task-abc',
            description: 'Implement GraphQL integration',
            type: 'IMPLEMENTATION',
            status: 'ACTIVE',
          },
        },
      ],
      metrics: {
        totalTasks: 150,
        completedTasks: 120,
        successRate: 0.85,
        averageConfidence: 0.78,
        calibrationScore: 0.92,
        significantFrustrations: 3,
        significantFrustrationRate: 0.02,
      },
      checkpointStats: {
        totalCheckpoints: 25,
        sessionCheckpoints: 18,
        agentCheckpoints: 7,
      },
      pluginStats: {
        totalPlugins: 12,
        userPlugins: 5,
        projectPlugins: 7,
        enabledPlugins: 10,
      },
      pluginCategories: [
        { category: 'jutsu', count: 4 },
        { category: 'hashi', count: 3 },
        { category: 'do', count: 5 },
      ],
    },
  },
};

export const mockSessionsData = {
  data: {
    sessions: {
      edges: [
        {
          node: {
            id: 'session-1',
            sessionId: 'abc123',
            date: '2024-01-15',
            projectName: 'han',
            projectPath: '/Users/dev/han',
            worktreeName: null,
            summary: 'Dashboard improvements',
            messageCount: 42,
            startedAt: new Date().toISOString(),
            endedAt: null,
            gitBranch: 'main',
            version: '2.0.0',
          },
          cursor: 'cursor-1',
        },
        {
          node: {
            id: 'session-2',
            sessionId: 'def456',
            date: '2024-01-14',
            projectName: 'browse-client',
            projectPath: '/Users/dev/browse-client',
            worktreeName: null,
            summary: 'Relay setup',
            messageCount: 28,
            startedAt: new Date(Date.now() - 86400000).toISOString(),
            endedAt: new Date(Date.now() - 82800000).toISOString(),
            gitBranch: 'feature/relay',
            version: '0.1.0',
          },
          cursor: 'cursor-2',
        },
      ],
      pageInfo: {
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: 'cursor-1',
        endCursor: 'cursor-2',
      },
      totalCount: 50,
    },
  },
};

export const mockProjectsData = {
  data: {
    viewer: {
      id: 'viewer-1',
      projects: [
        {
          id: 'project-1',
          projectId: 'han',
          name: 'han',
          path: '/Users/dev/han',
          sessionCount: 25,
          lastAccessed: new Date().toISOString(),
          worktrees: [],
        },
        {
          id: 'project-2',
          projectId: 'browse-client',
          name: 'browse-client',
          path: '/Users/dev/browse-client',
          sessionCount: 10,
          lastAccessed: new Date(Date.now() - 3600000).toISOString(),
          worktrees: [],
        },
      ],
    },
  },
};

export const mockPluginsData = {
  data: {
    plugins: [
      {
        id: 'plugin-1',
        name: 'jutsu-typescript',
        type: 'jutsu',
        enabled: true,
        description: 'TypeScript validation hooks',
      },
      {
        id: 'plugin-2',
        name: 'hashi-github',
        type: 'hashi',
        enabled: true,
        description: 'GitHub MCP integration',
      },
      {
        id: 'plugin-3',
        name: 'do-accessibility',
        type: 'do',
        enabled: false,
        description: 'Accessibility specialist agent',
      },
    ],
  },
};

export const mockEmptyData = {
  data: {
    viewer: {
      id: 'viewer-1',
      projects: [],
      sessions: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        successRate: 0,
        averageConfidence: 0,
        calibrationScore: null,
        significantFrustrations: 0,
        significantFrustrationRate: 0,
      },
      checkpointStats: {
        totalCheckpoints: 0,
        sessionCheckpoints: 0,
        agentCheckpoints: 0,
      },
      pluginStats: {
        totalPlugins: 0,
        userPlugins: 0,
        projectPlugins: 0,
        enabledPlugins: 0,
      },
      pluginCategories: [],
    },
  },
};
