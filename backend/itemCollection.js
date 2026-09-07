import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from './supabaseClient.js';
import { cacheGet, cacheSet, cacheInvalidate } from './ttlCache.js';

const TOKEN_CACHE_MS = 30 * 1000;
const SEARCH_LIMIT = 16;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_FAILS = 8;
const RATE_WINDOW_MS = 60 * 1000;

const memorySettings = new Map();
const memoryRecords = new Map();
const verifyFails = new Map();
const rateHits = new Map();

const PERSON_TABLE = {
  student: 'students',
  staff: 'staffs',
  'non-staff': 'nonstaffs',
};

const isMissingRelation = (error) => {
  const msg = String(error?.message || error?.details || error?.hint || '');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /schema cache|could not find the table|does not exist|relation/i.test(msg)
  );
};

const normalizeType = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'student' || raw === 'students') return 'student';
  if (raw === 'staff' || raw === 'staffs') return 'staff';
  if (raw === 'non-staff' || raw === 'nonstaff' || raw === 'nonstaffs') return 'non-staff';
  return '';
};

const normalizeUnitCode = (value) => String(value || '').trim();

const isValidUnitCode = (value) => {
  const code = normalizeUnitCode(value);
  return code.length >= 4 && code.length <= 24 && /^[A-Za-z0-9@#._-]+$/.test(code);
};

const createToken = () => randomBytes(24).toString('hex');

const generateUnitCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

const rateLimited = (bucket, key, max) => {
  const now = Date.now();
  const stamp = `${bucket}:${key}`;
  const hits = (rateHits.get(stamp) || []).filter((at) => now - at < RATE_WINDOW_MS);
  if (hits.length >= max) {
    rateHits.set(stamp, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(stamp, hits);
  return false;
};

const noteVerifyFail = (key) => {
  const now = Date.now();
  const hits = (verifyFails.get(key) || []).filter((at) => now - at < VERIFY_WINDOW_MS);
  hits.push(now);
  verifyFails.set(key, hits);
  return hits.length;
};

const verifyLocked = (key) => {
  const now = Date.now();
  const hits = (verifyFails.get(key) || []).filter((at) => now - at < VERIFY_WINDOW_MS);
  verifyFails.set(key, hits);
  return hits.length >= VERIFY_MAX_FAILS;
};

const publicRecord = (row) => ({
  id: row.id,
  person_type: row.person_type,
  person_id: row.person_id,
  person_name: row.person_name,
  person_label: row.person_label || '',
  collected_at: row.collected_at,
});

const memoryGetSettings = (schoolId) => memorySettings.get(schoolId) || null;

const memorySaveSettings = (schoolId, next) => {
  memorySettings.set(schoolId, next);
  return next;
};

const memoryListRecords = (schoolId) => {
  const rows = memoryRecords.get(schoolId) || [];
  return [...rows].sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at)));
};

async function loadSettingsBySchool(schoolId) {
  const cached = cacheGet(`col-set:${schoolId}`);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('item_collection_settings')
    .select('school_id, collection_token, unit_code_hash, updated_at')
    .eq('school_id', schoolId)
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    const local = memoryGetSettings(schoolId);
    if (local) cacheSet(`col-set:${schoolId}`, local, TOKEN_CACHE_MS);
    return local;
  }
  if (error) throw error;

  if (data) {
    cacheSet(`col-set:${schoolId}`, data, TOKEN_CACHE_MS);
    cacheSet(`col-tok:${data.collection_token}`, data, TOKEN_CACHE_MS);
  }
  return data || null;
}

async function loadSettingsByToken(token) {
  if (!token) return null;
  const cached = cacheGet(`col-tok:${token}`);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('item_collection_settings')
    .select('school_id, collection_token, unit_code_hash, updated_at')
    .eq('collection_token', token)
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    for (const row of memorySettings.values()) {
      if (row.collection_token === token) {
        cacheSet(`col-tok:${token}`, row, TOKEN_CACHE_MS);
        return row;
      }
    }
    return null;
  }
  if (error) throw error;
  if (data) {
    cacheSet(`col-tok:${token}`, data, TOKEN_CACHE_MS);
    cacheSet(`col-set:${data.school_id}`, data, TOKEN_CACHE_MS);
  }
  return data || null;
}

function dropSettingsCache(schoolId, token) {
  if (schoolId) cacheInvalidate(`col-set:${schoolId}`);
  if (token) cacheInvalidate(`col-tok:${token}`);
}

async function upsertSettings(schoolId, { collection_token, unit_code_hash }) {
  const existing = await loadSettingsBySchool(schoolId);
  const next = {
    school_id: schoolId,
    collection_token: collection_token || existing?.collection_token || createToken(),
    unit_code_hash: unit_code_hash !== undefined ? unit_code_hash : existing?.unit_code_hash || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('item_collection_settings')
    .upsert(next, { onConflict: 'school_id' })
    .select('school_id, collection_token, unit_code_hash, updated_at')
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    dropSettingsCache(schoolId, existing?.collection_token);
    dropSettingsCache(schoolId, next.collection_token);
    return memorySaveSettings(schoolId, next);
  }
  if (error) throw error;

  dropSettingsCache(schoolId, existing?.collection_token);
  dropSettingsCache(schoolId, next.collection_token);
  const saved = data || next;
  cacheSet(`col-set:${schoolId}`, saved, TOKEN_CACHE_MS);
  cacheSet(`col-tok:${saved.collection_token}`, saved, TOKEN_CACHE_MS);
  return saved;
}

export async function ensureCollectionSettings(schoolId) {
  const existing = await loadSettingsBySchool(schoolId);
  if (existing?.collection_token) return existing;
  return upsertSettings(schoolId, { collection_token: createToken() });
}

async function loadSchoolName(schoolId) {
  const cached = cacheGet(`col-name:${schoolId}`);
  if (cached) return cached;
  const { data, error } = await supabase.from('schools').select('id, name').eq('id', schoolId).maybeSingle();
  if (error) throw error;
  const name = data?.name || 'School';
  cacheSet(`col-name:${schoolId}`, name, 60 * 1000);
  return name;
}

async function listRecords(schoolId, { q = '', limit = 80 } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('item_collections')
    .select('id, school_id, person_type, person_id, person_name, person_label, collected_at')
    .eq('school_id', schoolId)
    .order('collected_at', { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));

  if (error && isMissingRelation(error)) {
    const rows = memoryListRecords(schoolId);
    return needle
      ? rows.filter((row) =>
          `${row.person_name} ${row.person_label}`.toLowerCase().includes(needle)
        )
      : rows;
  }
  if (error) throw error;
  const rows = data || [];
  if (!needle) return rows;
  return rows.filter((row) => `${row.person_name} ${row.person_label}`.toLowerCase().includes(needle));
}

async function findCollectedIds(schoolId, people) {
  if (!people.length) return new Set();
  const { data, error } = await supabase
    .from('item_collections')
    .select('person_type, person_id')
    .eq('school_id', schoolId)
    .in(
      'person_id',
      people.map((p) => p.id)
    );

  if (error && isMissingRelation(error)) {
    const rows = memoryListRecords(schoolId);
    return new Set(rows.map((row) => `${row.person_type}:${row.person_id}`));
  }
  if (error) throw error;
  return new Set((data || []).map((row) => `${row.person_type}:${row.person_id}`));
}

async function searchPeople(schoolId, q) {
  const safe = String(q || '').replace(/[%*,]/g, '').trim();
  if (safe.length < 2) return [];

  const filter = `name.ilike.%${safe}%`;
  const [students, staff, nonStaff] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, class')
      .eq('school_id', schoolId)
      .or(`name.ilike.%${safe}%,roll_number.ilike.%${safe}%`)
      .limit(SEARCH_LIMIT),
    supabase.from('staffs').select('id, name, role').eq('school_id', schoolId).or(filter).limit(8),
    supabase.from('nonstaffs').select('id, name, role').eq('school_id', schoolId).or(filter).limit(8),
  ]);

  if (students.error) throw students.error;
  if (staff.error) throw staff.error;
  if (nonStaff.error) throw nonStaff.error;

  const people = [
    ...(students.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      label: row.class || 'Student',
      person_type: 'student',
    })),
    ...(staff.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      label: row.role || 'Staff',
      person_type: 'staff',
    })),
    ...(nonStaff.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      label: row.role || 'Non-staff',
      person_type: 'non-staff',
    })),
  ].slice(0, SEARCH_LIMIT);

  const collected = await findCollectedIds(schoolId, people);
  return people.map((person) => ({
    ...person,
    collected: collected.has(`${person.person_type}:${person.id}`),
  }));
}

async function findPerson(schoolId, personType, personId) {
  const table = PERSON_TABLE[personType];
  if (!table || !personId) return null;
  const columns = personType === 'student' ? 'id, name, class' : 'id, name, role';
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('id', personId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    label: personType === 'student' ? data.class || 'Student' : data.role || (personType === 'staff' ? 'Staff' : 'Non-staff'),
    person_type: personType,
  };
}

async function insertCollection(schoolId, person) {
  const row = {
    id: randomUUID(),
    school_id: schoolId,
    person_type: person.person_type,
    person_id: person.id,
    person_name: person.name,
    person_label: person.label || '',
    collected_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('item_collections')
    .insert([
      {
        school_id: schoolId,
        person_type: person.person_type,
        person_id: person.id,
        person_name: person.name,
        person_label: person.label || '',
      },
    ])
    .select('id, school_id, person_type, person_id, person_name, person_label, collected_at')
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    const existing = memoryListRecords(schoolId);
    if (existing.some((item) => item.person_type === person.person_type && item.person_id === person.id)) {
      const err = new Error('This person has already collected.');
      err.status = 409;
      throw err;
    }
    const list = memoryRecords.get(schoolId) || [];
    list.unshift(row);
    memoryRecords.set(schoolId, list);
    return row;
  }

  if (error) {
    if (error.code === '23505') {
      const err = new Error('This person has already collected.');
      err.status = 409;
      throw err;
    }
    throw error;
  }

  return data || row;
}

const clientKey = (req, suffix) =>
  `${req.ip || req.headers['x-forwarded-for'] || 'ip'}:${suffix}`;

export function registerItemCollectionRoutes(app, { authenticateToken, enforcePlanApproval }) {
  app.get('/api/collection/settings', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      if (req.user.role === 'super_admin') {
        return res.status(403).json({ error: 'Collection is managed by each school admin.' });
      }
      const settings = await ensureCollectionSettings(req.user.schoolId);
      const records = await listRecords(req.user.schoolId, { limit: 80 });
      res.json({
        token: settings.collection_token,
        has_unit_code: Boolean(settings.unit_code_hash),
        records: records.map(publicRecord),
        total_collected: records.length,
      });
    } catch (error) {
      console.error('Collection settings error:', error);
      res.status(500).json({ error: error.message || 'Failed to load collection settings' });
    }
  });

  app.post('/api/collection/unit-code', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      if (req.user.role === 'super_admin') {
        return res.status(403).json({ error: 'Collection is managed by each school admin.' });
      }
      const generate = Boolean(req.body?.generate);
      const raw = generate ? generateUnitCode() : normalizeUnitCode(req.body?.unit_code);
      if (!isValidUnitCode(raw)) {
        return res.status(400).json({
          error: 'Unit code must be 4–24 letters or numbers. Share it only with hall/SRC admin and assistants.',
        });
      }
      const hash = await bcrypt.hash(raw, 10);
      const settings = await ensureCollectionSettings(req.user.schoolId);
      await upsertSettings(req.user.schoolId, {
        collection_token: settings.collection_token,
        unit_code_hash: hash,
      });
      res.json({
        has_unit_code: true,
        unit_code: raw,
        token: settings.collection_token,
      });
    } catch (error) {
      console.error('Set collection unit code error:', error);
      res.status(500).json({ error: error.message || 'Failed to save unit code' });
    }
  });

  app.post('/api/collection/regenerate', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      if (req.user.role === 'super_admin') {
        return res.status(403).json({ error: 'Collection is managed by each school admin.' });
      }
      const existing = await ensureCollectionSettings(req.user.schoolId);
      const settings = await upsertSettings(req.user.schoolId, {
        collection_token: createToken(),
        unit_code_hash: existing.unit_code_hash || null,
      });
      res.json({ token: settings.collection_token, has_unit_code: Boolean(settings.unit_code_hash) });
    } catch (error) {
      console.error('Regenerate collection link error:', error);
      res.status(500).json({ error: error.message || 'Failed to regenerate collection QR' });
    }
  });

  app.get('/api/collection/records', authenticateToken, enforcePlanApproval, async (req, res) => {
    try {
      if (req.user.role === 'super_admin') {
        return res.status(403).json({ error: 'Collection is managed by each school admin.' });
      }
      const records = await listRecords(req.user.schoolId, { q: req.query.q, limit: 200 });
      res.json({ items: records.map(publicRecord), total: records.length });
    } catch (error) {
      console.error('Collection records error:', error);
      res.status(500).json({ error: error.message || 'Failed to load collections' });
    }
  });

  app.get('/api/public/collection/:token', async (req, res) => {
    try {
      const settings = await loadSettingsByToken(String(req.params.token || '').trim());
      if (!settings) return res.status(404).json({ error: 'Invalid or inactive collection QR' });
      const school_name = await loadSchoolName(settings.school_id);
      res.set('Cache-Control', 'public, max-age=15');
      res.json({
        school_name,
        has_unit_code: Boolean(settings.unit_code_hash),
      });
    } catch (error) {
      console.error('Public collection info error:', error);
      res.status(500).json({ error: 'Could not open collection' });
    }
  });

  app.get('/api/public/collection/:token/search', async (req, res) => {
    try {
      if (rateLimited('search', clientKey(req, req.params.token), 40)) {
        return res.status(429).json({ error: 'Too many searches. Wait a moment.' });
      }
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ items: [] });
      const settings = await loadSettingsByToken(String(req.params.token || '').trim());
      if (!settings) return res.status(404).json({ error: 'Invalid or inactive collection QR' });
      const items = await searchPeople(settings.school_id, q);
      res.set('Cache-Control', 'no-store');
      res.json({ items });
    } catch (error) {
      console.error('Public collection search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.post('/api/public/collection/:token/verify', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      const failKey = clientKey(req, token);
      if (rateLimited('verify', failKey, 20)) {
        return res.status(429).json({ error: 'Too many attempts. Wait a moment.' });
      }
      if (verifyLocked(failKey)) {
        return res.status(429).json({ error: 'Too many wrong unit codes. Ask the hall/SRC admin.' });
      }

      const settings = await loadSettingsByToken(token);
      if (!settings) return res.status(404).json({ error: 'Invalid or inactive collection QR' });
      if (!settings.unit_code_hash) {
        return res.status(400).json({ error: 'Collection is not ready. Ask the hall/SRC admin to set the unit code.' });
      }

      const personType = normalizeType(req.body?.person_type);
      const personId = String(req.body?.person_id || '').trim();
      const unitCode = normalizeUnitCode(req.body?.unit_code);
      if (!personType || !personId) {
        return res.status(400).json({ error: 'Select a name before verifying.' });
      }
      if (!isValidUnitCode(unitCode)) {
        return res.status(400).json({ error: 'Enter the unit code to complete verification.' });
      }

      const matches = await bcrypt.compare(unitCode, settings.unit_code_hash);
      if (!matches) {
        const fails = noteVerifyFail(failKey);
        return res.status(403).json({
          error:
            fails >= VERIFY_MAX_FAILS
              ? 'Too many wrong unit codes. Ask the hall/SRC admin.'
              : 'Wrong unit code. Ask a hall/SRC assistant.',
        });
      }

      const person = await findPerson(settings.school_id, personType, personId);
      if (!person) return res.status(404).json({ error: 'Name not found for this school.' });

      const record = await insertCollection(settings.school_id, person);
      res.json({
        ok: true,
        message: `Verified — ${person.name} can collect.`,
        record: publicRecord(record),
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('Public collection verify error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });
}
