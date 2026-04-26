import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const docIdSchema = z.string().min(1).describe('Doc page ID');

/**
 * NocoDocs — the documentation/wiki feature shipped in NocoDB 2026.04.2.
 * Endpoints live under /api/v3/docs/{baseId}.
 */
export function registerDocsTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_docs',
    {
      title: 'List documentation pages',
      description: 'List all NocoDocs pages in a base.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) => tryTool(() => client.request(`/api/v3/docs/${base_id}`), 'list_docs'),
  );

  server.registerTool(
    'get_doc',
    {
      title: 'Get doc page',
      description: 'Get a doc page with its content (Markdown).',
      inputSchema: {
        base_id: baseIdSchema,
        doc_id: docIdSchema,
      },
    },
    async ({ base_id, doc_id }) =>
      tryTool(() => client.request(`/api/v3/docs/${base_id}/${doc_id}`), 'get_doc'),
  );

  server.registerTool(
    'create_doc',
    {
      title: 'Create doc page',
      description:
        'Create a new documentation page in a base. Supports Markdown content. ' +
        'Use `parent_id` to create as a child of another page (nested wiki structure).',
      inputSchema: {
        base_id: baseIdSchema,
        title: z.string().min(1),
        content: z.string().optional().describe('Markdown body'),
        parent_id: z.string().optional().describe('Optional parent doc ID for nesting'),
      },
    },
    async ({ base_id, title, content, parent_id }) =>
      tryTool(
        () =>
          client.request(`/api/v3/docs/${base_id}`, {
            method: 'POST',
            body: { title, content, parent_id },
          }),
        'create_doc',
      ),
  );

  server.registerTool(
    'update_doc',
    {
      title: 'Update doc page',
      description: 'Edit a doc — change title, content, or move it under a different parent.',
      inputSchema: {
        base_id: baseIdSchema,
        doc_id: docIdSchema,
        title: z.string().optional(),
        content: z.string().optional(),
        parent_id: z.string().optional(),
      },
    },
    async ({ base_id, doc_id, title, content, parent_id }) =>
      tryTool(
        () =>
          client.request(`/api/v3/docs/${base_id}/${doc_id}`, {
            method: 'PATCH',
            body: { title, content, parent_id },
          }),
        'update_doc',
      ),
  );

  server.registerTool(
    'delete_doc',
    {
      title: 'Delete doc page',
      description:
        'Delete a doc page (and its child pages, recursively). Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        doc_id: docIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, doc_id, dry_run }) => {
      if (dry_run) return dryRunPreview('delete_doc', { base_id, doc_id });
      return tryTool(
        () => client.request(`/api/v3/docs/${base_id}/${doc_id}`, { method: 'DELETE' }),
        'delete_doc',
      );
    },
  );

  server.registerTool(
    'reorder_doc',
    {
      title: 'Reorder doc page',
      description: 'Change the position of a doc page within its parent.',
      inputSchema: {
        base_id: baseIdSchema,
        doc_id: docIdSchema,
        order: z.number().describe('New order position'),
      },
    },
    async ({ base_id, doc_id, order }) =>
      tryTool(
        () =>
          client.request(`/api/v3/docs/${base_id}/${doc_id}/reorder`, {
            method: 'PATCH',
            body: { order },
          }),
        'reorder_doc',
      ),
  );
}
