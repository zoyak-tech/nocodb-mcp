import { describe, expect, it } from 'vitest';
import {
  chunk,
  collectWriteResult,
  effectiveBatchSize,
  stripEmptyFields,
  toDeletePayload,
  toRecordPayload,
  V3_MAX_RECORDS_PER_REQUEST,
} from '../src/record-payload.js';

describe('stripEmptyFields', () => {
  it('drops null, undefined, and empty-string values', () => {
    expect(stripEmptyFields({ a: 'x', b: null, c: undefined, d: '' })).toEqual({ a: 'x' });
  });

  it('keeps meaningful falsy values (0, false)', () => {
    expect(stripEmptyFields({ n: 0, b: false })).toEqual({ n: 0, b: false });
  });
});

describe('toRecordPayload', () => {
  it('wraps v3 inserts under a fields property', () => {
    expect(toRecordPayload({ Title: 'seo', Volume: 10 }, 'v3')).toEqual({
      fields: { Title: 'seo', Volume: 10 },
    });
  });

  it('omits empty typed values instead of sending "" (the 400 trigger)', () => {
    // Volume is a Number column: "" would make v3 reject the whole request.
    expect(toRecordPayload({ Title: 'seo', Volume: '' }, 'v3')).toEqual({
      fields: { Title: 'seo' },
    });
  });

  it('separates the record id from fields on v3 update', () => {
    expect(toRecordPayload({ Id: 5, Title: 'new' }, 'v3', 'update')).toEqual({
      id: 5,
      fields: { Title: 'new' },
    });
  });

  it('matches the id key case-insensitively on update', () => {
    expect(toRecordPayload({ id: 'rec_1', Title: 'x' }, 'v3', 'update')).toEqual({
      id: 'rec_1',
      fields: { Title: 'x' },
    });
  });

  it('upsert without an id falls back to insert shape', () => {
    expect(toRecordPayload({ Title: 'x' }, 'v3', 'upsert')).toEqual({ fields: { Title: 'x' } });
  });

  it('upsert with an id uses update shape', () => {
    expect(toRecordPayload({ Id: 9, Title: 'x' }, 'v3', 'upsert')).toEqual({
      id: 9,
      fields: { Title: 'x' },
    });
  });

  it('uses the flat legacy shape for v1/v2 (backward compat)', () => {
    expect(toRecordPayload({ Title: 'x', Volume: 3 }, 'v2')).toEqual({ Title: 'x', Volume: 3 });
  });
});

describe('toDeletePayload', () => {
  it('uses lowercase id for v3 (avoids 400 "Property id is required")', () => {
    expect(toDeletePayload([1, 2], 'v3')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('uses Id for legacy v1/v2', () => {
    expect(toDeletePayload(['a'], 'v2')).toEqual([{ Id: 'a' }]);
  });
});

describe('effectiveBatchSize', () => {
  it('caps v3 at 10 even when a larger batch is requested', () => {
    expect(effectiveBatchSize('v3', 100)).toBe(V3_MAX_RECORDS_PER_REQUEST);
    expect(effectiveBatchSize('v3')).toBe(V3_MAX_RECORDS_PER_REQUEST);
    expect(effectiveBatchSize('v3', 5)).toBe(5);
  });

  it('allows larger batches on legacy versions', () => {
    expect(effectiveBatchSize('v2')).toBe(100);
    expect(effectiveBatchSize('v2', 500)).toBe(500);
    expect(effectiveBatchSize('v2', 5000)).toBe(1000);
  });

  it('never returns less than 1', () => {
    expect(effectiveBatchSize('v3', 0)).toBe(V3_MAX_RECORDS_PER_REQUEST);
    expect(effectiveBatchSize('v3', -3)).toBe(V3_MAX_RECORDS_PER_REQUEST);
  });
});

describe('chunk', () => {
  it('splits into batches of at most size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single batch when smaller than size', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('handles an empty array', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe('collectWriteResult', () => {
  it('passes through a bare array', () => {
    expect(collectWriteResult([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('unwraps { records: [...] }', () => {
    expect(collectWriteResult({ records: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });

  it('unwraps { list: [...] }', () => {
    expect(collectWriteResult({ list: [{ id: 2 }] })).toEqual([{ id: 2 }]);
  });

  it('wraps a single object', () => {
    expect(collectWriteResult({ id: 3 })).toEqual([{ id: 3 }]);
  });

  it('returns [] for null/undefined', () => {
    expect(collectWriteResult(null)).toEqual([]);
    expect(collectWriteResult(undefined)).toEqual([]);
  });
});
