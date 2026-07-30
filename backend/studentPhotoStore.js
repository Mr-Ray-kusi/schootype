import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school-extras.db');

let dbPromise = null;
const cache = new Map();

async function getDb() {
  if (!dbPromise) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS person_photos (
          person_id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL,
          photo_url TEXT NOT NULL
        )
      `);
      await db.exec(
        'CREATE INDEX IF NOT EXISTS idx_person_photos_school ON person_photos(school_id)'
      );

      // Migrate legacy student_photos table if present
      try {
        await db.exec(`
          INSERT OR IGNORE INTO person_photos (person_id, school_id, photo_url)
          SELECT student_id, school_id, photo_url FROM student_photos
        `);
      } catch {
        // student_photos table may not exist
      }

      return db;
    });
  }
  return dbPromise;
}

export async function initPersonPhotoStore() {
  const db = await getDb();
  const rows = await db.all('SELECT person_id, school_id, photo_url FROM person_photos');
  cache.clear();
  rows.forEach((row) => cache.set(row.person_id, row));
}

export const initStudentPhotoStore = initPersonPhotoStore;

export function getPersonPhotoSync(personId) {
  return cache.get(personId)?.photo_url || null;
}

export const getStudentPhotoSync = getPersonPhotoSync;

export async function setPersonPhoto(personId, schoolId, photoUrl) {
  if (!personId || !schoolId || !photoUrl) return;

  const db = await getDb();
  await db.run(
    `INSERT INTO person_photos (person_id, school_id, photo_url)
     VALUES (?, ?, ?)
     ON CONFLICT(person_id) DO UPDATE SET
       school_id = excluded.school_id,
       photo_url = excluded.photo_url`,
    [personId, schoolId, photoUrl]
  );
  cache.set(personId, { person_id: personId, school_id: schoolId, photo_url: photoUrl });
}

export const setStudentPhoto = setPersonPhoto;

export async function deletePersonPhoto(personId) {
  if (!personId) return;

  const db = await getDb();
  await db.run('DELETE FROM person_photos WHERE person_id = ?', [personId]);
  cache.delete(personId);
}

export const deleteStudentPhoto = deletePersonPhoto;

export function mergePersonPhoto(record) {
  if (!record?.id) return record;

  const localPhoto = getPersonPhotoSync(record.id);
  if (localPhoto) {
    return { ...record, photo_url: localPhoto };
  }
  return record;
}

export const mergeStudentPhoto = mergePersonPhoto;

export function mergePersonPhotos(records) {
  return (records || []).map(mergePersonPhoto);
}

export const mergeStudentPhotos = mergePersonPhotos;
