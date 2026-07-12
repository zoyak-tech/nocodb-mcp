import { readFileSync } from 'node:fs';

/**
 * Server version, read from package.json at runtime so it always matches the
 * published package — no hardcoded string to drift out of sync (which is how
 * 1.0.6 shipped still announcing itself as "1.0.5").
 *
 * `../package.json` resolves relative to this module: `src/version.ts` in dev
 * and `dist/version.js` in the published tarball both sit one level below the
 * package root, where package.json lives.
 */
function readVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const SERVER_VERSION = readVersion();
