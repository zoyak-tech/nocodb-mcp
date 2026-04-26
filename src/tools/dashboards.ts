import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema, dryRunSchema } from '../schemas/common.js';
import { dryRunPreview, tryTool } from './helpers.js';

const dashboardIdSchema = z.string().min(1).describe('Dashboard ID');
const widgetIdSchema = z.string().min(1).describe('Widget ID');

export function registerDashboardTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_dashboards',
    {
      title: 'List dashboards',
      description: 'List all dashboards in a base.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/dashboards`), 'list_dashboards'),
  );

  server.registerTool(
    'get_dashboard',
    {
      title: 'Get dashboard',
      description: 'Get a dashboard with its widget configuration.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
      },
    },
    async ({ base_id, dashboard_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}`),
        'get_dashboard',
      ),
  );

  server.registerTool(
    'get_dashboard_data',
    {
      title: 'Get dashboard data',
      description: 'Fetch the rendered data for all widgets in a dashboard.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
      },
    },
    async ({ base_id, dashboard_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}/data`),
        'get_dashboard_data',
      ),
  );

  server.registerTool(
    'create_dashboard',
    {
      title: 'Create dashboard',
      description: 'Create a new dashboard in a base.',
      inputSchema: {
        base_id: baseIdSchema,
        title: z.string().min(1),
        description: z.string().optional(),
      },
    },
    async ({ base_id, title, description }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards`, {
            method: 'POST',
            body: { title, description },
          }),
        'create_dashboard',
      ),
  );

  server.registerTool(
    'update_dashboard',
    {
      title: 'Update dashboard',
      description: 'Rename or change the description of a dashboard.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
        title: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async ({ base_id, dashboard_id, title, description }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}`, {
            method: 'PATCH',
            body: { title, description },
          }),
        'update_dashboard',
      ),
  );

  server.registerTool(
    'delete_dashboard',
    {
      title: 'Delete dashboard',
      description: 'Remove a dashboard. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, dashboard_id, dry_run }) => {
      if (dry_run) return dryRunPreview('delete_dashboard', { base_id, dashboard_id });
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}`, {
            method: 'DELETE',
          }),
        'delete_dashboard',
      );
    },
  );

  server.registerTool(
    'list_widgets',
    {
      title: 'List dashboard widgets',
      description: 'List widgets of a dashboard.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
      },
    },
    async ({ base_id, dashboard_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}/widgets`),
        'list_widgets',
      ),
  );

  server.registerTool(
    'create_widget',
    {
      title: 'Create widget',
      description: 'Add a new widget to a dashboard.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
        title: z.string().min(1),
        type: z.string().describe('Widget type (chart, number, text, etc.)'),
        config: z.record(z.string(), z.unknown()).describe('Widget configuration object'),
      },
    },
    async ({ base_id, dashboard_id, title, type, config }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}/widgets`, {
            method: 'POST',
            body: { title, type, ...config },
          }),
        'create_widget',
      ),
  );

  server.registerTool(
    'update_widget',
    {
      title: 'Update widget',
      description: 'Update a widget — title, type, or configuration.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
        widget_id: widgetIdSchema,
        title: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ base_id, dashboard_id, widget_id, title, config }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}/widgets/${widget_id}`, {
            method: 'PATCH',
            body: { title, ...(config ?? {}) },
          }),
        'update_widget',
      ),
  );

  server.registerTool(
    'delete_widget',
    {
      title: 'Delete widget',
      description: 'Remove a widget. Use `dry_run: true` to preview.',
      inputSchema: {
        base_id: baseIdSchema,
        dashboard_id: dashboardIdSchema,
        widget_id: widgetIdSchema,
        dry_run: dryRunSchema,
      },
    },
    async ({ base_id, dashboard_id, widget_id, dry_run }) => {
      if (dry_run) return dryRunPreview('delete_widget', { base_id, dashboard_id, widget_id });
      return tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/dashboards/${dashboard_id}/widgets/${widget_id}`, {
            method: 'DELETE',
          }),
        'delete_widget',
      );
    },
  );
}
