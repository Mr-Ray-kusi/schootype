import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

let dbPromise = null;

/** Shared SQLite connection used by school extras, fees, and Paystack ledgers. */
export async function getLocalDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec('PRAGMA journal_mode = WAL');
      return db;
    });
  }
  return dbPromise;
}

export { DB_PATH, DATA_DIR };
