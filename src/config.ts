import type { ApiVersion } from './record-payload.js';

export interface NocoDBConfig {
  baseUrl: string;
  apiToken: string;
  defaultBaseId?: string;
  timeoutMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /**
   * Data API version to target. Controls the record write shape:
   * v3 nests fields under `{ fields }` and caps batches at 10; v1/v2 use the
   * flat legacy shape. Defaults to 'v3' when unset.
   */
  apiVersion?: ApiVersion;
}

export function loadConfig(): NocoDBConfig {
  const baseUrl = process.env.NOCODB_BASE_URL;
  const apiToken = process.env.NOCODB_API_TOKEN;

  if (!baseUrl) {
    throw new Error('NOCODB_BASE_URL is required (e.g. https://data.example.com)');
  }
  if (!apiToken) {
    throw new Error('NOCODB_API_TOKEN is required (generate at NocoDB → Account → Tokens)');
  }

  const rawVersion = (process.env.NOCODB_API_VERSION || '').toLowerCase();
  const apiVersion: ApiVersion =
    rawVersion === 'v1' || rawVersion === 'v2' || rawVersion === 'v3'
      ? (rawVersion as ApiVersion)
      : 'v3';

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiToken,
    defaultBaseId: process.env.NOCODB_DEFAULT_BASE_ID || undefined,
    timeoutMs: Number(process.env.NOCODB_TIMEOUT_MS) || 30_000,
    logLevel: (process.env.NOCODB_LOG_LEVEL as NocoDBConfig['logLevel']) || 'info',
    apiVersion,
  };
}
