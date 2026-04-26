import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import { baseIdSchema } from '../schemas/common.js';
import { tryTool } from './helpers.js';

const workflowIdSchema = z.string().min(1).describe('Workflow ID');
const executionIdSchema = z.string().min(1).describe('Workflow execution ID');

export function registerWorkflowTools(server: McpServer, client: NocoDBClient): void {
  server.registerTool(
    'list_workflows',
    {
      title: 'List workflows',
      description: 'List all workflows in a base. Workflows are stored in the base meta.',
      inputSchema: { base_id: baseIdSchema },
    },
    async ({ base_id }) =>
      tryTool(() => client.request(`/meta/bases/${base_id}/workflows`), 'list_workflows'),
  );

  server.registerTool(
    'get_workflow',
    {
      title: 'Get workflow',
      description: 'Get a workflow by ID, including its definition (nodes, triggers, edges).',
      inputSchema: {
        base_id: baseIdSchema,
        workflow_id: workflowIdSchema,
      },
    },
    async ({ base_id, workflow_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/workflows/${workflow_id}`),
        'get_workflow',
      ),
  );

  server.registerTool(
    'execute_workflow',
    {
      title: 'Execute workflow',
      description:
        'Trigger a workflow execution manually. Optionally pass `inputs` to override defaults. ' +
        'Returns the execution ID — use `get_workflow_execution` to poll status.',
      inputSchema: {
        base_id: baseIdSchema,
        workflow_id: workflowIdSchema,
        inputs: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ base_id, workflow_id, inputs }) =>
      tryTool(
        () =>
          client.request(`/meta/bases/${base_id}/workflows/${workflow_id}/execute`, {
            method: 'POST',
            body: { inputs },
          }),
        'execute_workflow',
      ),
  );

  server.registerTool(
    'list_workflow_executions',
    {
      title: 'List workflow executions',
      description: 'List recent executions of a workflow with their status.',
      inputSchema: {
        base_id: baseIdSchema,
        workflow_id: workflowIdSchema,
      },
    },
    async ({ base_id, workflow_id }) =>
      tryTool(
        () => client.request(`/meta/bases/${base_id}/workflows/${workflow_id}/executions`),
        'list_workflow_executions',
      ),
  );

  server.registerTool(
    'get_workflow_execution',
    {
      title: 'Get workflow execution',
      description: 'Get details of a single execution (status, logs, output).',
      inputSchema: {
        base_id: baseIdSchema,
        workflow_id: workflowIdSchema,
        execution_id: executionIdSchema,
      },
    },
    async ({ base_id, workflow_id, execution_id }) =>
      tryTool(
        () =>
          client.request(
            `/meta/bases/${base_id}/workflows/${workflow_id}/executions/${execution_id}`,
          ),
        'get_workflow_execution',
      ),
  );
}
