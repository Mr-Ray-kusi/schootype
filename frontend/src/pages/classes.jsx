import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import {
  ConsoleHeader,
  ConsoleTabs,
  ConsoleEmpty,
  consoleFieldClass,
} from '../components/consoleUi';

const emptyClassRow = () => ({ name: '', capacity: '' });
const emptySubjectRow = () => ({ name: '' });

const Setup = () => {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classCount, setClassCount] = useState(1);
  const [classRows, setClassRows] = useState([emptyClassRow()]);
  const [subjectCount, setSubjectCount] = useState(1);
  const [subjectRows, setSubjectRows] = useState([emptySubjectRow()]);
  const [savingClasses, setSavingClasses] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [tab, setTab] = useState('classes');

  const load = async () => {
    try {
      const [classData, subjectData] = await Promise.all([
        cachedGet('classes', async () => (await axios.get('/api/classes')).data || []),
        cachedGet('subjects', async () => (await axios.get('/api/subjects')).data || []),
      ]);
      setClasses(classData);
      setSubjects(subjectData);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setClassRows((rows) => {
      const next = rows.slice(0, classCount);
      while (next.length < classCount) next.push(emptyClassRow());
      return next;
    });
  }, [classCount]);

  useEffect(() => {
    setSubjectRows((rows) => {
      const next = rows.slice(0, subjectCount);
      while (next.length < subjectCount) next.push(emptySubjectRow());
      return next;
    });
  }, [subjectCount]);

  const saveClasses = async (e) => {
    e.preventDefault();
    const toSave = classRows.filter((row) => row.name.trim());
    if (!toSave.length) {
      toast.error('Enter at least one class name');
      return;
    }
    setSavingClasses(true);
    try {
      for (const row of toSave) {
        await axios.post('/api/classes', {
          name: row.name.trim(),
          capacity: row.capacity || null,
        });
      }
      invalidateCache('classes');
      setClassRows([emptyClassRow()]);
      setClassCount(1);
      toast.success('Classes saved');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save classes');
    } finally {
      setSavingClasses(false);
    }
  };

  const saveSubjects = async (e) => {
    e.preventDefault();
    const toSave = subjectRows.filter((row) => row.name.trim());
    if (!toSave.length) {
      toast.error('Enter at least one subject name');
      return;
    }
    setSavingSubjects(true);
    try {
      for (const row of toSave) {
        await axios.post('/api/subjects', { name: row.name.trim() });
      }
      invalidateCache('subjects');
      setSubjectRows([emptySubjectRow()]);
      setSubjectCount(1);
      toast.success('Subjects saved');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save subjects');
    } finally {
      setSavingSubjects(false);
    }
  };

  const deleteClass = async (id) => {
    if (!window.confirm('Delete this class?')) return;
    try {
      await axios.delete(`/api/classes/${id}`);
      invalidateCache('classes');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete class');
    }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await axios.delete(`/api/subjects/${id}`);
      invalidateCache('subjects');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete subject');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-[#6b7280]">Loading setup…</div>;
  }

  return (
    <div className="space-y-6">
      <ConsoleHeader
        title="Setup"
        subtitle="Add only the classes and subjects your school uses. Student enrollment uses these names."
      />

      <ConsoleTabs
        tabs={[
          { id: 'classes', label: 'Classes' },
          { id: 'subjects', label: 'Subjects' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'classes' && (
        <div className="space-y-6">
          <form onSubmit={saveClasses} className="space-y-4 rounded-2xl border border-[#e6ebf4] bg-white p-5">
            <div className="max-w-xs">
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Number of classes</label>
              <input
                type="number"
                min="1"
                max="40"
                value={classCount}
                onChange={(e) => setClassCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                className={consoleFieldClass}
              />
            </div>

            <div className="space-y-3">
              {classRows.map((row, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#374151]">Class Name</label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => {
                        const next = [...classRows];
                        next[index] = { ...next[index], name: e.target.value };
                        setClassRows(next);
                      }}
                      className={consoleFieldClass}
                      placeholder="e.g. JHS 1A"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#374151]">Class Capacity</label>
                    <input
                      type="number"
                      min="1"
                      value={row.capacity}
                      onChange={(e) => {
                        const next = [...classRows];
                        next[index] = { ...next[index], capacity: e.target.value };
                        setClassRows(next);
                      }}
                      className={consoleFieldClass}
                      placeholder="e.g. 45"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={savingClasses}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f6eff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f58e0] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {savingClasses ? 'Saving…' : 'Add class'}
            </button>
          </form>

          {classes.length === 0 ? (
            <ConsoleEmpty title="No classes yet." text="Add class names above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="console-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Capacity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((item, index) => (
                    <tr key={item.id} className="console-row">
                      <td className="font-semibold">#{String(index + 1).padStart(2, '0')}</td>
                      <td className="font-medium">{item.name}</td>
                      <td className="console-muted">{item.capacity || 'Not set'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => deleteClass(item.id)}
                          className="rounded-full p-1.5 hover:bg-black/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="space-y-6">
          <form onSubmit={saveSubjects} className="space-y-4 rounded-2xl border border-[#e6ebf4] bg-white p-5">
            <div className="max-w-xs">
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Number of subjects</label>
              <input
                type="number"
                min="1"
                max="40"
                value={subjectCount}
                onChange={(e) => setSubjectCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                className={consoleFieldClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {subjectRows.map((row, index) => (
                <div key={index}>
                  <label className="mb-1.5 block text-sm font-medium text-[#374151]">Subject name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...subjectRows];
                      next[index] = { name: e.target.value };
                      setSubjectRows(next);
                    }}
                    className={consoleFieldClass}
                    placeholder="e.g. Mathematics"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={savingSubjects}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f6eff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f58e0] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {savingSubjects ? 'Saving…' : 'Add subjects'}
            </button>
          </form>

          {subjects.length === 0 ? (
            <ConsoleEmpty title="No subjects yet." text="Add subject names above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="console-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item, index) => (
                    <tr key={item.id} className="console-row">
                      <td className="font-semibold">#{String(index + 1).padStart(2, '0')}</td>
                      <td className="font-medium">{item.name}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => deleteSubject(item.id)}
                          className="rounded-full p-1.5 hover:bg-black/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Setup;
