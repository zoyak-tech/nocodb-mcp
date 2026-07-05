import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NocoDBClient } from '../client.js';
import type { NocoDBConfig } from '../config.js';
import { tryTool } from './helpers.js';
import { probeNocoDB } from './workspace-helpers.js';

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
        'Returns the NocoDB version and the count of accessible workspaces ' +
        '(null on older NocoDB builds without the workspace API).',
      inputSchema: {},
    },
    async () => tryTool(() => probeNocoDB(client, config), 'ping_nocodb'),
  );
}
