/**
 * GraphQL McpServer type
 *
 * An MCP server configuration.
 */

import { getMcpServers } from '../../api/settings.ts';
import { builder } from '../builder.ts';

/**
 * MCP server data
 */
export interface McpServerData {
  name: string;
  command?: string;
  url?: string;
  type: string;
  argCount: number;
  hasEnv: boolean;
}

/**
 * MCP server type ref
 */
const McpServerRef = builder.objectRef<McpServerData>('McpServer');

/**
 * MCP server type implementation
 */
export const McpServerType = McpServerRef.implement({
  description: 'An MCP server configuration',
  fields: (t) => ({
    id: t.id({
      description: 'Server ID',
      resolve: (s) => Buffer.from(`McpServer:${s.name}`).toString('base64'),
    }),
    name: t.exposeString('name', {
      description: 'Server name',
    }),
    command: t.string({
      nullable: true,
      description: 'Command to run the server',
      resolve: (s) => s.command ?? null,
    }),
    url: t.string({
      nullable: true,
      description: 'URL for HTTP servers',
      resolve: (s) => s.url ?? null,
    }),
    type: t.exposeString('type', {
      description: 'Server type (stdio or http)',
    }),
    argCount: t.exposeInt('argCount', {
      description: 'Number of command arguments',
    }),
    hasEnv: t.exposeBoolean('hasEnv', {
      description: 'Whether environment variables are configured',
    }),
  }),
});

/**
 * Query MCP servers
 */
export function queryMcpServers(): McpServerData[] {
  return getMcpServers();
}
