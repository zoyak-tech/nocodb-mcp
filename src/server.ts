import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NocoDBClient, type NocoDBError } from './client.js';
import type { NocoDBConfig } from './config.js';
import { Logger } from './logger.js';

export function createServer(config: NocoDBConfig): McpServer {
  const client = new NocoDBClient(config);
  const log = new Logger(config.logLevel);

  const server = new McpServer({
    name: 'nocodb-mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'ping_nocodb',
    {
      title: 'Ping NocoDB',
      description:
        'Check connectivity and authentication against the configured NocoDB instance. ' +
        'Returns the NocoDB version and the list of accessible workspaces.',
      inputSchema: {},
    },
    async () => {
      try {
        const version = await client.request<{ currentVersion: string; releaseVersion: string }>(
          '/api/v1/version',
        );
        const workspaces = await client.request<{ list?: unknown[] }>('/meta/workspaces');
        const wsCount = Array.isArray(workspaces?.list) ? workspaces.list.length : 0;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  baseUrl: config.baseUrl,
                  version: version.currentVersion,
                  latestVersion: version.releaseVersion,
                  upToDate: version.currentVersion === version.releaseVersion,
                  accessibleWorkspaces: wsCount,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const e = err as NocoDBError;
        log.error('ping_nocodb failed', { status: e.status, message: e.message });
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: false,
                  baseUrl: config.baseUrl,
                  status: e.status,
                  error: e.message,
                  details: e.body,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  // Placeholder for upcoming groups (Phase 1+):
  // registerBaseTools(server, client, log);
  // registerTableTools(server, client, log);
  // registerFieldTools(server, client, log);
  // registerRecordTools(server, client, log);

  void z; // keep import; will be used by Phase 1 schemas

  return server;
}
