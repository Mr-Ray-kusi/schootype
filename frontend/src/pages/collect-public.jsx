import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader2, Search, ShieldCheck } from 'lucide-react';

const fieldClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20';

const CollectPublic = () => {
  const { token } = useParams();
  const abortRef = useRef(null);
  const [schoolName, setSchoolName] = useState('');
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [unitCode, setUnitCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await axios.get(`/api/public/collection/${encodeURIComponent(token || '')}`, {
          timeout: 8000,
        });
        if (cancelled) return;
        setSchoolName(data.school_name || '');
        setReady(Boolean(data.has_unit_code));
      } catch {
        if (!cancelled) setInvalid(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      setError('');
      try {
        const { data } = await axios.get(`/api/public/collection/${encodeURIComponent(token || '')}/search`, {
          params: { q },
          signal: controller.signal,
          timeout: 8000,
        });
        setResults(data.items || []);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.error || 'Search failed');
        }
      } finally {
        setSearching(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, token]);

  const verify = async (event) => {
    event?.preventDefault();
    if (!selected) {
      setError('Search for a name and tap Verify first.');
      return;
    }
    if (unitCode.trim().length < 4) {
      setError('Enter the unit code from a hall/SRC assistant.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const { data } = await axios.post(
        `/api/public/collection/${encodeURIComponent(token || '')}/verify`,
        {
          person_id: selected.id,
          person_type: selected.person_type,
          unit_code: unitCode.trim(),
        },
        { timeout: 8000 }
      );
      setDone(data);
      setResults((prev) =>
        prev.map((row) => (row.id === selected.id && row.person_type === selected.person_type ? { ...row, collected: true } : row))
      );
      setSelected(null);
      setUnitCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <p className="font-display text-2xl font-bold text-white">SCHOOLTYPE</p>
        <p className="text-slate-400">This collection QR is invalid or no longer active.</p>
        <Link to="/" className="text-sm text-sky-400 hover:text-sky-300">
          Go to home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(14, 165, 233, 0.2), transparent 55%), #020617',
        }}
      />
      <div className="relative mx-auto w-full max-w-lg px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Collection</p>
        <h1 className="mt-2 font-display text-3xl font-bold">{schoolName || 'Item collection'}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Search your name, tap Verify, then an assistant enters the unit code.
        </p>

        {!ready ? (
          <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Collection is not ready yet. Ask the hall/SRC admin to set the unit code.
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-slate-200">Search your name</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDone(null);
            }}
            placeholder="Type at least 2 letters"
            className={`${fieldClass} pl-10`}
            autoComplete="off"
            autoFocus
          />
        </div>
        {searching ? <p className="mt-2 text-xs text-slate-400">Searching…</p> : null}

        <ul className="mt-4 space-y-2">
          {results.map((person) => (
            <li key={`${person.person_type}-${person.id}`}>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{person.name}</p>
                  <p className="text-xs text-slate-400">
                    {person.person_type} · {person.label}
                  </p>
                </div>
                {person.collected ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-300">Collected</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(person);
                      setDone(null);
                      setError('');
                    }}
                    className="shrink-0 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                  >
                    Verify
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {selected ? (
          <form onSubmit={verify} className="mt-6 rounded-2xl border border-sky-500/30 bg-slate-900/90 p-4">
            <div className="mb-3 flex items-center gap-2 text-sky-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-medium">Enter unit code for {selected.name}</p>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Ask a hall/SRC assistant for the unit code. It is the same code for every QR.
            </p>
            <input
              type="password"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="Unit code"
              className={fieldClass}
              autoComplete="off"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={verifying}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {verifying ? 'Verifying…' : 'Complete verification'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setUnitCode('');
                }}
                className="rounded-xl border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {done ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-100">{done.message || 'Verified'}</p>
              <p className="text-sm text-emerald-200">{done.record?.person_name}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CollectPublic;
