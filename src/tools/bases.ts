import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, workspaceIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

export function registerBaseTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_bases',
    {
      title: 'List bases',
      description: 'List all bases (projects) inside a given workspace.',
      inputSchema: { workspace_id: workspaceIdSchema },
    },
    async ({ workspace_id }) =>
      tryTool(() => client.request(`/meta/workspaces/${workspace_id}/bases`), 'list_bases'),
  );

  server.registerTool(
    'get_base',
    {
      title: 'Get base details',
      description: 'Get a specific base by ID, including its title, sources, and meta info.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) => tryTool(() => client.request(`/meta/bases/${base_id}`), 'get_base'),
  );

  server.registerTool(
    'create_base',
    {
      title: 'Create base',
      description:
        'Create a new base (project) inside a workspace. ' +
        'The base is created with a default empty source unless `sources` is provided.',
      inputSchema: {
        workspace_id: workspaceIdSchema,
        title: z.string().min(1).describe('Display title of the new base'),
        description: z.string().optional().describe('Optional description'),
        color: z
          .string()
          .optional()
          .describe('Optional hex color (e.g. "#36BFFF") for the base avatar'),
      },
    },
    async ({ workspace_id, title, description, color }) =>
      tryTool(
        () =>
          client.request(`/meta/workspaces/${workspace_id}/bases`, {
            method: 'POST',
            body: { title, description, meta: color ? { iconColor: color } : undefined },
          }),
        'create_base',
      ),
  );

  server.registerTool(
    'update_base',
    {
      title: 'Update base',
      description: 'Update a base — change its title, description, or color.',
      inputSchema: {
        base_id: baseIdSchema,
        title: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      },
    },
    async ({ base_id, title, description, color }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}`, {
            method: 'PATCH',
            body: {
              title,
              description,
              meta: color ? { iconColor: color } : undefined,
            },
          }),
        'update_base',
      ),
  );

  server.registerTool(
    'delete_base',
    {
      title: 'Delete base',
      description:
        'Permanently delete a base and ALL its tables, fields, records, views, ' +
        'and webhooks. This is irreversible. Use `dry_run: true` first to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_base', { base_id });
      }
      return tryTool(
        () => client.request(`/meta/bases/${base_id}`, { method: 'DELETE' }),
        'delete_base',
      );
    },
  );
}
