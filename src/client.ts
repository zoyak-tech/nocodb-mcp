import type { NocoDBConfig } from './config.js';

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

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, apiVersion = 'v3' } = options;

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
