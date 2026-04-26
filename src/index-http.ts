#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
/**
 * HTTP entrypoint — serves the MCP server over Streamable HTTP transport
 * (the modern replacement for SSE in MCP spec). Useful for:
 *
 *  - Remote deployment (Smithery, self-hosted)
 *  - Multiple clients sharing a single server instance
 *  - Browsers / web playgrounds
 *
 * Single endpoint: POST/GET/DELETE /mcp
 *
 * Auth: NocoDB credentials are read from env at server start. The HTTP
 * transport is currently unauthenticated — if you expose this on the
 * public internet, run it behind a reverse proxy (nginx/caddy) that
 * does mTLS, basic auth, or a bearer token check.
 */
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { createServer, SERVER_VERSION } from './server.js';

const PORT = Number(process.env.PORT) || 3000;
// Default to 0.0.0.0 because the HTTP entrypoint is mainly used for container
// deployments (Docker, Dokploy, Coolify, Smithery), where binding to 127.0.0.1
// makes the server unreachable from outside the container. Override locally if
// you only want to expose on loopback: HOST=127.0.0.1.
const HOST = process.env.HOST || '0.0.0.0';
const STATELESS = process.env.MCP_STATELESS === 'true';

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf-8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const mcpServer = createServer(config);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: STATELESS ? undefined : () => randomUUID(),
  });

  await mcpServer.connect(transport);

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health check
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          name: 'nocodb-mcp',
          version: SERVER_VERSION,
          target: config.baseUrl,
          stateless: STATELESS,
        }),
      );
      return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp' || url.pathname === '/') {
      try {
        const body = req.method === 'POST' ? await readBody(req) : undefined;
        await transport.handleRequest(req, res, body);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      }
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', available: ['/mcp', '/health'] }));
  });

  httpServer.listen(PORT, HOST, () => {
    process.stderr.write(
      `nocodb-mcp v${SERVER_VERSION} listening on http://${HOST}:${PORT}\n` +
        `  - MCP:    http://${HOST}:${PORT}/mcp\n` +
        `  - Health: http://${HOST}:${PORT}/health\n` +
        `  - Mode:   ${STATELESS ? 'stateless' : 'stateful (session id per client)'}\n` +
        `  - Target: ${config.baseUrl}\n`,
    );
  });

  // Graceful shutdown
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      process.stderr.write(`\nReceived ${sig}, shutting down...\n`);
      httpServer.close(() => {
        void transport.close().then(() => process.exit(0));
      });
    });
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
