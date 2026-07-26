import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Thin async wrapper around Node's built-in node:sqlite so local stores
 * keep await db.exec / db.run / db.get / db.all without native npm addons.
 *
 * On Vercel (and any host without node:sqlite), callers should skip this and
 * use in-memory fallbacks — requiring node:sqlite at module load crashes the
 * whole serverless function.
 */
export function openLocalDb(dbPath) {
  if (process.env.VERCEL) {
    throw new Error('Local SQLite is not available on Vercel; use in-memory store fallbacks');
  }

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (err) {
    throw new Error(`node:sqlite unavailable: ${err.message}`);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA journal_mode = WAL');
  } catch {
    // ignore pragma failures on some builds
  }

  const normalizeParams = (params) => {
    if (params === undefined || params === null) return [];
    return Array.isArray(params) ? params : [params];
  };

  return {
    exec(sql) {
      db.exec(sql);
      return Promise.resolve();
    },
    run(sql, params) {
      const info = db.prepare(sql).run(...normalizeParams(params));
      return Promise.resolve({
        changes: info.changes,
        lastID: Number(info.lastInsertRowid),
        lastInsertRowid: info.lastInsertRowid,
      });
    },
    get(sql, params) {
      return Promise.resolve(db.prepare(sql).get(...normalizeParams(params)));
    },
    all(sql, params) {
      return Promise.resolve(db.prepare(sql).all(...normalizeParams(params)));
    },
    close() {
      db.close();
      return Promise.resolve();
    },
  };
}
