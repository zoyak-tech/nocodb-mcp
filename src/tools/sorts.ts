import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, fieldIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const viewIdSchema = z.string().min(1).describe('NocoDB view ID');
const sortIdSchema = z.string().min(1).describe('NocoDB sort ID');

export function registerSortTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_sorts',
    {
      title: 'List sorts',
      description: 'List all sort rules applied to a view.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
      },
    },
    async ({ base_id, view_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/views/${view_id}/sorts`), 'list_sorts'),
  );

  server.registerTool(
    'create_sort',
    {
      title: 'Create sort',
      description: 'Add a sort rule to a view.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
        field_id: fieldIdSchema,
        direction: z.enum(['asc', 'desc']).describe('Sort direction'),
      },
    },
    async ({ base_id, view_id, field_id, direction }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/views/${view_id}/sorts`, {
            method: 'POST',
            body: { fk_column_id: field_id, direction },
          }),
        'create_sort',
      ),
  );

  server.registerTool(
    'update_sort',
    {
      title: 'Update sort',
      description: 'Change the direction of a sort rule.',
      inputSchema: {
        base_id: baseIdSchema,
        sort_id: sortIdSchema,
        direction: z.enum(['asc', 'desc']),
      },
    },
    async ({ base_id, sort_id, direction }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/sorts/${sort_id}`, {
            method: 'PATCH',
            body: { direction },
          }),
        'update_sort',
      ),
  );

  server.registerTool(
    'delete_sort',
    {
      title: 'Delete sort',
      description: 'Remove a sort rule from a view. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        sort_id: sortIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, sort_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_sort', { base_id, sort_id });
      }
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/sorts/${sort_id}`, {
            method: 'DELETE',
          }),
        'delete_sort',
      );
    },
  );
}
