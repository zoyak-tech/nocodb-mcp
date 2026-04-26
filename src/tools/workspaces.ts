import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NocoDBClient } from '../client.js';
import { tryTool } from './helpers.js';

export function registerWorkspaceTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_workspaces',
    {
      title: 'List workspaces',
      description:
        'List all workspaces accessible by the configured API token. ' +
        'Returns workspace IDs (needed when creating new bases).',
      inputSchema: {},
    },
    async () =>
      tryTool(() => client.request<{ list: unknown[] }>('/meta/workspaces'), 'list_workspaces'),
  );
}
