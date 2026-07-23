import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Phone, Mail, Calendar, GraduationCap, User } from 'lucide-react';

const formatDob = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const StudentPublicId = () => {
  const { barcode } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: profile } = await axios.get(
          `/api/public/id/${encodeURIComponent(barcode || '')}`
        );
        if (!cancelled) setData(profile);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Student ID not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        Loading student ID…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 font-sans text-center">
        <p className="font-display text-2xl font-bold text-white">NEXUS</p>
        <p className="text-slate-400">{error || 'Student not found'}</p>
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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
        <header className="mb-8 text-center">
          <p className="font-display text-xl font-extrabold tracking-tight text-white">NEXUS</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Student ID</p>
        </header>

        <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/70 shadow-2xl">
          <div className="border-b border-slate-700/80 bg-slate-800/50 px-6 py-5 text-center">
            {data.school_logo_url ? (
              <img
                src={data.school_logo_url}
                alt=""
                className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover"
              />
            ) : null}
            <p className="font-display text-lg font-bold text-white">{data.school_name}</p>
          </div>

          <div className="flex flex-col items-center px-6 pb-8 pt-8">
            {data.photo_url ? (
              <img
                src={data.photo_url}
                alt={data.name}
                className="h-44 w-36 rounded-2xl border-2 border-slate-600 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-44 w-36 flex-col items-center justify-center rounded-2xl border-2 border-slate-600 bg-slate-800">
                <User className="h-12 w-12 text-slate-500" />
              </div>
            )}

            <h1 className="mt-5 font-display text-2xl font-bold text-white">{data.name}</h1>
            {data.class && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-sm text-sky-200">
                <GraduationCap className="h-3.5 w-3.5" />
                {data.class}
              </p>
            )}
          </div>

          <div className="space-y-0 border-t border-slate-700/80 px-6 py-2">
            {data.parent_phone && (
              <div className="flex items-start gap-3 border-b border-slate-800 py-4">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Parent contact</p>
                  <a href={`tel:${data.parent_phone}`} className="text-slate-100 hover:text-sky-300">
                    {data.parent_phone}
                  </a>
                </div>
              </div>
            )}
            {data.house_address && (
              <div className="flex items-start gap-3 border-b border-slate-800 py-4">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">House address</p>
                  <p className="text-slate-100">{data.house_address}</p>
                </div>
              </div>
            )}
            {data.date_of_birth && (
              <div className="flex items-start gap-3 border-b border-slate-800 py-4">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date of birth</p>
                  <p className="text-slate-100">{formatDob(data.date_of_birth)}</p>
                </div>
              </div>
            )}
            {data.parent_email && (
              <div className="flex items-start gap-3 py-4">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Parent email</p>
                  <p className="break-all text-slate-100">{data.parent_email}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-600">
          Scanned with a phone camera · For attendance use the school scanner
        </p>
      </div>
    </div>
  );
};

export default StudentPublicId;
