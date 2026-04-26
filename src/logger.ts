import type { NocoDBConfig } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export class Logger {
  private threshold: number;

  constructor(level: NocoDBConfig['logLevel']) {
    this.threshold = LEVELS[level];
  }

  private write(level: keyof typeof LEVELS, msg: string, meta?: unknown): void {
    if (LEVELS[level] < this.threshold) return;
    const line = meta ? `[${level}] ${msg} ${JSON.stringify(meta)}` : `[${level}] ${msg}`;
    process.stderr.write(`${line}\n`);
  }

  debug(msg: string, meta?: unknown): void {
    this.write('debug', msg, meta);
  }
  info(msg: string, meta?: unknown): void {
    this.write('info', msg, meta);
  }
  warn(msg: string, meta?: unknown): void {
    this.write('warn', msg, meta);
  }
  error(msg: string, meta?: unknown): void {
    this.write('error', msg, meta);
  }
}
