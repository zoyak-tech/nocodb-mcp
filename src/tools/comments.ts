import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, tableIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const commentIdSchema = z.string().min(1).describe('Comment ID');
const recordIdSchema = z.union([z.string(), z.number()]).describe('Record primary key');

export function registerCommentTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_record_comments',
    {
      title: 'List record comments',
      description: 'Get all comments attached to a specific record.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_id: recordIdSchema,
      },
    },
    async ({ base_id, table_id, record_id }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/tables/${table_id}/records/${record_id}/comments`),
        'list_record_comments',
      ),
  );

  server.registerTool(
    'create_record_comment',
    {
      title: 'Create record comment',
      description: 'Post a comment on a record (Markdown supported in NocoDB UI).',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_id: recordIdSchema,
        comment: z.string().min(1).describe('Comment body (markdown)'),
      },
    },
    async ({ base_id, table_id, record_id, comment }) =>
      tryTool(
        () =>
          client.request(
            `/meta/bases/${base_id}/tables/${table_id}/records/${record_id}/comments`,
            { method: 'POST', body: { comment } },
          ),
        'create_record_comment',
      ),
  );

  server.registerTool(
    'update_comment',
    {
      title: 'Update comment',
      description: 'Edit an existing comment.',
      inputSchema: {
        base_id: baseIdSchema,
        comment_id: commentIdSchema,
        comment: z.string().min(1),
      },
    },
    async ({ base_id, comment_id, comment }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/comments/${comment_id}`, {
            method: 'PATCH',
            body: { comment },
          }),
        'update_comment',
      ),
  );

  server.registerTool(
    'delete_comment',
    {
      title: 'Delete comment',
      description: 'Remove a comment. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        comment_id: commentIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, comment_id, dry_run }) => {
      if (dry_run) return dryRunPreview('delete_comment', { base_id, comment_id });
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/comments/${comment_id}`, {
            method: 'DELETE',
          }),
        'delete_comment',
      );
    },
  );

  server.registerTool(
    'resolve_comment',
    {
      title: 'Mark comment resolved',
      description: 'Mark a comment as resolved (closed) without deleting it.',
      inputSchema: {
        base_id: baseIdSchema,
        comment_id: commentIdSchema,
      },
    },
    async ({ base_id, comment_id }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/comments/${comment_id}/resolve`, {
            method: 'POST',
          }),
        'resolve_comment',
      ),
  );
}
