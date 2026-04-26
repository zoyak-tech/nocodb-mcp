import { z } from 'zod';

export const baseIdSchema = z
  .string()
  .min(1)
  .describe('NocoDB base (project) ID, e.g. "p1234567890abcd"');

export const tableIdSchema = z
  .string()
  .min(1)
  .describe('NocoDB table (model) ID, e.g. "m1234567890abcd"');

export const fieldIdSchema = z
  .string()
  .min(1)
  .describe('NocoDB field (column) ID, e.g. "c1234567890abcd"');

export const workspaceIdSchema = z
  .string()
  .min(1)
  .describe('NocoDB workspace ID, e.g. "w1234567890abcd"');

export const dryRunSchema = z
  .boolean()
  .optional()
  .describe(
    'When true, do not perform the operation. Return a preview of what WOULD have been affected. Use this to safely check destructive actions before committing.',
  );
