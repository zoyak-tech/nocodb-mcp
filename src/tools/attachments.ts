import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NocoDBClient } from '../client.js';
import type { NocoDBConfig } from '../config.js';
import { baseIdSchema, fieldIdSchema, tableIdSchema } from '../schemas/common.js';
import { fail, ok, tryTool } from './helpers.js';

const recordIdSchema = z.union([z.string(), z.number()]).describe('Record primary key value');

export function registerAttachmentTools(
  server: McpServer,
  client: NocoDBClient,
  config: NocoDBConfig,
): void {
  server.registerTool(
    'upload_attachment_to_record',
    {
      title: 'Upload file to attachment field',
      description:
        'Upload a local file (by path) and attach it to a specific record/field. ' +
        'Use this for Attachment-typed fields. Supports any file type NocoDB accepts.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_id: recordIdSchema,
        field_id: fieldIdSchema,
        file_path: z.string().min(1).describe('Absolute path to the local file'),
        mime_type: z
          .string()
          .optional()
          .describe('MIME type override (defaults to application/octet-stream)'),
      },
    },
    async ({ base_id, table_id, record_id, field_id, file_path, mime_type }) => {
      try {
        const fileBuf = await readFile(file_path);
        const fileName = basename(file_path);
        const contentType = mime_type ?? 'application/octet-stream';

        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(fileBuf)], { type: contentType }), fileName);

        // Use raw fetch since our client wraps JSON; this needs multipart
        const url = `${config.baseUrl}/api/v3/data/${base_id}/${table_id}/records/${record_id}/fields/${field_id}/upload`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'xc-token': config.apiToken },
          body: form,
        });

        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;

        if (!res.ok) {
          return fail(
            new Error(`Upload failed: ${res.status} ${res.statusText} — ${text}`),
            'upload_attachment_to_record',
          );
        }

        return ok({
          uploaded: fileName,
          size: fileBuf.length,
          response: parsed,
        });
      } catch (err) {
        return fail(err, 'upload_attachment_to_record');
      }
    },
  );

  server.registerTool(
    'attach_url_to_record',
    {
      title: 'Attach a URL to an attachment field',
      description:
        'Attach a remote URL (e.g. an image hosted elsewhere) to a record/field. ' +
        'NocoDB will download and store the file. Faster than re-uploading from disk.',
      inputSchema: {
        base_id: baseIdSchema,
        table_id: tableIdSchema,
        record_id: recordIdSchema,
        field_id: fieldIdSchema,
        url: z.string().url().describe('Remote URL of the file'),
        title: z.string().optional().describe('Optional file display name'),
      },
    },
    async ({ base_id, table_id, record_id, field_id, url, title }) =>
      tryTool(
        () =>
          client.request(`/data/${base_id}/${table_id}/records`, {
            method: 'PATCH',
            body: [
              {
                Id: record_id,
                [field_id]: [{ url, title: title ?? basename(new URL(url).pathname) }],
              },
            ],
          }),
        'attach_url_to_record',
      ),
  );
}
