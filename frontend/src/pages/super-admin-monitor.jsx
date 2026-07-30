import React, { useEffect, useState } from 'react';
import Layout from '../components/layout';
import axios from 'axios';
import {
  Users,
  Briefcase,
  UserCog,
  ClipboardList,
  FileText,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'students', label: 'Students', Icon: Users },
  { id: 'staff', label: 'Staff', Icon: Briefcase },
  { id: 'non-staff', label: 'Non-staff', Icon: UserCog },
  { id: 'attendance', label: 'Attendance', Icon: ClipboardList },
  { id: 'report-cards', label: 'Report cards', Icon: FileText },
];

const SuperAdminMonitor = () => {
  const [tab, setTab] = useState('students');
  const [schoolId, setSchoolId] = useState('all');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schools, setSchools] = useState([]);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNote('');
      try {
        const params = { tab, schoolId };
        if (tab === 'attendance') params.date = date;
        const { data } = await axios.get('/api/super-admin/monitor', { params });
        setSchools(data.schools || []);
        setItems(data.items || []);
        setNote(data.note || '');
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.error || 'Failed to load monitoring data');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab, schoolId, date]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(q);
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">School monitoring</h1>
          <p className="mt-2 text-slate-300">
            Review students, staff, non-staff, attendance, and report cards across schools.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'bg-sky-500 text-white'
                  : 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">School</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100"
            >
              <option value="all">All schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          {tab === 'attendance' && (
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100"
              />
            </div>
          )}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search results…"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 py-2.5 pl-10 pr-4 text-slate-100"
            />
          </div>
        </div>

        {note ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {note}
          </p>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-slate-300">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No records found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400">
                {tab === 'students' && (
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">House</th>
                    <th className="px-4 py-3">Skills</th>
                  </tr>
                )}
                {tab === 'staff' && (
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Barcode</th>
                  </tr>
                )}
                {tab === 'non-staff' && (
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Barcode</th>
                  </tr>
                )}
                {tab === 'attendance' && (
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                )}
                {tab === 'report-cards' && (
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Uploaded</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-700/80 bg-slate-900/40 text-slate-100">
                {tab === 'students' &&
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.photo_url ? (
                            <img src={row.photo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : null}
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.class || '—'}</td>
                      <td className="px-4 py-3">
                        <div>{row.parent_phone || '—'}</div>
                        <div className="text-xs text-slate-400">{row.parent_email || ''}</div>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3">{row.house_address || '—'}</td>
                      <td className="max-w-[160px] truncate px-4 py-3">{row.skills || '—'}</td>
                    </tr>
                  ))}
                {tab === 'staff' &&
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.role || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.barcode || '—'}</td>
                    </tr>
                  ))}
                {tab === 'non-staff' &&
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.role || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.barcode || '—'}</td>
                    </tr>
                  ))}
                {tab === 'attendance' &&
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3">{row.user?.name || row.user_id}</td>
                      <td className="px-4 py-3 capitalize">{row.user_type}</td>
                      <td className="px-4 py-3">
                        {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                {tab === 'report-cards' &&
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3">{row.title || '—'}</td>
                      <td className="px-4 py-3">{row.teacher_name || '—'}</td>
                      <td className="px-4 py-3">{row.class_name || '—'}</td>
                      <td className="px-4 py-3">{row.status || '—'}</td>
                      <td className="px-4 py-3">
                        {row.uploaded_at ? new Date(row.uploaded_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-500">{filtered.length} record(s)</p>
      </div>
    </Layout>
  );
};

export default SuperAdminMonitor;
