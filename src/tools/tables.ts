import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, tableIdSchema } from '../schemas/common.js';
import { FIELD_TYPES } from '../schemas/field-types.js';
import { dryRunPreview, tryTool } from './helpers.js';

const fieldDefSchema = z.object({
  title: z.string().min(1).describe('Field display name'),
  uidt: z.enum(FIELD_TYPES).describe('NocoDB field type (UIDT)'),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Field-type-specific options (e.g. { choices: [...] } for SingleSelect)'),
});

export function registerTableTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_tables',
    {
      title: 'List tables',
      description: 'List all tables in a base.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/tables`), 'list_tables'),
  );

  server.registerTool(
    'get_table',
    {
      title: 'Get table details',
      description:
        'Get a table by ID, including its fields, views, and meta. ' +
        'Use this to discover field IDs before creating/updating records.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
      },
    },
    async ({ base_id, table_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/tables/${table_id}`), 'get_table'),
  );

  server.registerTool(
    'create_table',
    {
      title: 'Create table',
      description:
        'Create a new table in a base. Optionally pass an array of fields to create them ' +
        'atomically with the table. If `fields` is omitted, NocoDB creates a default ID column.',
      inputSchema: {
        base_id: baseIdSchema,
        title: z.string().min(1).describe('Table display name'),
        description: z.string().optional(),
        fields: z
          .array(fieldDefSchema)
          .optional()
          .describe('Optional initial fields. Each: { title, uidt, options? }'),
      },
    },
    async ({ base_id, title, description, fields }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables`, {
            method: 'POST',
            body: { title, description, fields },
          }),
        'create_table',
      ),
  );

  server.registerTool(
    'update_table',
    {
      title: 'Update table',
      description: 'Rename a table or change its description.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        title: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async ({ base_id, table_id, title, description }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}`, {
            method: 'PATCH',
            body: { title, description },
          }),
        'update_table',
      ),
  );

  server.registerTool(
    'delete_table',
    {
      title: 'Delete table',
      description:
        'Delete a table along with all its fields, records, views, filters, and webhooks. ' +
        'Irreversible. Use `dry_run: true` first to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, table_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_table', { base_id, table_id });
      }
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}`, {
            method: 'DELETE',
          }),
        'delete_table',
      );
    },
  );

  server.registerTool(
    'clone_table',
    {
      title: 'Clone table structure',
      description:
        'Create a new table with the same field structure as an existing one. ' +
        'Does NOT copy records (use bulk records tools for that). Useful for templates.',
      inputSchema: {
        base_id: baseIdSchema,
        source_table_id: tableIdSchema,
        new_title: z.string().min(1).describe('Title of the new table'),
        target_base_id: baseIdSchema
          .optional()
          .describe('Optional: clone into a different base. Defaults to source base.'),
      },
    },
    async ({ base_id, source_table_id, new_title, target_base_id }) =>
      tryTool(async () => {
        const source = await client.request<{
          fields?: Array<{ title: string; uidt: string; meta?: unknown }>;
        }>(`/meta/bases/${base_id}/tables/${source_table_id}`);

        const cleanedFields =
          source.fields
            ?.filter(
              (f) =>
                !['ID', 'CreatedTime', 'LastModifiedTime', 'CreatedBy', 'LastModifiedBy'].includes(
                  f.uidt,
                ),
            )
            .map((f) => ({ title: f.title, uidt: f.uidt, meta: f.meta })) ?? [];

        const destBase = target_base_id ?? base_id;
        return client.request(`/meta/bases/${destBase}/tables`, {
          method: 'POST',
          body: { title: new_title, fields: cleanedFields },
        });
      }, 'clone_table'),
  );
}
