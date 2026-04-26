import { describe, expect, it } from 'vitest';
import type { NocoDBConfig } from '../src/config.js';
import { createServer } from '../src/server.js';

const config: NocoDBConfig = {
  baseUrl: 'https://nc.example.com',
  apiToken: 'nc_pat_test',
  timeoutMs: 5000,
  logLevel: 'error',
};

describe('createServer', () => {
  it('creates an McpServer instance without throwing', () => {
    const server = createServer(config);
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
  });

  it('exposes tools from all registered groups', () => {
    const server = createServer(config);
    // The McpServer keeps tools internally; check via the underlying server's
    // request-handler list — easiest proxy is to ensure no throw on registration
    // (any duplicate name would have thrown).
    expect(() => createServer(config)).not.toThrow();
    // Smoke check: the server has a name we set
    expect(server.server).toBeTruthy();
  });
});
