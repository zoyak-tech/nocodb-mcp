import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema, tableIdSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const HOOK_EVENTS = [
  'after.insert',
  'after.update',
  'after.delete',
  'after.bulkInsert',
  'after.bulkUpdate',
  'after.bulkDelete',
] as const;

const HOOK_OPERATIONS = [
  'URL',
  'Email',
  'Slack',
  'Discord',
  'MicrosoftTeams',
  'Whatsapp',
  'Twilio',
] as const;

const hookIdSchema = z.string().min(1).describe('NocoDB webhook (hook) ID');

export function registerWebhookTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_webhooks',
    {
      title: 'List webhooks',
      description: 'List all webhooks attached to a table.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
      },
    },
    async ({ base_id, table_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/tables/${table_id}/hooks`),
        'list_webhooks',
      ),
  );

  server.registerTool(
    'get_webhook',
    {
      title: 'Get webhook details',
      description: 'Get a webhook by ID, including its configuration and payload.',
      inputSchema: {
        base_id: baseIdSchema,
        hook_id: hookIdSchema,
      },
    },
    async ({ base_id, hook_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/hooks/${hook_id}`), 'get_webhook'),
  );

  server.registerTool(
    'create_webhook',
    {
      title: 'Create webhook',
      description:
        'Create a new webhook on a table. The webhook fires on the specified event ' +
        '(insert/update/delete or bulk variants) and posts to the configured URL or ' +
        'sends to a notification channel (Slack, Discord, Email, etc.).',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        title: z.string().min(1).describe('Webhook display name'),
        event: z
          .enum(HOOK_EVENTS)
          .describe('When to fire — e.g. after.insert, after.update, after.bulkInsert'),
        operation: z
          .enum(HOOK_OPERATIONS)
          .describe('Delivery channel: URL (HTTP webhook), Email, Slack, Discord, etc.'),
        notification_url: z.string().url().optional().describe('Required when operation=URL'),
        notification_config: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Channel-specific config. For URL: { method, headers, body }. ' +
              'For Slack/Discord: { channels: [{ webhook_url }] }.',
          ),
        condition: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Optional: only fire when condition matches'),
        active: z.boolean().optional().describe('Default true'),
      },
    },
    async ({
      base_id,
      table_id,
      title,
      event,
      operation,
      notification_url,
      notification_config,
      condition,
      active,
    }) =>
      tryTool(() => {
        const [eventTime, eventName] = event.split('.');
        const notification: Record<string, unknown> = {
          type: operation,
          payload: notification_config ?? {},
        };
        if (operation === 'URL' && notification_url) {
          notification.payload = {
            ...((notification.payload as Record<string, unknown>) ?? {}),
            path: notification_url,
            method: (notification_config?.method as string) ?? 'POST',
          };
        }

        return client.request(`/meta/bases/${base_id}/tables/${table_id}/hooks`, {
          method: 'POST',
          body: {
            title,
            event: eventName,
            operation: eventTime,
            notification,
            condition,
            active: active ?? true,
          },
        });
      }, 'create_webhook'),
  );

  server.registerTool(
    'update_webhook',
    {
      title: 'Update webhook',
      description: 'Update a webhook — change title, URL, condition, or enable/disable it.',
      inputSchema: {
        base_id: baseIdSchema,
        hook_id: hookIdSchema,
        title: z.string().optional(),
        notification_config: z.record(z.string(), z.unknown()).optional(),
        condition: z.record(z.string(), z.unknown()).optional(),
        active: z.boolean().optional(),
      },
    },
    async ({ base_id, hook_id, title, notification_config, condition, active }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/hooks/${hook_id}`, {
            method: 'PATCH',
            body: {
              title,
              notification: notification_config ? { payload: notification_config } : undefined,
              condition,
              active,
            },
          }),
        'update_webhook',
      ),
  );

  server.registerTool(
    'delete_webhook',
    {
      title: 'Delete webhook',
      description: 'Remove a webhook. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        hook_id: hookIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, hook_id, dry_run }) => {
      if (dry_run) {
        return dryRunPreview('delete_webhook', { base_id, hook_id });
      }
      return tryTool(
        () => client.request(`/meta/bases/${base_id}/hooks/${hook_id}`, { method: 'DELETE' }),
        'delete_webhook',
      );
    },
  );
}
