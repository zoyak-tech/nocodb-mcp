import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NocoDBClient } from '../client.js';
import type { NocoDBConfig } from '../config.js';
import { tryTool } from './helpers.js';

export function registerPingTool(
  server: McpServer,
  client: NocoDBClient,
  config: NocoDBConfig,
): void {
  server.registerTool(
    'ping_nocodb',
    {
      title: 'Ping NocoDB',
      description:
        'Check connectivity and authentication against the configured NocoDB instance. ' +
        'Returns the NocoDB version and the count of accessible workspaces.',
      inputSchema: {},
    },
    async () =>
      tryTool(async () => {
        const version = await client.request<{
          currentVersion: string;
          releaseVersion: string;
        }>('/api/v1/version');
        const workspaces = await client.request<{ list?: unknown[] }>('/meta/workspaces');
        const wsCount = Array.isArray(workspaces?.list) ? workspaces.list.length : 0;

        return {
          ok: true,
          baseUrl: config.baseUrl,
          version: version.currentVersion,
          latestVersion: version.releaseVersion,
          upToDate: version.currentVersion === version.releaseVersion,
          accessibleWorkspaces: wsCount,
        };
      }, 'ping_nocodb'),
  );
}
