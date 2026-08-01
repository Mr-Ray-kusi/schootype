import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FileText, RefreshCw } from 'lucide-react';

const letterGrade = (percent) => {
  if (percent == null || Number.isNaN(percent)) return '—';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
};

const formatWhen = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

const ReportCards = () => {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('all');

  const loadScores = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/report-cards/scores');
      setScores(data.scores || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load teacher scores');
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const classes = useMemo(() => {
    const set = new Set(scores.map((row) => row.class_name).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [scores]);

  const subjects = useMemo(() => {
    const set = new Set(scores.map((row) => row.subject).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [scores]);

  const terms = useMemo(() => {
    const set = new Set(scores.map((row) => row.term).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [scores]);

  const filtered = useMemo(() => {
    return scores.filter((row) => {
      if (selectedClass !== 'all' && row.class_name !== selectedClass) return false;
      if (selectedSubject !== 'all' && row.subject !== selectedSubject) return false;
      if (selectedTerm !== 'all' && row.term !== selectedTerm) return false;
      return true;
    });
  }, [scores, selectedClass, selectedSubject, selectedTerm]);

  const gradeDistribution = useMemo(() => {
    const buckets = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    let graded = 0;
    for (const row of filtered) {
      if (row.percent == null) continue;
      graded += 1;
      buckets[letterGrade(row.percent)] += 1;
    }
    return Object.entries(buckets).map(([grade, count]) => ({
      grade,
      count,
      percent: graded ? Math.round((count / graded) * 100) : 0,
    }));
  }, [filtered]);

  const uniqueStudents = useMemo(
    () => new Set(filtered.map((row) => row.student_id).filter(Boolean)).size,
    [filtered]
  );

  const uniqueTeachers = useMemo(
    () => new Set(filtered.map((row) => row.teacher_id).filter(Boolean)).size,
    [filtered]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Report Cards</h1>
          <p className="mt-3 text-slate-300">
            Live scores entered by teachers in the staff portal. Filter by class, subject, or term.
          </p>
        </div>
        <button
          type="button"
          onClick={loadScores}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <p className="text-sm text-slate-300">Narrow results from teacher submissions.</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
            >
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className === 'all' ? 'All classes' : className}
                </option>
              ))}
            </select>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
            >
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject === 'all' ? 'All subjects' : subject}
                </option>
              ))}
            </select>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
            >
              {terms.map((term) => (
                <option key={term} value={term}>
                  {term === 'all' ? 'All terms' : term}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Score entries</p>
            <p className="mt-4 text-3xl font-semibold text-white">{filtered.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Students graded</p>
            <p className="mt-4 text-3xl font-semibold text-white">{uniqueStudents}</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-300">Teachers submitting</p>
            <p className="mt-4 text-3xl font-semibold text-white">{uniqueTeachers}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Grade distribution</h2>
            <p className="text-sm text-slate-300">Based on score percentage from teacher entries.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm text-white">
            Live performance
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-slate-900 px-5 py-8 text-center text-sm text-slate-400">
              No graded scores yet for this filter.
            </p>
          ) : (
            gradeDistribution.map((item) => (
              <div key={item.grade} className="rounded-3xl bg-slate-900 p-4">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Grade {item.grade}</span>
                  <span>{item.count} entries</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-300">{item.percent}% of graded entries</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-white">Teacher score entries</h2>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Term</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Teacher</th>
                <th className="px-6 py-4">Updated</th>
                <th className="px-6 py-4">Remark</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    Loading teacher scores…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No teacher scores yet. When teachers save scores in the staff portal, they appear here.
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                    <td className="px-6 py-4 text-white">
                      <div>{row.student_name}</div>
                      {row.roll_number ? (
                        <div className="text-xs text-slate-500">{row.roll_number}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">{row.class_name}</td>
                    <td className="px-6 py-4">{row.subject}</td>
                    <td className="px-6 py-4">{row.term}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">
                          {row.score == null ? '—' : `${row.score}/${row.max_score ?? 100}`}
                        </span>
                        {row.percent != null ? (
                          <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs text-white">
                            {letterGrade(row.percent)} · {row.percent}%
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">{row.teacher_name}</td>
                    <td className="px-6 py-4 text-slate-400">{formatWhen(row.updated_at)}</td>
                    <td className="px-6 py-4 text-slate-300">{row.remark || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ReportCards;
