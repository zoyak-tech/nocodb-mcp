import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoDBClient } from '../src/client.js';
import type { NocoDBConfig } from '../src/config.js';

const v3Config: NocoDBConfig = {
  baseUrl: 'https://nc.example.com',
  apiToken: 'nc_pat_test',
  timeoutMs: 5000,
  logLevel: 'error',
  apiVersion: 'v3',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('NocoDBClient.writeRecords (v3 write path)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('wraps each record under `fields` (the v3 400 fix)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ records: [{ id: 1 }] }));

    const client = new NocoDBClient(v3Config);
    await client.writeRecords('/data/b1/t1/records', [{ Title: 'seo', Volume: 12 }]);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual([{ fields: { Title: 'seo', Volume: 12 } }]);
  });

  it('batches inserts into groups of at most 10 (the 422 fix)', async () => {
    fetchSpy.mockImplementation(async () => jsonResponse({ records: [] }));

    const client = new NocoDBClient(v3Config);
    const records = Array.from({ length: 23 }, (_, i) => ({ Title: `k${i}` }));
    const result = await client.writeRecords('/data/b1/t1/records', records);

    // 23 records → 10 + 10 + 3 = 3 requests
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.batches).toBe(3);
    expect(result.count).toBe(23);

    const sentCounts = fetchSpy.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).length,
    );
    expect(sentCounts).toEqual([10, 10, 3]);
  });

  it('aggregates created records across batches', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ records: [{ id: 1 }, { id: 2 }] }))
      .mockResolvedValueOnce(jsonResponse({ records: [{ id: 3 }] }));

    const client = new NocoDBClient(v3Config);
    const records = Array.from({ length: 13 }, (_, i) => ({ Title: `k${i}` }));
    const result = await client.writeRecords('/data/b1/t1/records', records);

    expect(result.records).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('omits empty typed values so "" never reaches the API', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ records: [] }));

    const client = new NocoDBClient(v3Config);
    await client.writeRecords('/data/b1/t1/records', [{ Title: 'x', Volume: '', Score: 0 }]);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual([{ fields: { Title: 'x', Score: 0 } }]);
  });

  it('sends v3 update shape { id, fields }', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ records: [] }));

    const client = new NocoDBClient(v3Config);
    await client.writeRecords('/data/b1/t1/records', [{ Id: 7, Title: 'renamed' }], {
      method: 'PATCH',
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual([{ id: 7, fields: { Title: 'renamed' } }]);
  });

  it('keeps the flat legacy shape and large batches for v2', async () => {
    fetchSpy.mockImplementation(async () => jsonResponse([]));

    const client = new NocoDBClient({ ...v3Config, apiVersion: 'v2' });
    const records = Array.from({ length: 15 }, (_, i) => ({ Title: `k${i}` }));
    await client.writeRecords('/data/b1/t1/records', records);

    // v2 default batch is 100, so all 15 go in one request, flat.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toHaveLength(15);
    expect(body[0]).toEqual({ Title: 'k0' });
  });
});
