import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Download, FileText, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/authcontext';
import { useLivePoll } from '../hooks/useLivePoll';
import { cachedGet, invalidateCache } from '../utils/requestCache';
import {
  downloadStudentReportCardsPdf,
  downloadSubjectRankingsPdf,
  letterGrade,
} from '../utils/reportCardPdf';

const formatWhen = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

const studentKey = (row) => row.student_id || `${row.student_name}-${row.class_name}`;

const ReportCards = () => {
  const { school } = useAuth();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('all');
  const [selectedStudentKeys, setSelectedStudentKeys] = useState([]);
  const [clearing, setClearing] = useState(false);

  const loadScores = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await cachedGet(
        'report-cards:scores',
        async () => {
          const res = await axios.get('/api/report-cards/scores');
          return res.data;
        },
        silent ? 0 : 30000
      );
      setScores(data.scores || []);
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to load teacher scores');
        setScores([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScores({ silent: false });
  }, [loadScores]);

  useLivePoll(() => loadScores({ silent: true }), 20000, true);

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

  const studentsForPrint = useMemo(() => {
    const map = new Map();
    for (const row of scores) {
      if (selectedClass !== 'all' && row.class_name !== selectedClass) continue;
      if (selectedTerm !== 'all' && row.term !== selectedTerm) continue;
      const key = studentKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          student_id: row.student_id,
          student_name: row.student_name,
          class_name: row.class_name,
          roll_number: row.roll_number,
          term: row.term,
          entryCount: 0,
        });
      }
      map.get(key).entryCount += 1;
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.student_name || '').localeCompare(String(b.student_name || ''))
    );
  }, [scores, selectedClass, selectedTerm]);

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
    () => new Set(filtered.map((row) => studentKey(row))).size,
    [filtered]
  );

  const uniqueTeachers = useMemo(
    () => new Set(filtered.map((row) => row.teacher_id).filter(Boolean)).size,
    [filtered]
  );

  const allStudentsSelected =
    studentsForPrint.length > 0 &&
    studentsForPrint.every((student) => selectedStudentKeys.includes(student.key));

  const toggleStudent = (key) => {
    setSelectedStudentKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const toggleSelectAllStudents = () => {
    if (allStudentsSelected) {
      setSelectedStudentKeys([]);
      return;
    }
    setSelectedStudentKeys(studentsForPrint.map((student) => student.key));
  };

  const handleClearAllScores = async () => {
    if (!scores.length) {
      toast.error('There are no teacher score entries to clear');
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${scores.length} teacher score ${scores.length === 1 ? 'entry' : 'entries'} for this school?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      const { data } = await axios.delete('/api/report-cards/scores');
      invalidateCache('report-cards');
      setScores([]);
      setSelectedStudentKeys([]);
      toast.success(data?.message || 'Teacher score entries cleared');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear teacher score entries');
    } finally {
      setClearing(false);
    }
  };

  const handleRankingsPdf = () => {
    if (!filtered.length) {
      toast.error('No scores to export for the current filters');
      return;
    }
    downloadSubjectRankingsPdf({
      scores,
      schoolName: school?.name || 'School',
      className: selectedClass,
      term: selectedTerm,
      subject: selectedSubject,
    });
    toast.success('Subject rankings PDF downloaded');
  };

  const handleStudentCardsPdf = (studentIds) => {
    const ids = studentIds || selectedStudentKeys;
    if (!ids.length) {
      toast.error('Select at least one student to print a personal report');
      return;
    }

    const scoped = scores.filter((row) => {
      if (selectedClass !== 'all' && row.class_name !== selectedClass) return false;
      if (selectedTerm !== 'all' && row.term !== selectedTerm) return false;
      return ids.includes(studentKey(row));
    });

    if (!scoped.length) {
      toast.error('No scores found for the selected students');
      return;
    }

    downloadStudentReportCardsPdf({
      scores,
      schoolName: school?.name || 'School',
      className: selectedClass,
      term: selectedTerm,
      studentIds: ids,
    });
    toast.success(
      ids.length === 1 ? 'Personal student report downloaded' : `${ids.length} personal reports downloaded`
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Report Cards</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadScores({ silent: false })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRankingsPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            <Download className="h-4 w-4" />
            Subject rankings PDF
          </button>
          <button
            type="button"
            onClick={() => handleStudentCardsPdf()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Printer className="h-4 w-4" />
            Print selected reports
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <label className="block text-sm text-slate-300">
              Class
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
              >
                {classes.map((className) => (
                  <option key={className} value={className}>
                    {className === 'all' ? 'All classes' : className}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Subject
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject === 'all' ? 'All subjects' : subject}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Term
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-slate-50"
              >
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term === 'all' ? 'All terms' : term}
                  </option>
                ))}
              </select>
            </label>
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
        <div>
          <h2 className="text-lg font-semibold text-white">Grade distribution</h2>
        </div>

        <div className="mt-6 space-y-4">
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-slate-900 px-5 py-8 text-center text-sm text-slate-400">
              No scores yet.
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
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-white">Teacher score entries</h2>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <button
              type="button"
              onClick={handleClearAllScores}
              disabled={clearing || !scores.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {clearing ? 'Clearing...' : 'Clear all entries'}
            </button>
          </div>
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
                <th className="px-6 py-4">Attitude</th>
                <th className="px-6 py-4">Teacher</th>
                <th className="px-6 py-4">Updated</th>
                <th className="px-6 py-4">Remark</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                    Loading teacher scores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                    No scores yet.
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
                          {row.score == null ? '-' : `${row.score}/${row.max_score ?? 100}`}
                        </span>
                        {row.percent != null ? (
                          <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs text-white">
                            {letterGrade(row.percent)} - {row.percent}%
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">{row.attitude || '-'}</td>
                    <td className="px-6 py-4">{row.teacher_name}</td>
                    <td className="px-6 py-4 text-slate-400">{formatWhen(row.updated_at)}</td>
                    <td className="px-6 py-4 text-slate-300">{row.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Print personal reports</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllStudents}
              className="rounded-full border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:bg-slate-700"
            >
              {allStudentsSelected ? 'Clear selection' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={() => handleStudentCardsPdf()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Print selected ({selectedStudentKeys.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={allStudentsSelected}
                    onChange={toggleSelectAllStudents}
                    aria-label="Select all students"
                    className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                  />
                </th>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Term</th>
                <th className="px-6 py-4">Score entries</th>
                <th className="px-6 py-4">Print</th>
              </tr>
            </thead>
            <tbody>
              {studentsForPrint.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No students yet.
                  </td>
                </tr>
              ) : (
                studentsForPrint.map((student, index) => (
                  <tr key={student.key} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudentKeys.includes(student.key)}
                        onChange={() => toggleStudent(student.key)}
                        aria-label={`Select ${student.student_name}`}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                      />
                    </td>
                    <td className="px-6 py-4 text-white">
                      <div>{student.student_name}</div>
                      {student.roll_number ? (
                        <div className="text-xs text-slate-500">{student.roll_number}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">{student.class_name || '-'}</td>
                    <td className="px-6 py-4">
                      {selectedTerm === 'all' ? student.term || '-' : selectedTerm}
                    </td>
                    <td className="px-6 py-4">{student.entryCount}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleStudentCardsPdf([student.key])}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print report
                      </button>
                    </td>
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
