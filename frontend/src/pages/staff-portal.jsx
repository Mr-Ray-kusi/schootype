import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { BookOpen, GraduationCap, LogOut, Save, Users } from 'lucide-react';

const ROLES = ['Teacher', 'Accountant', 'Librarian', 'Administrator', 'Principal', 'Counselor', 'Coach'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const ATTITUDES = ['Excellent', 'Good', 'Bad', 'Worse'];
const SESSION_KEY = 'staffPortalSession';

const normalizeClassKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const StaffPortal = () => {
  const { token: tokenParam, schoolSlug } = useParams();
  const [token, setToken] = useState(tokenParam || null);
  const [resolvingSlug, setResolvingSlug] = useState(Boolean(schoolSlug && !tokenParam));
  const [schoolName, setSchoolName] = useState('');
  const [linkError, setLinkError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [role, setRole] = useState('Teacher');
  const [loggingIn, setLoggingIn] = useState(false);
  const [sessionToken, setSessionToken] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (tokenParam && parsed?.portalToken === tokenParam) return parsed.sessionToken;
      if (schoolSlug && parsed?.schoolSlug === schoolSlug) return parsed.sessionToken;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [staff, setStaff] = useState(null);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [draftScores, setDraftScores] = useState({});
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const authHeaders = useMemo(
    () => (sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    [sessionToken]
  );

  useEffect(() => {
    if (!schoolSlug || tokenParam) {
      setResolvingSlug(false);
      if (tokenParam) setToken(tokenParam);
      return undefined;
    }
    let cancelled = false;
    const resolve = async () => {
      setResolvingSlug(true);
      setLinkError('');
      try {
        const { data } = await axios.get(
          `/api/public/staff-portal/${encodeURIComponent(schoolSlug)}`
        );
        if (!cancelled) {
          setToken(data.token);
          setSchoolName(data.schoolName || 'School');
        }
      } catch (err) {
        if (!cancelled) {
          setLinkError(err.response?.data?.error || 'Invalid or inactive staff portal link');
        }
      } finally {
        if (!cancelled) setResolvingSlug(false);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [schoolSlug, tokenParam]);

  useEffect(() => {
    if (!token) {
      if (!resolvingSlug && !schoolSlug) {
        setLoadingPortal(false);
        setLinkError('Invalid or inactive staff portal link');
      }
      return undefined;
    }
    let cancelled = false;
    const loadSchool = async () => {
      setLoadingPortal(true);
      setLinkError('');
      try {
        const { data } = await axios.get(`/api/staff-portal/${token}/school`);
        if (!cancelled) setSchoolName(data.schoolName || 'School');
      } catch (err) {
        if (!cancelled) {
          setLinkError(err.response?.data?.error || 'Invalid or inactive staff portal link');
        }
      } finally {
        if (!cancelled) setLoadingPortal(false);
      }
    };
    loadSchool();
    return () => {
      cancelled = true;
    };
  }, [token, resolvingSlug, schoolSlug]);

  const persistSession = (nextToken, nextStaff, nextSchool) => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        portalToken: token,
        schoolSlug: schoolSlug || null,
        sessionToken: nextToken,
        staff: nextStaff,
        schoolName: nextSchool,
      })
    );
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
    setStaff(null);
    setStudents([]);
    setScores([]);
  };

  const loadTeacherData = useCallback(
    async (subject, className) => {
      if (!sessionToken) return;
      try {
        const [studentsRes, scoresRes] = await Promise.all([
          axios.get('/api/staff-portal/session/students', { headers: authHeaders }),
          axios.get('/api/staff-portal/session/scores', {
            headers: authHeaders,
            params: { subject, className },
          }),
        ]);
        setStudents(studentsRes.data || []);
        setScores(scoresRes.data || []);
        const nextDraft = {};
        for (const row of scoresRes.data || []) {
          nextDraft[row.student_id] = {
            score: row.score ?? '',
            maxScore: row.max_score ?? 100,
            remark: row.remark || '',
            attitude: row.attitude || '',
          };
        }
        setDraftScores(nextDraft);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load portal data');
        if (err.response?.status === 401) clearSession();
      }
    },
    [authHeaders, sessionToken]
  );

  useEffect(() => {
    if (!sessionToken) return undefined;
    let cancelled = false;
    const restore = async () => {
      try {
        const { data } = await axios.get('/api/staff-portal/session/me', { headers: authHeaders });
        if (cancelled) return;
        setStaff(data.staff);
        setSchoolName(data.schoolName || schoolName);
        const firstSubject = data.staff.subjects?.[0] || '';
        const firstClass = data.staff.classNames?.[0] || '';
        setSelectedSubject((prev) => prev || firstSubject);
        setSelectedClass((prev) => prev || firstClass);
      } catch {
        if (!cancelled) clearSession();
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, authHeaders]);

  useEffect(() => {
    if (!staff || String(staff.role).toLowerCase() !== 'teacher') return;
    if (!selectedSubject || !selectedClass) return;
    loadTeacherData(selectedSubject, selectedClass);
  }, [staff, selectedSubject, selectedClass, loadTeacherData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!token) return;
    setLoggingIn(true);
    try {
      const { data } = await axios.post(`/api/staff-portal/${token}/login`, { accessCode, role });
      setSessionToken(data.sessionToken);
      setStaff(data.staff);
      setSchoolName(data.schoolName || schoolName);
      persistSession(data.sessionToken, data.staff, data.schoolName);
      setSelectedSubject(data.staff.subjects?.[0] || '');
      setSelectedClass(data.staff.classNames?.[0] || '');
      toast.success(`Welcome, ${data.staff.name}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const classStudents = useMemo(() => {
    if (!selectedClass) return students;
    const selectedKey = normalizeClassKey(selectedClass);
    return students.filter((student) => normalizeClassKey(student.class) === selectedKey);
  }, [students, selectedClass]);

  const saveScore = async (student) => {
    const draft = draftScores[student.id] || { score: '', maxScore: 100, remark: '', attitude: '' };
    setSavingId(student.id);
    try {
      await axios.post(
        '/api/staff-portal/session/scores',
        {
          studentId: student.id,
          subject: selectedSubject,
          className: selectedClass || student.class,
          term,
          score: draft.score,
          maxScore: draft.maxScore,
          remark: draft.remark,
          attitude: draft.attitude || null,
        },
        { headers: authHeaders }
      );
      toast.success(`Saved score for ${student.name}`);
      await loadTeacherData(selectedSubject, selectedClass);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save score');
    } finally {
      setSavingId(null);
    }
  };

  if (resolvingSlug || loadingPortal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading staff portal…
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <h1 className="text-2xl font-bold text-white">Staff portal unavailable</h1>
        <p className="text-slate-400">{linkError}</p>
      </div>
    );
  }

  if (!sessionToken || !staff) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 40% at 50% 0%, rgba(14,165,233,0.18), transparent 55%), #020617',
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">Staff portal</p>
          <h1 className="mt-2 font-display text-3xl font-bold">{schoolName}</h1>
          <form
            onSubmit={handleLogin}
            className="mt-8 space-y-4 rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6"
          >
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Access code</label>
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-4 py-3 text-white"
                placeholder="SCH-XXXXXXXX"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-4 py-3 text-white"
                required
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-full bg-sky-500 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {loggingIn ? 'Signing in…' : 'Enter portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isTeacher = String(staff.role).toLowerCase() === 'teacher';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{schoolName}</p>
            <h1 className="text-xl font-bold">{staff.name}</h1>
            <p className="text-sm text-sky-300">{staff.role}</p>
          </div>
          <button
            type="button"
            onClick={clearSession}
            className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {!isTeacher ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-center">
            <p className="text-lg font-semibold">Signed in as {staff.role}</p>
            <p className="mt-2 text-sm text-slate-400">
              Teacher score entry is available when you sign in with the Teacher role. Ask your admin to assign
              subjects and classes on your staff profile.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <BookOpen className="h-3.5 w-3.5" /> Subjects
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {staff.subjects?.length ? staff.subjects.join(', ') : 'None assigned'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <GraduationCap className="h-3.5 w-3.5" /> Classes
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {staff.classNames?.length ? staff.classNames.join(', ') : 'None assigned'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <Users className="h-3.5 w-3.5" /> Students in view
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{classStudents.length}</p>
              </div>
            </section>

            {!staff.subjects?.length || !staff.classNames?.length ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                Your admin must set subjects and classes on your staff profile before you can enter scores.
              </div>
            ) : (
              <>
                <section className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm"
                  >
                    {staff.subjects.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm"
                  >
                    {staff.classNames.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm"
                  >
                    {TERMS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </section>

                <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/50">
                  <div className="border-b border-slate-700 px-5 py-4">
                    <h2 className="font-semibold">
                      Scores · {selectedSubject} · {selectedClass}
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {classStudents.length === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-slate-400">
                        No students found in this class. Ask your admin to match the teacher class names with
                        each student&apos;s class from Setup.
                      </p>
                    ) : (
                      classStudents.map((student) => {
                        const draft = draftScores[student.id] || {
                          score: '',
                          maxScore: 100,
                          remark: '',
                          attitude: '',
                        };
                        return (
                          <div
                            key={student.id}
                            className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white">{student.name}</p>
                              <p className="text-xs text-slate-500">
                                {student.class}
                                {student.roll_number ? ` · ${student.roll_number}` : ''}
                                {student.parent_phone ? ` · Parent: ${student.parent_phone}` : ''}
                              </p>
                            </div>
                            <input
                              type="number"
                              value={draft.score}
                              onChange={(e) =>
                                setDraftScores((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, score: e.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm lg:w-24"
                              placeholder="Score"
                            />
                            <input
                              type="number"
                              value={draft.maxScore}
                              onChange={(e) =>
                                setDraftScores((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, maxScore: e.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm lg:w-24"
                              placeholder="Max"
                            />
                            <select
                              value={draft.attitude || ''}
                              onChange={(e) =>
                                setDraftScores((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, attitude: e.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm lg:w-36"
                            >
                              <option value="">Attitude</option>
                              {ATTITUDES.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={draft.remark}
                              onChange={(e) =>
                                setDraftScores((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, remark: e.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm lg:w-40"
                              placeholder="Remark"
                            />
                            <button
                              type="button"
                              onClick={() => saveScore(student)}
                              disabled={savingId === student.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {savingId === student.id ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default StaffPortal;
