import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_PATH = path.join(__dirname, 'data', 'person-photos.json');

const photoKey = (schoolId, type, personId) => `${schoolId}:${type}:${personId}`;

const loadAll = () => {
  try {
    if (fs.existsSync(PHOTO_PATH)) {
      return JSON.parse(fs.readFileSync(PHOTO_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not load person photos:', err.message);
  }
  return {};
};

const saveAll = (data) => {
  fs.mkdirSync(path.dirname(PHOTO_PATH), { recursive: true });
  fs.writeFileSync(PHOTO_PATH, JSON.stringify(data, null, 2));
};

export const setPersonPhoto = (schoolId, type, personId, photoUrl) => {
  const all = loadAll();
  const key = photoKey(schoolId, type, personId);
  if (photoUrl) {
    all[key] = photoUrl;
  } else {
    delete all[key];
  }
  saveAll(all);
};

export const getPersonPhoto = (schoolId, type, personId) => {
  const all = loadAll();
  return all[photoKey(schoolId, type, personId)] || null;
};

export const attachPhotoToRecord = (schoolId, type, record) => {
  if (!record) return record;
  const photoUrl = record.photo_url || getPersonPhoto(schoolId, type, record.id) || null;
  return { ...record, photoUrl };
};

export const attachPhotosToRecords = (schoolId, type, records) => {
  return (records || []).map((record) => attachPhotoToRecord(schoolId, type, record));
};

export const deletePersonPhoto = (schoolId, type, personId) => {
  setPersonPhoto(schoolId, type, personId, null);
};
