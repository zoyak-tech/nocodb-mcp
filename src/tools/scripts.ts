import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const scriptIdSchema = z.string().min(1).describe('Script ID');

export function registerScriptTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_scripts',
    {
      title: 'List scripts',
      description: 'List all scripts (NocoDB Scripts feature) attached to a base.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/scripts`), 'list_scripts'),
  );

  server.registerTool(
    'get_script',
    {
      title: 'Get script details',
      description: 'Get a script by ID, including its source code and metadata.',
      inputSchema: {
        base_id: baseIdSchema,
        script_id: scriptIdSchema,
      },
    },
    async ({ base_id, script_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/scripts/${script_id}`), 'get_script'),
  );

  server.registerTool(
    'create_script',
    {
      title: 'Create script',
      description: 'Add a new script to a base.',
      inputSchema: {
        base_id: baseIdSchema,
        title: z.string().min(1),
        description: z.string().optional(),
        script: z.string().describe('JavaScript source code'),
      },
    },
    async ({ base_id, title, description, script }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/scripts`, {
            method: 'POST',
            body: { title, description, script },
          }),
        'create_script',
      ),
  );

  server.registerTool(
    'update_script',
    {
      title: 'Update script',
      description: 'Edit a script (rename, change description, update source).',
      inputSchema: {
        base_id: baseIdSchema,
        script_id: scriptIdSchema,
        title: z.string().optional(),
        description: z.string().optional(),
        script: z.string().optional(),
      },
    },
    async ({ base_id, script_id, title, description, script }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/scripts/${script_id}`, {
            method: 'PATCH',
            body: { title, description, script },
          }),
        'update_script',
      ),
  );

  server.registerTool(
    'delete_script',
    {
      title: 'Delete script',
      description: 'Remove a script. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        script_id: scriptIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, script_id, dry_run }) => {
      if (dry_run) return dryRunPreview('delete_script', { base_id, script_id });
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/scripts/${script_id}`, {
            method: 'DELETE',
          }),
        'delete_script',
      );
    },
  );
}
