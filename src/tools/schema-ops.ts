import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, tableIdSchema, workspaceIdSchema } from '../schemas/common.js';
import { FIELD_TYPES } from '../schemas/field-types.js';
import { fail, ok, tryTool } from './helpers.js';

const fieldDefSchema = z.object({
  title: z.string().min(1),
  uidt: z.enum(FIELD_TYPES),
  options: z.record(z.string(), z.unknown()).optional(),
  description: z.string().optional(),
});

export function registerSchemaOpsTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'bulk_create_fields',
    {
      title: 'Bulk create fields',
      description:
        'Create many fields in a single table in one go. Each field is an independent ' +
        'POST; results report per-field success/error so partial failure is observable.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        fields: z.array(fieldDefSchema).min(1),
      },
    },
    async ({ base_id, table_id, fields }) =>
      tryTool(async () => {
        const results: Array<{
          title: string;
          ok: boolean;
          field_id?: string;
          error?: string;
        }> = [];
        for (const f of fields) {
          try {
            const resp = await client.request<{ id?: string }>(
              `/meta/bases/${base_id}/tables/${table_id}/fields`,
              {
                method: 'POST',
                body: {
                  title: f.title,
                  uidt: f.uidt,
                  description: f.description,
                  ...(f.options ?? {}),
                },
              },
            );
            results.push({ title: f.title, ok: true, field_id: resp.id });
          } catch (err) {
            results.push({ title: f.title, ok: false, error: (err as Error).message });
          }
        }
        return {
          summary: `${results.filter((r) => r.ok).length}/${results.length} fields created`,
          results,
        };
      }, 'bulk_create_fields'),
  );

  server.registerTool(
    'clone_base',
    {
      title: 'Clone base structure',
      description:
        'Create a new base in the same workspace and copy the structure of every table ' +
        '(fields, but NOT records or views) from the source base. Useful for templating.',
      inputSchema: {
        source_base_id: baseIdSchema,
        workspace_id: workspaceIdSchema,
        new_title: z.string().min(1),
      },
    },
    async ({ source_base_id, workspace_id, new_title }) =>
      tryTool(async () => {
        // 1. Create destination base
        const destBase = await client.request<{ id: string; title: string }>(
          `/meta/workspaces/${workspace_id}/bases`,
          { method: 'POST', body: { title: new_title } },
        );

        // 2. Enumerate source tables
        const sourceTables = await client.request<{
          list?: Array<{ id: string; title: string }>;
        }>(`/meta/bases/${source_base_id}/tables`);

        const cloned: Array<{
          source_table_id: string;
          new_table_id?: string;
          ok: boolean;
          error?: string;
        }> = [];
        for (const t of sourceTables.list ?? []) {
          try {
            const detail = await client.request<{
              fields?: Array<{ title: string; uidt: string; meta?: unknown }>;
            }>(`/meta/bases/${source_base_id}/tables/${t.id}`);
            const cleanedFields =
              detail.fields
                ?.filter(
                  (f) =>
                    ![
                      'ID',
                      'CreatedTime',
                      'LastModifiedTime',
                      'CreatedBy',
                      'LastModifiedBy',
                    ].includes(f.uidt),
                )
                .map((f) => ({ title: f.title, uidt: f.uidt, meta: f.meta })) ?? [];
            const newTable = await client.request<{ id: string }>(
              `/meta/bases/${destBase.id}/tables`,
              { method: 'POST', body: { title: t.title, fields: cleanedFields } },
            );
            cloned.push({ source_table_id: t.id, new_table_id: newTable.id, ok: true });
          } catch (err) {
            cloned.push({ source_table_id: t.id, ok: false, error: (err as Error).message });
          }
        }

        return {
          new_base_id: destBase.id,
          new_base_title: destBase.title,
          tables_cloned: cloned.filter((c) => c.ok).length,
          tables_failed: cloned.filter((c) => !c.ok).length,
          details: cloned,
        };
      }, 'clone_base'),
  );

  server.registerTool(
    'import_base_schema',
    {
      title: 'Import base schema from JSON',
      description:
        'Recreate base structure from an `export_base_schema` document (or compatible JSON). ' +
        'Creates tables and fields. Does NOT recreate views, filters, sorts, webhooks, or ' +
        'records — those should be added separately. Useful for cross-instance templating.',
      inputSchema: {
        workspace_id: workspaceIdSchema,
        new_base_title: z.string().min(1),
        schema_json_path: z
          .string()
          .optional()
          .describe('Path to a JSON file from export_base_schema'),
        schema_inline: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Or pass the schema object directly'),
      },
    },
    async ({ workspace_id, new_base_title, schema_json_path, schema_inline }) => {
      try {
        let schema: { tables?: Array<{ title?: string; fields?: unknown[] }> };
        if (schema_inline) {
          schema = schema_inline as typeof schema;
        } else if (schema_json_path) {
          schema = JSON.parse(await readFile(schema_json_path, 'utf-8'));
        } else {
          return fail(
            new Error('Provide either schema_inline or schema_json_path'),
            'import_base_schema',
          );
        }

        const newBase = await client.request<{ id: string; title: string }>(
          `/meta/workspaces/${workspace_id}/bases`,
          { method: 'POST', body: { title: new_base_title } },
        );

        const tableResults: Array<{
          title: string;
          ok: boolean;
          new_table_id?: string;
          error?: string;
        }> = [];
        for (const table of schema.tables ?? []) {
          try {
            const fields = (table.fields ?? [])
              .filter((f) => {
                const uidt = (f as { uidt?: string }).uidt;
                return (
                  uidt &&
                  ![
                    'ID',
                    'CreatedTime',
                    'LastModifiedTime',
                    'CreatedBy',
                    'LastModifiedBy',
                  ].includes(uidt)
                );
              })
              .map((f) => {
                const ff = f as { title?: string; uidt?: string; meta?: unknown };
                return { title: ff.title, uidt: ff.uidt, meta: ff.meta };
              });
            const created = await client.request<{ id: string }>(
              `/meta/bases/${newBase.id}/tables`,
              { method: 'POST', body: { title: table.title, fields } },
            );
            tableResults.push({ title: table.title ?? '', ok: true, new_table_id: created.id });
          } catch (err) {
            tableResults.push({
              title: table.title ?? '',
              ok: false,
              error: (err as Error).message,
            });
          }
        }

        return ok({
          new_base_id: newBase.id,
          new_base_title: newBase.title,
          tables_imported: tableResults.filter((r) => r.ok).length,
          tables_failed: tableResults.filter((r) => !r.ok).length,
          details: tableResults,
          note: 'Views, filters, sorts, webhooks, and records are NOT imported.',
        });
      } catch (err) {
        return fail(err, 'import_base_schema');
      }
    },
  );
}
