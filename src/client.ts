import type { NocoDBConfig } from './config.js';
import {
  type ApiVersion,
  chunk,
  collectWriteResult,
  effectiveBatchSize,
  toRecordPayload,
  type WriteMode,
} from './record-payload.js';

export class NocoDBError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'NocoDBError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  apiVersion?: 'v1' | 'v2' | 'v3';
}

export class NocoDBClient {
  constructor(private readonly config: NocoDBConfig) {}

  /** Configured data API version (defaults to v3 when unset). */
  get apiVersion(): ApiVersion {
    return this.config.apiVersion ?? 'v3';
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, apiVersion = this.apiVersion } = options;

    const url = this.buildUrl(path, apiVersion, query);
    const headers: Record<string, string> = {
      'xc-token': this.config.apiToken,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      const parsed = text ? safeJsonParse(text) : null;

      if (!res.ok) {
        throw new NocoDBError(
          `NocoDB ${method} ${path} failed: ${res.status} ${res.statusText}`,
          res.status,
          parsed ?? text,
        );
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof NocoDBError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NocoDBError(
          `NocoDB ${method} ${path} timed out after ${this.config.timeoutMs}ms`,
          0,
          null,
        );
      }
      throw new NocoDBError(
        `NocoDB ${method} ${path} network error: ${(err as Error).message}`,
        0,
        null,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Insert or update records against a data-API records endpoint, shaping the
   * body for the configured API version and honoring its per-request record cap.
   *
   * For v3, records are shaped for the write intent (insert → `{ fields }`,
   * update/upsert → `{ id, fields }`) and requests are chunked to at most 10
   * records (the v3 hard limit); results are aggregated across batches. For
   * v1/v2 the flat legacy shape is used. `mode` defaults from `method`
   * (POST → insert, PATCH → update).
   */
  async writeRecords(
    path: string,
    records: Array<Record<string, unknown>>,
    options: { method?: 'POST' | 'PATCH'; mode?: WriteMode; batchSize?: number } = {},
  ): Promise<{ records: unknown[]; count: number; batches: number }> {
    const method = options.method ?? 'POST';
    const mode = options.mode ?? (method === 'PATCH' ? 'update' : 'insert');
    const version = this.apiVersion;
    const size = effectiveBatchSize(version, options.batchSize);
    const groups = chunk(records, size);

    const collected: unknown[] = [];
    for (const group of groups) {
      const body = group.map((r) => toRecordPayload(r, version, mode));
      const res = await this.request(path, { method, body, apiVersion: version });
      collected.push(...collectWriteResult(res));
    }

    return { records: collected, count: records.length, batches: groups.length };
  }

  private buildUrl(
    path: string,
    apiVersion: 'v1' | 'v2' | 'v3',
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = cleanPath.startsWith('/api/') ? cleanPath : `/api/${apiVersion}${cleanPath}`;
    const url = new URL(`${this.config.baseUrl}${fullPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
