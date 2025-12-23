/**
 * Shared types for session detail components
 */

export interface Message {
  id: string;
  type: 'USER' | 'ASSISTANT' | 'SUMMARY';
  content: string | null;
  timestamp: string;
  isToolOnly: boolean;
}

export interface Checkpoint {
  id: string;
  checkpointId: string;
  type: 'SESSION' | 'AGENT';
  createdAt: string;
  fileCount: number;
  patternCount: number;
  patterns: string[];
}

export interface HookExecution {
  id: string;
  hookType: string;
  hookName: string;
  hookSource: string | null;
  durationMs: number;
  passed: boolean;
  output: string | null;
  error: string | null;
  timestamp: string;
}

export interface HookTypeStat {
  hookType: string;
  total: number;
  passed: number;
}

export interface HookStats {
  totalHooks: number;
  passedHooks: number;
  failedHooks: number;
  totalDurationMs: number;
  passRate: number;
  byHookType: HookTypeStat[];
}

export interface Task {
  id: string;
  taskId: string;
  description: string;
  type: 'IMPLEMENTATION' | 'FIX' | 'REFACTOR' | 'RESEARCH';
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null;
  confidence: number | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface Session {
  id: string;
  sessionId: string;
  date: string;
  projectName: string;
  projectPath: string;
  worktreeName: string | null;
  summary: string | null;
  messageCount: number;
  startedAt: string | null;
  updatedAt: string | null;
  gitBranch: string | null;
  version: string | null;
  checkpoints: Checkpoint[];
  hookExecutions: HookExecution[];
  hookStats: HookStats;
  tasks: Task[];
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}
