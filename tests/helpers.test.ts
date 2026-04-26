import { describe, expect, it } from 'vitest';
import { NocoDBError } from '../src/client.js';
import { dryRunPreview, fail, ok, tryTool } from '../src/tools/helpers.js';

describe('helpers', () => {
  describe('ok()', () => {
    it('wraps data as text content with pretty JSON', () => {
      const r = ok({ a: 1 });
      expect(r.isError).toBeUndefined();
      expect(r.content[0].type).toBe('text');
      expect(JSON.parse(r.content[0].text)).toEqual({ a: 1 });
    });
  });

  describe('fail()', () => {
    it('marks isError and includes context', () => {
      const r = fail(new Error('boom'), 'my_tool');
      expect(r.isError).toBe(true);
      const body = JSON.parse(r.content[0].text);
      expect(body.ok).toBe(false);
      expect(body.context).toBe('my_tool');
      expect(body.error).toBe('boom');
    });

    it('exposes status + body for NocoDBError', () => {
      const err = new NocoDBError('not found', 404, { error: 'NF' });
      const r = fail(err, 'get_base');
      const body = JSON.parse(r.content[0].text);
      expect(body.status).toBe(404);
      expect(body.details).toEqual({ error: 'NF' });
    });

    it('handles non-Error values', () => {
      const r = fail('string error');
      const body = JSON.parse(r.content[0].text);
      expect(body.error).toBe('string error');
    });
  });

  describe('tryTool()', () => {
    it('returns ok() on success', async () => {
      const r = await tryTool(async () => ({ x: 1 }));
      expect(r.isError).toBeUndefined();
      expect(JSON.parse(r.content[0].text)).toEqual({ x: 1 });
    });

    it('returns fail() on throw', async () => {
      const r = await tryTool(async () => {
        throw new Error('oops');
      }, 'my_tool');
      expect(r.isError).toBe(true);
      const body = JSON.parse(r.content[0].text);
      expect(body.error).toBe('oops');
      expect(body.context).toBe('my_tool');
    });
  });

  describe('dryRunPreview()', () => {
    it('returns a non-error preview with the planned action', () => {
      const r = dryRunPreview('delete_base', { base_id: 'p123' });
      expect(r.isError).toBeUndefined();
      const body = JSON.parse(r.content[0].text);
      expect(body.dryRun).toBe(true);
      expect(body.action).toBe('delete_base');
      expect(body.wouldAffect).toEqual({ base_id: 'p123' });
      expect(body.note).toMatch(/No changes were made/);
    });
  });
});
