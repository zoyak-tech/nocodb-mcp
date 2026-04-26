import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NocoDBClient } from './client.js';
import type { NocoDBConfig } from './config.js';
import { Logger } from './logger.js';
import { registerBaseTools } from './tools/bases.js';
import { registerFieldTools } from './tools/fields.js';
import { registerPingTool } from './tools/ping.js';
import { registerRecordTools } from './tools/records.js';
import { registerTableTools } from './tools/tables.js';
import { registerWorkspaceTools } from './tools/workspaces.js';

export function createServer(config: NocoDBConfig): McpServer {
  const client = new NocoDBClient(config);
  const log = new Logger(config.logLevel);

  const server = new McpServer({
    name: 'nocodb-mcp',
    version: '0.1.0',
  });

  registerPingTool(server, client, config);
  registerWorkspaceTools(server, client);
  registerBaseTools(server, client);
  registerTableTools(server, client);
  registerFieldTools(server, client);
  registerRecordTools(server, client);

  log.info('nocodb-mcp tools registered', {
    target: config.baseUrl,
    groups: ['ping', 'workspaces', 'bases', 'tables', 'fields', 'records'],
  });

  return server;
}
