/**
 * GraphQL FileChange type
 *
 * Represents a file that was changed during a session.
 *
 * Validation logic:
 * - Get all hook_executions for this session (which include if_changed patterns)
 * - For each file, check which hooks' if_changed patterns match the file path
 * - If a matching hook has a validation record -> validated (green)
 * - If a matching hook has NO validation record -> missing validation (yellow)
 * - If NO hooks match the file -> no hooks apply (different state)
 */

import micromatch from 'micromatch';
import type {
  SessionFileChange as FileChangeData,
  SessionFileValidation as FileValidationData,
} from '../../../grpc/data-access.ts';
import type { GraphQLContext } from '../../builder.ts';
import { builder } from '../../builder.ts';
import { FileChangeActionEnum } from './file-change-action-enum.ts';
import { FileValidationType } from './file-validation.ts';

export const FileChangeType = builder.objectRef<FileChangeData>('FileChange');

/**
 * Check if a file path matches any of the given glob patterns.
 * Patterns are relative to a directory, so we need to consider both:
 * - The full file path
 * - The file path relative to the hook's directory
 */
function fileMatchesPatterns(
  filePath: string,
  patterns: string[],
  hookDirectory: string | null
): boolean {
  if (patterns.length === 0) return false;

  // Get the filename for simple pattern matching
  const fileName = filePath.split('/').pop() ?? filePath;

  // Try matching against the full path
  if (micromatch.isMatch(filePath, patterns)) {
    return true;
  }

  // Try matching against just the filename
  if (micromatch.isMatch(fileName, patterns)) {
    return true;
  }

  // If we have a hook directory, try matching relative to that
  if (hookDirectory && hookDirectory !== '.') {
    // Check if file is in or under the hook directory
    if (filePath.startsWith(`${hookDirectory}/`)) {
      const relativePath = filePath.slice(hookDirectory.length + 1);
      if (micromatch.isMatch(relativePath, patterns)) {
        return true;
      }
    }
  }

  return false;
}

FileChangeType.implement({
  description: 'A file change that occurred during a session',
  fields: (t) => ({
    id: t.exposeString('id', {
      nullable: true,
      description: 'Unique identifier for this file change',
    }),
    sessionId: t.exposeString('sessionId', {
      description: 'The session ID this change belongs to',
    }),
    filePath: t.exposeString('filePath', {
      description: 'Path to the changed file',
    }),
    action: t.field({
      type: FileChangeActionEnum,
      description: 'The type of change (created, modified, deleted)',
      resolve: (fc) => fc.action as 'created' | 'modified' | 'deleted',
    }),
    fileHashBefore: t.exposeString('fileHashBefore', {
      nullable: true,
      description: 'SHA256 hash of file before change (if available)',
    }),
    fileHashAfter: t.exposeString('fileHashAfter', {
      nullable: true,
      description: 'SHA256 hash of file after change (if available)',
    }),
    toolName: t.exposeString('toolName', {
      nullable: true,
      description: 'The tool that made the change (Edit, Write, Bash)',
    }),
    recordedAt: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'When the change was recorded',
      resolve: (fc) => fc.recordedAt ?? null,
    }),
    /**
     * Hooks that have validated this file (validation record exists).
     * These should show as GREEN in the UI.
     */
    validations: t.field({
      type: [FileValidationType],
      description: 'Hook validations for this file (validated = green)',
      resolve: async (
        fc,
        _args,
        context: GraphQLContext
      ): Promise<FileValidationData[]> => {
        // Use DataLoader for batched loading (one query per session, not per file)
        const allValidations =
          await context.loaders.sessionFileValidationsLoader.load(fc.sessionId);
        return allValidations.filter((v) => v.filePath === fc.filePath);
      },
    }),
    isValidated: t.boolean({
      description: 'Whether this file has been validated by any hook',
      resolve: async (fc, _args, context: GraphQLContext): Promise<boolean> => {
        // Use DataLoader for batched loading (one query per session, not per file)
        const allValidations =
          await context.loaders.sessionFileValidationsLoader.load(fc.sessionId);
        return allValidations.some((v) => v.filePath === fc.filePath);
      },
    }),
    /**
     * Hooks whose if_changed patterns MATCH this file but have NOT validated it.
     * These should show as YELLOW in the UI (needs validation).
     *
     * Logic:
     * 1. Get all hook_executions for this session
     * 2. For each hook, parse its if_changed patterns (JSON array)
     * 3. Check if this file path matches any of the patterns
     * 4. If it matches AND there's no validation record -> missing validation
     */
    missingValidations: t.field({
      type: [FileValidationType],
      description:
        "Hooks whose patterns match this file but haven't validated it (yellow)",
      resolve: async (
        fc,
        _args,
        context: GraphQLContext
      ): Promise<FileValidationData[]> => {
        // Use DataLoaders for batched loading (one query per session, not per file)
        const [hookExecutions, allValidations] = await Promise.all([
          context.loaders.sessionHookExecutionsLoader.load(fc.sessionId),
          context.loaders.sessionFileValidationsLoader.load(fc.sessionId),
        ]);

        // Get existing validations for this specific file
        const fileValidations = allValidations.filter(
          (v) => v.filePath === fc.filePath
        );

        // Create a set of validated hook keys for quick lookup
        // Use simple plugin:hook key (directory not needed for display dedup)
        type HookKey = `${string}:${string}`;
        const validatedHooks = new Set<HookKey>();
        for (const v of fileValidations) {
          const key: HookKey = `${v.pluginName}:${v.hookName}`;
          validatedHooks.add(key);
        }

        // Find hooks that match this file but haven't validated it
        const missing: FileValidationData[] = [];
        const seenHooks = new Set<HookKey>();

        for (const hook of hookExecutions) {
          // Parse if_changed patterns (stored as JSON string or null)
          let patterns: string[] = [];
          if (hook.ifChanged) {
            try {
              // ifChanged might already be an array or a JSON string
              if (Array.isArray(hook.ifChanged)) {
                patterns = hook.ifChanged;
              } else if (typeof hook.ifChanged === 'string') {
                patterns = JSON.parse(hook.ifChanged);
              }
            } catch {
              // If parsing fails, skip this hook
              continue;
            }
          }

          // Skip hooks with no patterns (they don't apply to specific files)
          if (patterns.length === 0) continue;

          // Check if this file matches the hook's patterns
          const matches = fileMatchesPatterns(
            fc.filePath,
            patterns,
            hook.directory
          );

          if (!matches) continue;

          // This hook applies to this file - check if it's validated
          const pluginName = hook.hookSource ?? hook.hookName;
          const hookKey: HookKey = `${pluginName}:${hook.hookName}`;

          // Skip if we've already processed this hook
          if (seenHooks.has(hookKey)) continue;
          seenHooks.add(hookKey);

          // Skip if this file is already validated by this hook
          if (validatedHooks.has(hookKey)) continue;

          // This hook should validate this file but hasn't
          missing.push({
            id: undefined,
            sessionId: fc.sessionId,
            filePath: fc.filePath,
            fileHash: '',
            pluginName,
            hookName: hook.hookName,
            directory: hook.directory ?? '.',
            commandHash: '',
            validatedAt: undefined,
          });
        }

        return missing;
      },
    }),
  }),
});
