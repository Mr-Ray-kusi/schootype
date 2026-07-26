import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Thin async wrapper around Node's built-in node:sqlite so local stores
 * keep await db.exec / db.run / db.get / db.all without native npm addons
 * like sqlite3 (prebuild-install) or better-sqlite3.
 *
 * Requires Node.js 22.5+ (tested on Node 24).
 */
export function openLocalDb(dbPath) {
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
