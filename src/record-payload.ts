/**
 * Record write-payload shaping for the NocoDB data API.
 *
 * The v3 data API (`POST/PATCH /api/v3/data/{baseId}/{tableId}/records`) requires
 * every record's field map to be nested under a `fields` property and rejects
 * requests carrying more than 10 records. Older v1/v2 bulk endpoints instead take
 * a flat `{ FieldTitle: value }` object and allow much larger batches. These pure
 * helpers translate a flat field map into the shape the configured API version
 * expects, so the write tools stay backward-compatible.
 */

export type ApiVersion = 'v1' | 'v2' | 'v3';

/** The v3 data API rejects any write carrying more than this many records. */
export const V3_MAX_RECORDS_PER_REQUEST = 10;

/** Fallback batch size for pre-v3 bulk endpoints when the caller doesn't specify one. */
const DEFAULT_LEGACY_BATCH = 100;

/** Upper bound we're willing to send to a pre-v3 bulk endpoint in one request. */
const LEGACY_MAX_BATCH = 1000;

/**
 * Drop `null`, `undefined`, and empty-string entries from a field map.
 *
 * Sending `""` to a typed column (Number, Decimal, Date, DateTime, …) makes the
 * v3 API reject the whole request, so we omit the key entirely instead. Meaningful
 * falsy values (`0`, `false`) are preserved.
 */
export function stripEmptyFields(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

/** Write intent: insert has no id; update/upsert carry the record's primary key. */
export type WriteMode = 'insert' | 'update' | 'upsert';

/** Case-insensitive `id`/`Id` lookup — NocoDB's default primary-key column is `Id`. */
function extractRecordId(record: Record<string, unknown>): {
  id: unknown;
  rest: Record<string, unknown>;
} {
  let id: unknown;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (id === undefined && key.toLowerCase() === 'id') {
      id = value;
      continue;
    }
    rest[key] = value;
  }
  return { id, rest };
}

/**
 * Wrap a flat field map into the body shape the given API version expects.
 *
 * v3 insert → `{ fields: { ... } }`.
 * v3 update/upsert → `{ id, fields: { ... } }` (the record id is a sibling of
 *   `fields`, not a field itself). Upsert without an id falls back to insert shape.
 * v1/v2 → the flat map itself (legacy bulk endpoints keep the id inline).
 */
export function toRecordPayload(
  record: Record<string, unknown>,
  apiVersion: ApiVersion,
  mode: WriteMode = 'insert',
): unknown {
  if (apiVersion !== 'v3') return stripEmptyFields(record);

  if (mode === 'insert') {
    return { fields: stripEmptyFields(record) };
  }

  const { id, rest } = extractRecordId(record);
  const fields = stripEmptyFields(rest);
  // Upsert with no id behaves like an insert; update always carries the id.
  return id === undefined && mode === 'upsert' ? { fields } : { id, fields };
}

/**
 * Effective per-request batch size: honor the caller's request but never exceed
 * the version's hard cap (10 for v3). Always at least 1.
 */
export function effectiveBatchSize(apiVersion: ApiVersion, requested?: number): number {
  const hardCap = apiVersion === 'v3' ? V3_MAX_RECORDS_PER_REQUEST : LEGACY_MAX_BATCH;
  const desired =
    requested && requested > 0
      ? requested
      : apiVersion === 'v3'
        ? V3_MAX_RECORDS_PER_REQUEST
        : DEFAULT_LEGACY_BATCH;
  return Math.max(1, Math.min(desired, hardCap));
}

/**
 * Build the body for a bulk delete. v3 expects `{ id }` per record; v1/v2 bulk
 * delete used `{ Id }`. (Getting this wrong yields a 400 `Property 'id' is required`.)
 */
export function toDeletePayload(
  ids: Array<string | number>,
  apiVersion: ApiVersion,
): Array<Record<string, string | number>> {
  const key = apiVersion === 'v3' ? 'id' : 'Id';
  return ids.map((id) => ({ [key]: id }));
}

/** Split an array into consecutive chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  const step = Math.max(1, size);
  for (let i = 0; i < items.length; i += step) {
    batches.push(items.slice(i, i + step));
  }
  return batches;
}

/**
 * Normalize the many possible NocoDB write responses (a bare array,
 * `{ records: [...] }`, `{ list: [...] }`, or a single object) into a flat list
 * so batched inserts can be aggregated uniformly.
 */
export function collectWriteResult(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.records)) return obj.records;
    if (Array.isArray(obj.list)) return obj.list;
  }
  return res === undefined || res === null ? [] : [res];
}
