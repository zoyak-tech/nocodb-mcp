import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, fieldIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const viewIdSchema = z.string().min(1).describe('NocoDB view ID');
const filterIdSchema = z.string().min(1).describe('NocoDB filter ID');

const FILTER_OPERATORS = [
  'eq',
  'neq',
  'like',
  'nlike',
  'gt',
  'lt',
  'ge',
  'le',
  'in',
  'notin',
  'null',
  'notnull',
  'empty',
  'notempty',
  'between',
  'notbetween',
  'allof',
  'anyof',
  'nallof',
  'nanyof',
  'isWithin',
] as const;

const filterDefSchema = z.object({
  field_id: fieldIdSchema,
  operator: z.enum(FILTER_OPERATORS).describe('Comparison operator'),
  value: z
    .unknown()
    .optional()
    .describe('Value to compare against (omit for null/notnull/empty/notempty)'),
  logical_op: z
    .enum(['and', 'or'])
    .optional()
    .describe('How to combine with previous filter (default: and)'),
});

export function registerFilterTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_filters',
    {
      title: 'List filters',
      description: 'List all filters applied to a view.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
      },
    },
    async ({ base_id, view_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/views/${view_id}/filters`),
        'list_filters',
      ),
  );

  server.registerTool(
    'create_filter',
    {
      title: 'Create filter',
      description: 'Add a new filter to a view.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
        field_id: fieldIdSchema,
        operator: z.enum(FILTER_OPERATORS),
        value: z.unknown().optional(),
        logical_op: z.enum(['and', 'or']).optional(),
      },
    },
    async ({ base_id, view_id, field_id, operator, value, logical_op }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/views/${view_id}/filters`, {
            method: 'POST',
            body: {
              fk_column_id: field_id,
              comparison_op: operator,
              value,
              logical_op,
            },
          }),
        'create_filter',
      ),
  );

  server.registerTool(
    'set_filters',
    {
      title: 'Set filters (replace all)',
      description:
        'Replace all filters on a view with the provided list. Atomic operation — ' +
        'use this when you want to fully redefine the filter set.',
      inputSchema: {
        base_id: baseIdSchema,
        view_id: viewIdSchema,
        filters: z.array(filterDefSchema),
      },
    },
    async ({ base_id, view_id, filters }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/views/${view_id}/filters`, {
            method: 'PUT',
            body: filters.map((f) => ({
              fk_column_id: f.field_id,
              comparison_op: f.operator,
              value: f.value,
              logical_op: f.logical_op,
            })),
          }),
        'set_filters',
      ),
  );

  server.registerTool(
    'update_filter',
    {
      title: 'Update filter',
      description: 'Update an individual filter (operator, value, logical op).',
      inputSchema: {
        base_id: baseIdSchema,
        filter_id: filterIdSchema,
        operator: z.enum(FILTER_OPERATORS).optional(),
        value: z.unknown().optional(),
        logical_op: z.enum(['and', 'or']).optional(),
      },
    },
    async ({ base_id, filter_id, operator, value, logical_op }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/filters/${filter_id}`, {
            method: 'PATCH',
            body: { comparison_op: operator, value, logical_op },
          }),
        'update_filter',
      ),
  );

  server.registerTool(
    'delete_filter',
    {
      title: 'Delete filter',
      description: 'Remove a filter from a view. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        filter_id: filterIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, filter_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_filter', { base_id, filter_id });
      }
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/filters/${filter_id}`, {
            method: 'DELETE',
          }),
        'delete_filter',
      );
    },
  );
}
