import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, fieldIdSchema, tableIdSchema } from '../schemas/common.js';
import { FIELD_TYPES } from '../schemas/field-types.js';
import { dryRunPreview, tryTool } from './helpers.js';

export function registerFieldTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_fields',
    {
      title: 'List fields',
      description:
        'List all fields (columns) of a table. Returns each field with its ID, title, ' +
        'type (uidt), and options. Field IDs are needed for record CRUD operations.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
      },
    },
    async ({ base_id, table_id }) =>
      tryTool(async () => {
        const table = await client.request<{
          fields?: Array<Record<string, unknown>>;
        }>(`/meta/bases/${base_id}/tables/${table_id}`);
        return { table_id, fields: table.fields ?? [] };
      }, 'list_fields'),
  );

  server.registerTool(
    'get_field',
    {
      title: 'Get field details',
      description: 'Get a single field by ID, including all its options and metadata.',
      inputSchema: {
        base_id: baseIdSchema,
        field_id: fieldIdSchema,
      },
    },
    async ({ base_id, field_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/fields/${field_id}`), 'get_field'),
  );

  server.registerTool(
    'create_field',
    {
      title: 'Create field',
      description:
        'Create a new field (column) in a table. Supports all 34 NocoDB v3 field types. ' +
        'Common options patterns: ' +
        'SingleSelect/MultiSelect → `options.choices: [{ title, color? }, ...]`; ' +
        'Number/Decimal/Currency → `options.precision`; ' +
        'Formula → `options.formula: "{Field1} + {Field2}"`; ' +
        'LinkToAnotherRecord → `options.relatedTableId, options.type: "mm" | "hm" | "bt" | "oo"`; ' +
        'Rich text in LongText → `options.meta: { richMode: true }` ' +
        '(NocoDB v3 has no separate "RichText" type — it is LongText with this flag).',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        title: z.string().min(1).describe('Field display name'),
        uidt: z
          .enum(FIELD_TYPES)
          .describe(
            'NocoDB field type. Most common: SingleLineText, LongText, Number, Checkbox, SingleSelect, MultiSelect, Date, DateTime, Email, URL, Attachment, Formula, LinkToAnotherRecord.',
          ),
        description: z.string().optional(),
        options: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Field-type-specific options. Examples: ' +
              '{ "choices": [{"title":"Active"},{"title":"Done"}] } for SingleSelect; ' +
              '{ "formula": "{Field1} + {Field2}" } for Formula; ' +
              '{ "relatedTableId": "m...", "type": "mm" } for LinkToAnotherRecord.',
          ),
        required: z.boolean().optional().describe('Whether the field is required (NOT NULL)'),
        unique: z.boolean().optional().describe('Whether the field must be unique'),
        default_value: z
          .union([z.string(), z.number(), z.boolean(), z.null()])
          .optional()
          .describe('Default value for new records'),
      },
    },
    async ({
      base_id,
      table_id,
      title,
      uidt,
      description,
      options,
      required,
      unique,
      default_value,
    }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}/fields`, {
            method: 'POST',
            body: {
              title,
              // NocoDB v3 API expects `type` in the body (the legacy v2 name `uidt`
              // was renamed). Internally NocoDB still calls these UIDT values, so
              // our MCP input schema keeps `uidt` for clarity.
              type: uidt,
              description,
              ...(options ?? {}),
              rqd: required,
              un: unique,
              cdf: default_value,
            },
          }),
        'create_field',
      ),
  );

  server.registerTool(
    'update_field',
    {
      title: 'Update field',
      description:
        'Update a field — rename, change description, modify type-specific options, ' +
        'change required/unique flags. Note: NocoDB may forbid type changes for fields that ' +
        'already contain data; in that case create a new field and migrate.',
      inputSchema: {
        base_id: baseIdSchema,
        field_id: fieldIdSchema,
        title: z.string().optional().describe('New display name'),
        description: z.string().optional(),
        options: z.record(z.string(), z.unknown()).optional(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
      },
    },
    async ({ base_id, field_id, title, description, options, required, unique, default_value }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/fields/${field_id}`, {
            method: 'PATCH',
            body: {
              title,
              description,
              ...(options ?? {}),
              rqd: required,
              un: unique,
              cdf: default_value,
            },
          }),
        'update_field',
      ),
  );

  server.registerTool(
    'delete_field',
    {
      title: 'Delete field',
      description:
        'Delete a field and ALL its data. Irreversible. ' +
        'Use `dry_run: true` first to preview which field would be deleted.',
      inputSchema: {
        base_id: baseIdSchema,
        field_id: fieldIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, field_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_field', { base_id, field_id });
      }
      return tryTool(
        () => client.request(`/meta/bases/${base_id}/fields/${field_id}`, { method: 'DELETE' }),
        'delete_field',
      );
    },
  );

  server.registerTool(
    'reorder_field',
    {
      title: 'Reorder field',
      description:
        'Change the position of a field in its table by setting its `order` value. ' +
        'Lower numbers appear first. NocoDB will renormalize positions automatically.',
      inputSchema: {
        base_id: baseIdSchema,
        field_id: fieldIdSchema,
        order: z.number().describe('New order (lower = earlier in field list)'),
      },
    },
    async ({ base_id, field_id, order }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/fields/${field_id}`, {
            method: 'PATCH',
            body: { order },
          }),
        'reorder_field',
      ),
  );

  server.registerTool(
    'bulk_rename_fields',
    {
      title: 'Bulk rename fields',
      description:
        'Rename multiple fields in one call by providing a mapping { field_id: new_title }. ' +
        'Each rename is sent as an independent PATCH; all errors are collected and reported.',
      inputSchema: {
        base_id: baseIdSchema,
        renames: z
          .record(z.string(), z.string().min(1))
          .describe('Map of field_id -> new title, e.g. { "c123": "Customer Name" }'),
      },
    },
    async ({ base_id, renames }) =>
      tryTool(async () => {
        const results: Array<{
          field_id: string;
          new_title: string;
          ok: boolean;
          error?: string;
        }> = [];

        for (const [fieldId, newTitle] of Object.entries(renames)) {
          try {
            await client.request(`/meta/bases/${base_id}/fields/${fieldId}`, {
              method: 'PATCH',
              body: { title: newTitle },
            });
            results.push({ field_id: fieldId, new_title: newTitle, ok: true });
          } catch (err) {
            results.push({
              field_id: fieldId,
              new_title: newTitle,
              ok: false,
              error: (err as Error).message,
            });
          }
        }

        const succeeded = results.filter((r) => r.ok).length;
        return {
          summary: `${succeeded}/${results.length} fields renamed`,
          results,
        };
      }, 'bulk_rename_fields'),
  );
}
