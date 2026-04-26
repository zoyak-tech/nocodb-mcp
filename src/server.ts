import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NocoDBClient } from './client.js';
import type { NocoDBConfig } from './config.js';
import { Logger } from './logger.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerBaseTools } from './tools/bases.js';
import { registerFieldTools } from './tools/fields.js';
import { registerFilterTools } from './tools/filters.js';
import { registerImportExportTools } from './tools/import-export.js';
import { registerLinkTools } from './tools/links.js';
import { registerPingTool } from './tools/ping.js';
import { registerRecordTools } from './tools/records.js';
import { registerSortTools } from './tools/sorts.js';
import { registerTableTools } from './tools/tables.js';
import { registerViewTools } from './tools/views.js';
import { registerWebhookTools } from './tools/webhooks.js';
import { registerWorkspaceTools } from './tools/workspaces.js';

export function createServer(config: NocoDBConfig): McpServer {
  const client = new NocoDBClient(config);
  const log = new Logger(config.logLevel);

  const server = new McpServer({
    name: 'nocodb-mcp',
    version: '0.2.0',
  });

  registerPingTool(server, client, config);
  registerWorkspaceTools(server, client);
  registerBaseTools(server, client);
  registerTableTools(server, client);
  registerFieldTools(server, client);
  registerRecordTools(server, client);
  registerViewTools(server, client);
  registerFilterTools(server, client);
  registerSortTools(server, client);
  registerWebhookTools(server, client);
  registerLinkTools(server, client);
  registerAttachmentTools(server, client, config);
  registerImportExportTools(server, client);

  log.info('nocodb-mcp tools registered', {
    target: config.baseUrl,
    groups: [
      'ping',
      'workspaces',
      'bases',
      'tables',
      'fields',
      'records',
      'views',
      'filters',
      'sorts',
      'webhooks',
      'links',
      'attachments',
      'import-export',
    ],
  });

  return server;
}
