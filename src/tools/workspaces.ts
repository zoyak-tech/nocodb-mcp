import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NocoDBClient } from '../client.js';
import { tryTool } from './helpers.js';
import { listWorkspacesResilient } from './workspace-helpers.js';

export function registerWorkspaceTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_workspaces',
    {
      title: 'List workspaces',
      description:
        'List all workspaces accessible by the configured API token. ' +
        'Returns workspace IDs (needed when creating new bases). ' +
        'On older NocoDB builds without the v3 workspace API, falls back to the ' +
        'legacy project list.',
      inputSchema: {},
    },
    async () => tryTool(() => listWorkspacesResilient(client), 'list_workspaces'),
  );
}
