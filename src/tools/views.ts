import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, tableIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const VIEW_TYPES = ['grid', 'gallery', 'kanban', 'form', 'calendar', 'map'] as const;

const viewIdSchema = z.string().min(1).describe('NocoDB view ID, e.g. "vw1234567890abcd"');

export function registerViewTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_views',
    {
      title: 'List views',
      description: 'List all views of a table.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
      },
    },
    async ({ base_id, table_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/tables/${table_id}/views`),
        'list_views',
      ),
  );

  server.registerTool(
    'get_view',
    {
      title: 'Get view details',
      description: 'Get a view by ID, including its filters, sorts, and visible columns.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
      },
    },
    async ({ base_id, view_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/views/${view_id}`), 'get_view'),
  );

  server.registerTool(
    'create_view',
    {
      title: 'Create view',
      description:
        'Create a new view of a given type (grid, gallery, kanban, form, calendar, map). ' +
        'Type-specific config goes in `options`. Examples: ' +
        'kanban needs { stack_field_id }; calendar needs { date_field_id }; ' +
        'map needs { geo_field_id }; gallery uses cover field via { cover_field_id }.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        title: z.string().min(1).describe('View display name'),
        type: z.enum(VIEW_TYPES).describe('View type'),
        options: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Type-specific configuration'),
      },
    },
    async ({ base_id, table_id, title, type, options }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}/views`, {
            method: 'POST',
            body: { title, type, ...(options ?? {}) },
          }),
        'create_view',
      ),
  );

  server.registerTool(
    'update_view',
    {
      title: 'Update view',
      description: 'Rename a view or update its display options.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
        title: z.string().optional(),
        options: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ base_id, view_id, title, options }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/views/${view_id}`, {
            method: 'PATCH',
            body: { title, ...(options ?? {}) },
          }),
        'update_view',
      ),
  );

  server.registerTool(
    'delete_view',
    {
      title: 'Delete view',
      description:
        'Delete a view. Records are not affected (views are just saved configurations). ' +
        'Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, view_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_view', { base_id, view_id });
      }
      return tryTool(
        () => client.request(`/meta/bases/${base_id}/views/${view_id}`, { method: 'DELETE' }),
        'delete_view',
      );
    },
  );
}
