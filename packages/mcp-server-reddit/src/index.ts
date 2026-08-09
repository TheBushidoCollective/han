#!/usr/bin/env node
/**
 * Entry point for the Han Reddit MCP server.
 *
 * The server always starts. When Reddit credentials are missing it serves the
 * public tools and answers the user scoped ones with setup instructions, which
 * keeps a misconfigured environment diagnosable instead of silently absent.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { readCredentials, resolveMode } from './auth.js';
import { RedditClient } from './client.js';
import { registerTools } from './tools.js';

const VERSION = '2.0.0';

/** Starts the stdio MCP server and blocks until the transport closes. */
export async function main(): Promise<void> {
  const credentials = readCredentials();
  const mode = resolveMode(credentials);
  const client = new RedditClient(credentials, mode);

  const server = new McpServer({
    name: 'reddit',
    version: VERSION,
  });

  registerTools(server, client);

  // stdout is the MCP transport, so every diagnostic goes to stderr.
  process.stderr.write(
    `mcp-server-reddit ${VERSION} started in ${mode} mode\n`
  );
  if (mode !== 'user') {
    process.stderr.write(
      'Saved items, profile, and history tools need user auth. ' +
        'Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and either ' +
        'REDDIT_REFRESH_TOKEN or REDDIT_USERNAME plus REDDIT_PASSWORD.\n'
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`mcp-server-reddit failed to start: ${error}\n`);
  process.exit(1);
});
