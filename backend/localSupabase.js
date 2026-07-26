import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { openLocalDb } from './localDb.js';
import { getDataDir } from './dataPaths.js';

const DEFAULT_DB_PATH = path.join(getDataDir(), 'local-supabase.db');

const TABLES = ['schools', 'students', 'staffs', 'nonstaffs', 'attendance', 'messages'];

const normalizeValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
};

const normalizeRecord = (record = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = normalizeValue(value);
  }
  if (!out.id) out.id = uuidv4();
  return out;
};

const pickColumns = (row, columns) => {
  if (!columns || columns === '*') return { ...row };
  const keys = columns
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const picked = {};
  for (const key of keys) {
    picked[key] = row[key] ?? null;
  }
  return picked;
};

class QueryBuilder {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this._action = 'select';
    this._columns = '*';
    this._countExact = false;
    this._filters = [];
    this._nullFilters = [];
    this._inFilters = [];
    this._order = null;
    this._limit = null;
    this._insertRows = null;
    this._updatePayload = null;
    this._wantSingle = false;
    this._wantMaybeSingle = false;
  }

  select(columns = '*', options = {}) {
    this._action = this._action === 'insert' || this._action === 'update' ? this._action : 'select';
    this._columns = columns || '*';
    this._countExact = options?.count === 'exact';
    return this;
  }

  insert(rows) {
    this._action = 'insert';
    this._insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(payload) {
    this._action = 'update';
    this._updatePayload = payload || {};
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  eq(column, value) {
    this._filters.push({ column, value: normalizeValue(value) });
    return this;
  }

  in(column, values = []) {
    this._inFilters.push({ column, values: (values || []).map(normalizeValue) });
    return this;
  }

  is(column, value) {
    this._nullFilters.push({ column, isNull: value === null });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this._order = { column, ascending };
    return this;
  }

  limit(count) {
    this._limit = Number(count);
    return this;
  }

  single() {
    this._wantSingle = true;
    this._wantMaybeSingle = false;
    return this;
  }

  maybeSingle() {
    this._wantMaybeSingle = true;
    this._wantSingle = false;
    return this;
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  async _readAll() {
    const rows = await this.db.all(`SELECT id, data FROM ${this.table}`);
    return rows.map((row) => {
      try {
        return JSON.parse(row.data);
      } catch {
        return { id: row.id };
      }
    });
  }

  _matches(row) {
    for (const filter of this._filters) {
      if (normalizeValue(row[filter.column]) !== filter.value) return false;
    }
    for (const filter of this._inFilters) {
      if (!filter.values.includes(normalizeValue(row[filter.column]))) return false;
    }
    for (const filter of this._nullFilters) {
      const isNull = row[filter.column] === null || row[filter.column] === undefined;
      if (filter.isNull !== isNull) return false;
    }
    return true;
  }

  _shapeResult(rows) {
    let resultRows = rows.map((row) => pickColumns(row, this._columns));

    if (this._order) {
      const { column, ascending } = this._order;
      resultRows.sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        if (av == null) return ascending ? -1 : 1;
        if (bv == null) return ascending ? 1 : -1;
        if (av > bv) return ascending ? 1 : -1;
        return ascending ? -1 : 1;
      });
    }

    if (this._limit != null) {
      resultRows = resultRows.slice(0, this._limit);
    }

    if (this._countExact) {
      return { data: resultRows, count: resultRows.length, error: null };
    }

    if (this._wantSingle) {
      if (resultRows.length === 0) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
      }
      if (resultRows.length > 1) {
        return { data: null, error: { message: 'Multiple rows returned', code: 'PGRST116' } };
      }
      return { data: resultRows[0], error: null };
    }

    if (this._wantMaybeSingle) {
      if (resultRows.length > 1) {
        return { data: null, error: { message: 'Multiple rows returned', code: 'PGRST116' } };
      }
      return { data: resultRows[0] || null, error: null };
    }

    return { data: resultRows, error: null };
  }

  async _execute() {
    try {
      if (this._action === 'insert') {
        const inserted = [];
        for (const raw of this._insertRows || []) {
          const record = normalizeRecord(raw);

          if (this.table === 'schools' && record.email) {
            const existing = await this.db.get(
              `SELECT id FROM ${this.table} WHERE lower(json_extract(data, '$.email')) = lower(?)`,
              [record.email]
            );
            if (existing) {
              return { data: null, error: { message: 'duplicate key value', code: '23505', duplicate: true } };
            }
          }

          await this.db.run(`INSERT INTO ${this.table} (id, data) VALUES (?, ?)`, [
            record.id,
            JSON.stringify(record),
          ]);
          inserted.push(record);
        }
        return this._shapeResult(inserted);
      }

      const allRows = await this._readAll();
      const matched = allRows.filter((row) => this._matches(row));

      if (this._action === 'update') {
        const updated = [];
        for (const row of matched) {
          const next = { ...row };
          for (const [key, value] of Object.entries(this._updatePayload || {})) {
            next[key] = normalizeValue(value);
          }
          await this.db.run(`UPDATE ${this.table} SET data = ? WHERE id = ?`, [
            JSON.stringify(next),
            next.id,
          ]);
          updated.push(next);
        }
        return this._shapeResult(updated);
      }

      if (this._action === 'delete') {
        for (const row of matched) {
          await this.db.run(`DELETE FROM ${this.table} WHERE id = ?`, [row.id]);
        }
        return { data: null, error: null };
      }

      return this._shapeResult(matched);
    } catch (error) {
      return { data: null, error: { message: error.message || String(error) } };
    }
  }
}

export async function createLocalSupabase(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = openLocalDb(dbPath);

  for (const table of TABLES) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);
  }

  console.log(`Using local SQLite database at ${dbPath}`);

  return {
    from(table) {
      if (!TABLES.includes(table)) {
        throw new Error(`Local DB table not supported: ${table}`);
      }
      return new QueryBuilder(db, table);
    },
  };
}
