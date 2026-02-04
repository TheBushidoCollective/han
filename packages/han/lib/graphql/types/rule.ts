/**
 * GraphQL Rule type
 *
 * Represents a rule file from .claude/rules/
 */

import { readFileSync } from 'node:fs';
import {
  listAllRules,
  type RuleContent,
  type RuleFileWithProject,
} from '../../api/rules.ts';
import { builder } from '../builder.ts';
import { getAllProjects } from './project.ts';

/**
 * Rule scope enum
 */
export const RuleScopeEnum = builder.enumType('RuleScope', {
  values: ['PROJECT', 'USER'] as const,
  description: 'Scope of a rule file',
});

/**
 * Rule data type - includes project info
 */
type RuleData =
  | RuleFileWithProject
  | (RuleContent & { projectPath?: string; projectName?: string });
const RuleRef = builder.objectRef<RuleData>('Rule');

/**
 * Rule type implementation
 */
export const RuleType = RuleRef.implement({
  description: 'A rule file from .claude/rules/',
  fields: (t) => ({
    id: t.id({
      description: 'Rule ID',
      resolve: (rule) => {
        // Include project path in ID to make it unique across projects
        const projectPrefix =
          'projectPath' in rule && rule.projectPath
            ? rule.projectPath.replace(/[/\\]/g, '-')
            : '';
        return projectPrefix
          ? `${projectPrefix}:${rule.scope}:${rule.domain}`
          : `${rule.scope}:${rule.domain}`;
      },
    }),
    domain: t.exposeString('domain', {
      description: 'Domain/name of the rule',
    }),
    scope: t.field({
      type: RuleScopeEnum,
      description: 'Whether this is a project or user rule',
      resolve: (rule) => (rule.scope === 'project' ? 'PROJECT' : 'USER'),
    }),
    path: t.exposeString('path', {
      description: 'Full path to the rule file',
    }),
    projectPath: t.string({
      nullable: true,
      description: 'Project root path (null for user rules)',
      resolve: (rule) =>
        'projectPath' in rule ? (rule.projectPath ?? null) : null,
    }),
    projectName: t.string({
      nullable: true,
      description: 'Project display name (null for user rules)',
      resolve: (rule) =>
        'projectName' in rule ? (rule.projectName ?? null) : null,
    }),
    content: t.string({
      description: 'Rule content',
      resolve: (rule) => {
        // If already loaded (RuleContent), return it
        if ('content' in rule && typeof rule.content === 'string') {
          return rule.content;
        }
        // Both RuleFileWithProject and RuleContent have path - read from file
        try {
          return readFileSync(rule.path, 'utf-8');
        } catch {
          return '';
        }
      },
    }),
    size: t.int({
      description: 'File size in bytes',
      resolve: (rule) => {
        if ('size' in rule) return rule.size as number;
        // For RuleContent, calculate from content
        if ('content' in rule && typeof rule.content === 'string') {
          return new TextEncoder().encode(rule.content).length;
        }
        return 0;
      },
    }),
  }),
});

/**
 * Get all rules from all registered projects and user scope
 */
export function getAllRules(): RuleData[] {
  // Get all registered projects
  const projects = getAllProjects();

  // Extract project paths and names from worktrees
  const projectPaths = projects.flatMap((p) => {
    // Get the main worktree (non-linked) or first worktree as the project path
    const mainWorktree = p.worktrees.find((w) => !w.isWorktree);
    const projectPath = mainWorktree?.path || p.worktrees[0]?.path;
    if (!projectPath) return [];
    return [{ path: projectPath, name: p.displayName }];
  });

  // Use the new listAllRules that handles all projects
  return listAllRules(projectPaths);
}
