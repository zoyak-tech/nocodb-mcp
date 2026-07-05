import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoDBClient, NocoDBError } from '../src/client.js';
import type { NocoDBConfig } from '../src/config.js';
import { listWorkspacesResilient, probeNocoDB } from '../src/tools/workspace-helpers.js';

const config: NocoDBConfig = {
  baseUrl: 'https://nc.example.com',
  apiToken: 'nc_pat_test',
  timeoutMs: 5000,
  logLevel: 'error',
};

function json(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
  });
}

describe('probeNocoDB (ping resilience)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('reports workspace count when the v3 workspace API exists', async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ currentVersion: '2026.04.3', releaseVersion: '2026.06.2' }))
      .mockResolvedValueOnce(json({ list: [{ id: 'w1' }, { id: 'w2' }] }));

    const res = await probeNocoDB(new NocoDBClient(config), config);
    expect(res.ok).toBe(true);
    expect(res.version).toBe('2026.04.3');
    expect(res.upToDate).toBe(false);
    expect(res.accessibleWorkspaces).toBe(2);
  });

  it('stays green on older NocoDB where /api/v3/meta/workspaces 404s', async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ currentVersion: '0.301.2', releaseVersion: '0.301.3' }))
      .mockResolvedValueOnce(json({ msg: 'Cannot GET /api/v3/meta/workspaces' }, 404, 'Not Found'));

    const res = await probeNocoDB(new NocoDBClient(config), config);
    // Ping's job is connectivity + auth + version — it must NOT fail because
    // the (optional) workspace probe is missing on this NocoDB version.
    expect(res.ok).toBe(true);
    expect(res.version).toBe('0.301.2');
    expect(res.accessibleWorkspaces).toBeNull();
  });
});

describe('listWorkspacesResilient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns the v3 workspace list unchanged when v3 is available', async () => {
    fetchSpy.mockResolvedValueOnce(
      json({ list: [{ id: 'wh59cmff', title: 'Default Workspace' }] }),
    );

    const res = await listWorkspacesResilient(new NocoDBClient(config));
    expect(res.list).toHaveLength(1);
    expect(res._apiFallback).toBeUndefined();
    // exactly one HTTP call — no fallback probing
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://nc.example.com/api/v3/meta/workspaces');
  });

  it('falls back to the legacy /api/v1 project list on 404', async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ msg: 'not found' }, 404, 'Not Found'))
      .mockResolvedValueOnce(
        json({ list: [{ id: 'p1abc', title: 'Marketing', fk_workspace_id: 'w0' }] }),
      );

    const res = await listWorkspacesResilient(new NocoDBClient(config));
    expect(res._apiFallback).toBe('v1');
    expect(res._note).toMatch(/legacy/i);
    expect(res.list).toHaveLength(1);
    expect(res.list[0]).toMatchObject({ id: 'p1abc', title: 'Marketing' });
    // second call must hit the legacy endpoint verbatim (no /api/v3 prefixing)
    expect(fetchSpy.mock.calls[1][0]).toBe('https://nc.example.com/api/v1/db/meta/projects');
  });

  it('throws a helpful error when both v3 and the legacy endpoint 404', async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ msg: 'no v3' }, 404, 'Not Found'))
      .mockResolvedValueOnce(json({ msg: 'no legacy' }, 404, 'Not Found'));

    const err = await listWorkspacesResilient(new NocoDBClient(config)).catch((e) => e);
    expect(err).toBeInstanceOf(NocoDBError);
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/list_bases/);
  });
});
