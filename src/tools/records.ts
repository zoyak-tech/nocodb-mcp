import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, tableIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const recordSchema = z
  .record(z.string(), z.unknown())
  .describe('Object: { field_title: value, ... }');

export function registerRecordTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_records',
    {
      title: 'List records',
      description:
        'List records from a table with optional filtering, sorting, pagination, and field selection. ' +
        'NocoDB v3 `where` syntax: (FieldName,operator,value) joined by ~and / ~or. ' +
        'Operators: eq, neq, like, nlike, gt, lt, ge, le, null, notnull, empty, notempty, in, notin. ' +
        'Wrap values containing commas/parens in quotes: (Name,eq,"Smith, John").',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        where: z.string().optional().describe('NocoDB v3 where clause'),
        sort: z
          .string()
          .optional()
          .describe('Comma-separated field names. Prefix with - for descending: "Name,-CreatedAt"'),
        fields: z.string().optional().describe('Comma-separated list of fields to return'),
        limit: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .describe('Page size (default 25, max 1000)'),
        offset: z.number().int().nonnegative().optional().describe('Skip N records'),
        view_id: z.string().optional().describe('Filter by a specific view ID'),
      },
    },
    async ({ base_id, table_id, where, sort, fields, limit, offset, view_id }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records`, {
            query: { where, sort, fields, limit, offset, viewId: view_id },
          }),
        'list_records',
      ),
  );

  server.registerTool(
    'get_record',
    {
      title: 'Get record',
      description: 'Get a single record by its ID.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_id: z.string().describe('Record ID (primary key value, usually numeric or UUID)'),
        fields: z.string().optional().describe('Comma-separated list of fields to return'),
      },
    },
    async ({ base_id, table_id, record_id, fields }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records/${record_id}`, {
            query: { fields },
          }),
        'get_record',
      ),
  );

  server.registerTool(
    'create_records',
    {
      title: 'Create records (bulk)',
      description:
        'Insert one or more records. Each record is an object { field_title: value, ... }. ' +
        'Returns the created records with their assigned IDs.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        records: z.array(recordSchema).min(1).describe('Array of records to insert (max ~1000)'),
      },
    },
    async ({ base_id, table_id, records }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'POST',
            body: records,
          }),
        'create_records',
      ),
  );

  server.registerTool(
    'update_records',
    {
      title: 'Update records (bulk)',
      description:
        'Update one or more records. Each record MUST include its primary key (Id). ' +
        'Only the included fields are updated.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        records: z
          .array(recordSchema)
          .min(1)
          .describe('Array of records, each with primary key + fields to update'),
      },
    },
    async ({ base_id, table_id, records }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'PATCH',
            body: records,
          }),
        'update_records',
      ),
  );

  server.registerTool(
    'delete_records',
    {
      title: 'Delete records (bulk)',
      description:
        'Delete one or more records by their primary keys. Irreversible. ' +
        'Use `dry_run: true` first to preview which records would be deleted.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_ids: z
          .array(z.union([z.string(), z.number()]))
          .min(1)
          .describe('Array of primary key values'),
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, table_id, record_ids, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_records', {
          base_id,
          table_id,
          count: record_ids.length,
          record_ids,
        });
      }
      return tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'DELETE',
            body: record_ids.map((id) => ({ Id: id })),
          }),
        'delete_records',
      );
    },
  );

  server.registerTool(
    'upsert_records',
    {
      title: 'Upsert records',
      description:
        'Insert records, or update them if a record with the same primary key already exists. ' +
        'Useful for idempotent imports.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        records: z.array(recordSchema).min(1),
      },
    },
    async ({ base_id, table_id, records }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records/upsert`, {
            method: 'POST',
            body: records,
          }),
        'upsert_records',
      ),
  );

  server.registerTool(
    'count_records',
    {
      title: 'Count records',
      description:
        'Count records in a table, optionally filtered by a `where` clause. ' +
        'Cheaper than list_records when you only need the count.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        where: z.string().optional().describe('Optional NocoDB v3 where clause'),
        view_id: z.string().optional(),
      },
    },
    async ({ base_id, table_id, where, view_id }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/count`, {
            query: { where, viewId: view_id },
          }),
        'count_records',
      ),
  );

  server.registerTool(
    'global_search',
    {
      title: 'Global search across base',
      description:
        'Search a substring across all string-like fields of all tables in a base. ' +
        'WARNING: this lists tables and runs a separate query per table — can be slow on large bases. ' +
        'Use `table_ids` to limit scope.',
      inputSchema: {
        base_id: baseIdSchema,
        query: z.string().min(1).describe('Substring to search for (case-insensitive)'),
        table_ids: z
          .array(z.string())
          .optional()
          .describe('Optional: only search these tables. Defaults to all tables in the base.'),
        limit_per_table: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe('Max matching records per table (default 10)'),
      },
    },
    async ({ base_id, query, table_ids, limit_per_table }) =>
      tryTool(async () => {
        const limit = limit_per_table ?? 10;
        let tables: Array<{
          id: string;
          title: string;
          fields?: Array<{ title: string; uidt: string }>;
        }>;

        if (table_ids?.length) {
          tables = await Promise.all(
            table_ids.map((tid) =>
              client.request<{
                id: string;
                title: string;
                fields?: Array<{ title: string; uidt: string }>;
              }>(`/meta/bases/${base_id}/tables/${tid}`),
            ),
          );
        } else {
          const tableList = await client.request<{
            list?: Array<{ id: string; title: string }>;
          }>(`/meta/bases/${base_id}/tables`);
          tables = await Promise.all(
            (tableList.list ?? []).map((t) =>
              client.request<{
                id: string;
                title: string;
                fields?: Array<{ title: string; uidt: string }>;
              }>(`/meta/bases/${base_id}/tables/${t.id}`),
            ),
          );
        }

        const stringTypes = new Set([
          'SingleLineText',
          'LongText',
          'RichText',
          'Email',
          'URL',
          'PhoneNumber',
          'SingleSelect',
          'MultiSelect',
        ]);

        const results: Array<{ table_id: string; table_title: string; matches: unknown[] }> = [];

        for (const table of tables) {
          const searchableFields = (table.fields ?? []).filter((f) => stringTypes.has(f.uidt));
          if (searchableFields.length === 0) continue;

          const whereClause = searchableFields
            .map((f) => `(${f.title},like,%${query}%)`)
            .join('~or');

          const data = await client.request<{ list?: unknown[] }>(
            `/data/${base_id}/${table.id}/records`,
            { query: { where: whereClause, limit } },
          );

          if (data.list && data.list.length > 0) {
            results.push({
              table_id: table.id,
              table_title: table.title,
              matches: data.list,
            });
          }
        }

        return {
          query,
          tables_searched: tables.length,
          tables_with_matches: results.length,
          results,
        };
      }, 'global_search'),
  );
}
