import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, fieldIdSchema, tableIdSchema } from '../schemas/common.js';
import { tryTool } from './helpers.js';

const LINK_TYPES = ['hm', 'mm', 'bt', 'oo'] as const;

const recordIdSchema = z.union([z.string(), z.number()]).describe('Record primary key value');

export function registerLinkTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'create_link_field',
    {
      title: 'Create link field (relation)',
      description:
        'Create a relational field between two tables. ' +
        'Type: "hm" (has many), "mm" (many to many), "bt" (belongs to), "oo" (one to one). ' +
        'Most common: "mm" for tags / categories / multi-select-like links.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema.describe('Table that will have the new link field'),
        title: z.string().min(1).describe('Display name of the link field'),
        related_table_id: tableIdSchema.describe('Table to link to'),
        type: z.enum(LINK_TYPES).describe('Relation type'),
      },
    },
    async ({ base_id, table_id, title, related_table_id, type }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}/fields`, {
            method: 'POST',
            body: {
              title,
              // NocoDB v3 API uses `type` for the UIDT. The relationship type
              // (hm/mm/bt/oo) lives under options.
              type: 'LinkToAnotherRecord',
              options: {
                relatedTableId: related_table_id,
                type,
              },
            },
          }),
        'create_link_field',
      ),
  );

  server.registerTool(
    'list_linked_records',
    {
      title: 'List linked records',
      description: 'List records linked to a specific record through a link field.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        link_field_id: fieldIdSchema,
        record_id: recordIdSchema,
        limit: z.number().int().positive().max(1000).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
    },
    async ({ base_id, table_id, link_field_id, record_id, limit, offset }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/links/${link_field_id}/${record_id}`, {
            query: { limit, offset },
          }),
        'list_linked_records',
      ),
  );

  server.registerTool(
    'link_records',
    {
      title: 'Link records',
      description:
        'Create links between a source record and one or more target records ' +
        'through a link field. The target records must exist in the related table.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        link_field_id: fieldIdSchema,
        record_id: recordIdSchema,
        target_record_ids: z.array(recordIdSchema).min(1),
      },
    },
    async ({ base_id, table_id, link_field_id, record_id, target_record_ids }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/links/${link_field_id}/${record_id}`, {
            method: 'POST',
            body: target_record_ids.map((id) => ({ Id: id })),
          }),
        'link_records',
      ),
  );

  server.registerTool(
    'unlink_records',
    {
      title: 'Unlink records',
      description:
        'Remove links between a source record and target records. Does NOT delete the records themselves.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        link_field_id: fieldIdSchema,
        record_id: recordIdSchema,
        target_record_ids: z.array(recordIdSchema).min(1),
      },
    },
    async ({ base_id, table_id, link_field_id, record_id, target_record_ids }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/links/${link_field_id}/${record_id}`, {
            method: 'DELETE',
            body: target_record_ids.map((id) => ({ Id: id })),
          }),
        'unlink_records',
      ),
  );
}
