import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, tableIdSchema } from '../schemas/common.js';
import { fail, ok, tryTool } from './helpers.js';

/**
 * Minimal RFC 4180 CSV parser. Handles quoted fields, escaped quotes ("").
 * Returns the header row and rows of strings.
 */
function parseCsv(input: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 0) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

/** Convert string CSV cells to inferred types (number / boolean / null / string). */
function coerceValue(s: string): unknown {
  if (s === '') return null;
  const trimmed = s.trim();
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d*\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return s;
}

function csvToRecords(csv: string): Array<Record<string, unknown>> {
  const { headers, rows } = parseCsv(csv);
  return rows.map((row) => {
    const rec: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      rec[h] = coerceValue(row[i] ?? '');
    });
    return rec;
  });
}

function inferUidt(values: unknown[]): string {
  const nonNull = values.filter((v) => v !== null && v !== '');
  if (nonNull.length === 0) return 'SingleLineText';
  const allBool = nonNull.every((v) => typeof v === 'boolean');
  if (allBool) return 'Checkbox';
  const allNum = nonNull.every((v) => typeof v === 'number');
  if (allNum) {
    const allInt = nonNull.every((v) => Number.isInteger(v as number));
    return allInt ? 'Number' : 'Decimal';
  }
  // Date heuristics
  const allDate = nonNull.every((v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)));
  if (allDate) {
    const looksDateOnly = nonNull.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v as string));
    return looksDateOnly ? 'Date' : 'DateTime';
  }
  // Long text heuristic: any value > 200 chars
  const isLong = nonNull.some((v) => typeof v === 'string' && (v as string).length > 200);
  return isLong ? 'LongText' : 'SingleLineText';
}

export function registerImportExportTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'import_csv_to_new_table',
    {
      title: 'Import CSV → new table',
      description:
        'Read a local CSV file and create a new table with inferred field types ' +
        '(Number, Decimal, Checkbox, Date, DateTime, LongText, SingleLineText), ' +
        'then bulk-insert all rows. Returns table ID and row count.',
      inputSchema: {
        base_id: baseIdSchema,
        file_path: z.string().describe('Absolute path to a local .csv file'),
        table_title: z.string().min(1).describe('Display name for the new table'),
        batch_size: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .describe('Records per insert batch (default 100)'),
      },
    },
    async ({ base_id, file_path, table_title, batch_size }) => {
      try {
        const csv = await readFile(file_path, 'utf-8');
        const { headers, rows: rawRows } = parseCsv(csv);
        if (headers.length === 0) {
          return fail(new Error('CSV is empty or has no header row'), 'import_csv_to_new_table');
        }

        const records = csvToRecords(csv);

        // Infer field types per column
        const fields = headers.map((h, idx) => ({
          title: h,
          uidt: inferUidt(rawRows.map((r) => coerceValue(r[idx] ?? ''))),
        }));

        const created = await client.request<{ id?: string; title?: string }>(
          `/meta/bases/${base_id}/tables`,
          {
            method: 'POST',
            body: { title: table_title, fields },
          },
        );

        if (!created.id) {
          return fail(new Error('Table created but no ID returned'), 'import_csv_to_new_table');
        }

        const batch = batch_size ?? 100;
        let inserted = 0;
        for (let i = 0; i < records.length; i += batch) {
          const chunk = records.slice(i, i + batch);
          await client.request(`/data/${base_id}/${created.id}/records`, {
            method: 'POST',
            body: chunk,
          });
          inserted += chunk.length;
        }

        return ok({
          table_id: created.id,
          table_title: created.title,
          fields_created: fields.length,
          fields,
          records_inserted: inserted,
        });
      } catch (err) {
        return fail(err, 'import_csv_to_new_table');
      }
    },
  );

  server.registerTool(
    'import_csv_append',
    {
      title: 'Import CSV → existing table (append)',
      description:
        'Read a local CSV file and append rows to an existing table. ' +
        'CSV column headers must match table field titles (extras are ignored).',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        file_path: z.string(),
        batch_size: z.number().int().positive().max(1000).optional(),
      },
    },
    async ({ base_id, table_id, file_path, batch_size }) => {
      try {
        const csv = await readFile(file_path, 'utf-8');
        const records = csvToRecords(csv);
        const batch = batch_size ?? 100;
        let inserted = 0;
        for (let i = 0; i < records.length; i += batch) {
          await client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'POST',
            body: records.slice(i, i + batch),
          });
          inserted += Math.min(batch, records.length - i);
        }
        return ok({ table_id, records_inserted: inserted });
      } catch (err) {
        return fail(err, 'import_csv_append');
      }
    },
  );

  server.registerTool(
    'import_json_records',
    {
      title: 'Import records from JSON',
      description:
        'Insert an inline JSON array of records into a table. ' +
        'Useful when records are already structured in memory or generated from another tool.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        records: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe('Array of record objects'),
        batch_size: z.number().int().positive().max(1000).optional(),
      },
    },
    async ({ base_id, table_id, records, batch_size }) =>
      tryTool(async () => {
        const batch = batch_size ?? 100;
        let inserted = 0;
        for (let i = 0; i < records.length; i += batch) {
          await client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'POST',
            body: records.slice(i, i + batch),
          });
          inserted += Math.min(batch, records.length - i);
        }
        return { table_id, records_inserted: inserted };
      }, 'import_json_records'),
  );

  server.registerTool(
    'export_table_json',
    {
      title: 'Export table → JSON',
      description:
        'Fetch all records of a table (handles pagination) and return them as a JSON array. ' +
        'Use `where` to filter, `limit` to cap total. Default cap: 10,000 records.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        where: z.string().optional(),
        limit: z.number().int().positive().max(100_000).optional(),
      },
    },
    async ({ base_id, table_id, where, limit }) =>
      tryTool(async () => {
        const cap = limit ?? 10_000;
        const pageSize = 1000;
        const all: unknown[] = [];
        let offset = 0;
        while (all.length < cap) {
          const page = await client.request<{
            list?: unknown[];
            pageInfo?: { isLastPage?: boolean };
          }>(`/data/${base_id}/${table_id}/records`, { query: { where, limit: pageSize, offset } });
          const items = page.list ?? [];
          all.push(...items);
          if (items.length < pageSize || page.pageInfo?.isLastPage) break;
          offset += pageSize;
        }
        const trimmed = all.slice(0, cap);
        return { table_id, count: trimmed.length, records: trimmed };
      }, 'export_table_json'),
  );

  server.registerTool(
    'export_base_schema',
    {
      title: 'Export base schema',
      description:
        'Export the structural schema of a base (tables, fields, views, filters, sorts) ' +
        'as a JSON document. Use this to template a base, share with collaborators, or ' +
        'restore later via `import_base_schema` (Phase 3).',
      inputSchema: {
        base_id: baseIdSchema,
      },
    },
    async ({ base_id }) =>
      tryTool(async () => {
        const base = await client.request<{ title?: string }>(`/meta/bases/${base_id}`);
        const tableList = await client.request<{
          list?: Array<{ id: string; title: string }>;
        }>(`/meta/bases/${base_id}/tables`);

        const tables = await Promise.all(
          (tableList.list ?? []).map(async (t) => {
            const detail = await client.request<{
              id: string;
              title: string;
              fields?: unknown[];
              views?: Array<{ id: string }>;
            }>(`/meta/bases/${base_id}/tables/${t.id}`);

            const views = await Promise.all(
              (detail.views ?? []).map(async (v) => {
                const view = await client.request<Record<string, unknown>>(
                  `/meta/bases/${base_id}/views/${v.id}`,
                );
                const filters = await client
                  .request(`/meta/bases/${base_id}/views/${v.id}/filters`)
                  .catch(() => ({ list: [] }));
                const sorts = await client
                  .request(`/meta/bases/${base_id}/views/${v.id}/sorts`)
                  .catch(() => ({ list: [] }));
                return { ...view, filters, sorts };
              }),
            );

            return {
              id: detail.id,
              title: detail.title,
              fields: detail.fields ?? [],
              views,
            };
          }),
        );

        return {
          schema_version: 1,
          exported_at: new Date().toISOString(),
          base: { id: base_id, title: base.title },
          tables,
        };
      }, 'export_base_schema'),
  );
}
