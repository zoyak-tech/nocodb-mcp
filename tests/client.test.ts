import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoDBClient } from '../src/client.js';
import type { NocoDBConfig } from '../src/config.js';

const config: NocoDBConfig = {
  baseUrl: 'https://nc.example.com',
  apiToken: 'nc_pat_test',
  timeoutMs: 5000,
  logLevel: 'error',
};

describe('NocoDBClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('builds v3 URL by default and sends xc-token header', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new NocoDBClient(config);
    await client.request('/meta/workspaces');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://nc.example.com/api/v3/meta/workspaces');
    expect((init.headers as Record<string, string>)['xc-token']).toBe('nc_pat_test');
  });

  it('respects explicit /api/ prefixed paths (e.g. v1 version endpoint)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ currentVersion: '2026.04.3' }), { status: 200 }),
    );

    const client = new NocoDBClient(config);
    await client.request('/api/v1/version');

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe('https://nc.example.com/api/v1/version');
  });

  it('throws NocoDBError with parsed body on 4xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'no such base' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const client = new NocoDBClient(config);
    await expect(client.request('/meta/bases/xxx')).rejects.toMatchObject({
      name: 'NocoDBError',
      status: 404,
    });
  });

  it('appends query params, skipping undefined values', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const client = new NocoDBClient(config);
    await client.request('/data/abc/def/records', {
      query: { limit: 25, offset: undefined, where: '(name,eq,foo)' },
    });

    const [url] = fetchSpy.mock.calls[0] as [string];
    const u = new URL(url);
    expect(u.searchParams.get('limit')).toBe('25');
    expect(u.searchParams.has('offset')).toBe(false);
    expect(u.searchParams.get('where')).toBe('(name,eq,foo)');
  });
});
