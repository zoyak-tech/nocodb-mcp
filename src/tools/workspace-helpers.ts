import { type NocoDBClient, NocoDBError } from '../client.js';
import type { NocoDBConfig } from '../config.js';

/**
 * Shape returned by `list_workspaces`. On modern NocoDB (calendar builds / cloud)
 * this is the raw `/api/v3/meta/workspaces` payload. On older self-hosted NocoDB
 * (semver v0.30x) that endpoint does not exist, so we degrade to the legacy
 * `/api/v1` project list and annotate the response.
 */
export interface ResilientWorkspaceList {
  list: unknown[];
  _apiFallback?: 'v1';
  _note?: string;
}

const LEGACY_PROJECTS_PATH = '/api/v1/db/meta/projects';

/**
 * List workspaces, tolerating NocoDB builds that have no `/api/v3` workspace API.
 *
 * - Modern NocoDB → returns the v3 workspace list verbatim.
 * - Older NocoDB (v3 workspace endpoint 404s) → falls back to the legacy
 *   `/api/v1/db/meta/projects` endpoint and returns the bases (projects) with a note.
 * - If neither is available → throws a NocoDBError with actionable guidance.
 */
export async function listWorkspacesResilient(
  client: NocoDBClient,
): Promise<ResilientWorkspaceList> {
  try {
    return await client.request<{ list: unknown[] }>('/meta/workspaces');
  } catch (err) {
    if (!(err instanceof NocoDBError) || err.status !== 404) {
      throw err;
    }

    // Older NocoDB has no workspace concept exposed via v3. Fall back to the
    // legacy project list (the endpoint the community reported works on v0.30x).
    try {
      const legacy = await client.request<{ list?: Array<Record<string, unknown>> }>(
        LEGACY_PROJECTS_PATH,
      );
      const projects = Array.isArray(legacy?.list) ? legacy.list : [];
      return {
        list: projects.map((p) => ({
          id: p.id,
          title: p.title,
          fk_workspace_id: p.fk_workspace_id ?? null,
        })),
        _apiFallback: 'v1',
        _note:
          'This NocoDB build has no /api/v3 workspace API; listed bases (projects) via the ' +
          'legacy /api/v1 endpoint instead. Pass a base "id" straight to list_tables / list_records.',
      };
    } catch (legacyErr) {
      throw new NocoDBError(
        'No workspace API available: /api/v3/meta/workspaces returned 404 and the legacy ' +
          `${LEGACY_PROJECTS_PATH} endpoint also failed. This NocoDB version may not expose ` +
          'workspaces — use list_bases with a known base id instead.',
        404,
        {
          v3Error: err.body,
          legacyError: legacyErr instanceof NocoDBError ? legacyErr.body : String(legacyErr),
        },
      );
    }
  }
}

export interface PingResult {
  ok: true;
  baseUrl: string;
  version: string;
  latestVersion: string;
  upToDate: boolean;
  /** Count of accessible workspaces, or null when this NocoDB build has no workspace API. */
  accessibleWorkspaces: number | null;
}

/**
 * Connectivity + auth + version check. The version comes from `/api/v1/version`
 * (present on every NocoDB build). The workspace count is best-effort: on older
 * builds without the v3 workspace API it is reported as null rather than failing
 * the whole ping.
 */
export async function probeNocoDB(client: NocoDBClient, config: NocoDBConfig): Promise<PingResult> {
  const version = await client.request<{
    currentVersion: string;
    releaseVersion: string;
  }>('/api/v1/version');

  let accessibleWorkspaces: number | null = null;
  try {
    const workspaces = await client.request<{ list?: unknown[] }>('/meta/workspaces');
    accessibleWorkspaces = Array.isArray(workspaces?.list) ? workspaces.list.length : 0;
  } catch {
    // Older NocoDB (no /api/v3 workspace API) — keep ping green, just omit the count.
    accessibleWorkspaces = null;
  }

  return {
    ok: true,
    baseUrl: config.baseUrl,
    version: version.currentVersion,
    latestVersion: version.releaseVersion,
    upToDate: version.currentVersion === version.releaseVersion,
    accessibleWorkspaces,
  };
}
