import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, BookOpen, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { invalidateCache, peekCache, staleGet } from '../utils/requestCache';

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30';

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

  const load = async () => {
    const apply = ([classData, subjectData]) => {
      setClasses(classData);
      setSubjects(subjectData);
    };
    const cachedClasses = peekCache('classes');
    const cachedSubjects = peekCache('subjects');
    if (cachedClasses || cachedSubjects) {
      apply([cachedClasses || [], cachedSubjects || []]);
      setLoading(false);
    }
    try {
      const [classData, subjectData] = await Promise.all([
        staleGet('classes', async () => (await axios.get('/api/classes')).data || [], 45000),
        staleGet('subjects', async () => (await axios.get('/api/subjects')).data || [], 45000),
      ]);
      apply([classData, subjectData]);
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

  if (loading && classes.length === 0 && subjects.length === 0) {
    return <div className="py-12 text-center text-slate-300">Loading setup…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">Academic</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Setup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add only the classes and subjects your school uses. Student enrollment uses these names.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-white">Classes</h2>
        </div>

        <form onSubmit={saveClasses} className="space-y-4">
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Number of classes</label>
            <input
              type="number"
              min="1"
              max="40"
              value={classCount}
              onChange={(e) => setClassCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              className={fieldClass}
            />
          </div>

          <div className="space-y-3">
            {classRows.map((row, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-200">Class Name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...classRows];
                      next[index] = { ...next[index], name: e.target.value };
                      setClassRows(next);
                    }}
                    className={fieldClass}
                    placeholder="e.g. JHS 1A"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-200">Class Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={row.capacity}
                    onChange={(e) => {
                      const next = [...classRows];
                      next[index] = { ...next[index], capacity: e.target.value };
                      setClassRows(next);
                    }}
                    className={fieldClass}
                    placeholder="e.g. 45"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={savingClasses}
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {savingClasses ? 'Saving…' : 'Add class'}
          </button>
        </form>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((item) => (
            <div key={item.id} className="flex items-start justify-between rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
              <div>
                <p className="font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Capacity: {item.capacity || 'Not set'}
                </p>
              </div>
              <button type="button" onClick={() => deleteClass(item.id)} className="p-1 text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {classes.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">No classes yet. Add class names above.</p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Subjects</h2>
        </div>

        <form onSubmit={saveSubjects} className="space-y-4">
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Number of subjects</label>
            <input
              type="number"
              min="1"
              max="40"
              value={subjectCount}
              onChange={(e) => setSubjectCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              className={fieldClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {subjectRows.map((row, index) => (
              <div key={index}>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Subject name</label>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => {
                    const next = [...subjectRows];
                    next[index] = { name: e.target.value };
                    setSubjectRows(next);
                  }}
                  className={fieldClass}
                  placeholder="e.g. Mathematics"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={savingSubjects}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {savingSubjects ? 'Saving…' : 'Add subjects'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {subjects.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
            >
              {item.name}
              <button type="button" onClick={() => deleteSubject(item.id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        {subjects.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">No subjects yet. Add subject names above.</p>
        )}
      </section>
    </div>
  );
};

export default Setup;
