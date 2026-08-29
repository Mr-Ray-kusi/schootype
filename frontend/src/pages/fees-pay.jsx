import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Building2, CreditCard, Landmark, Loader2, Smartphone } from 'lucide-react';

const MOMO_PROVIDERS = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'vod', label: 'Telecel' },
  { id: 'atl', label: 'AT (AirtelTigo)' },
];

const formatGhs = (value) =>
  `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fieldClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20';

const FeesPay = () => {
  const { barcode } = useParams();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState(barcode || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('momo');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('mtn');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loadingSchools, setLoadingSchools] = useState(!barcode);
  const [lookingUp, setLookingUp] = useState(Boolean(barcode));
  const [paying, setPaying] = useState(false);
  const [momoPrompt, setMomoPrompt] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    if (barcode) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoadingSchools(true);
      try {
        const { data } = await axios.get('/api/public/schools');
        if (!cancelled) setSchools(data.schools || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load schools.');
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  useEffect(() => {
    if (!barcode) return undefined;
    let cancelled = false;
    const load = async () => {
      setLookingUp(true);
      setError('');
      try {
        const { data } = await axios.get(`/api/public/fees/${encodeURIComponent(barcode)}`);
        if (cancelled) return;
        setInfo(data);
        setSchoolId(data.school_id || '');
        setStudentId(data.barcode || barcode);
        if (data.amount > 0) setAmount(String(data.amount));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load this fee page.');
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  useEffect(() => {
    if (!momoPrompt?.reference || momoPrompt.needs_code) return undefined;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const { data } = await axios.get(`/api/public/fees/verify/${encodeURIComponent(momoPrompt.reference)}`);
        if (cancelled) return;
        if (data.status === 'success') {
          window.location.href = `/pay/receipt?reference=${encodeURIComponent(momoPrompt.reference)}`;
          return;
        }
        if (data.status === 'failed' || data.status === 'abandoned') {
          setError('Payment was not completed. Try again and confirm the PIN on your phone.');
          setMomoPrompt(null);
          setPaying(false);
          return;
        }
      } catch {
        // Keep waiting for the parent to approve MoMo.
      }
      if (!cancelled && attempts < 40) {
        window.setTimeout(poll, 3000);
      } else if (!cancelled) {
        setError('Still waiting for MoMo confirmation. Approve the prompt on your phone, then refresh.');
        setPaying(false);
      }
    };
    const timer = window.setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [momoPrompt]);

  const lookupStudent = async (event) => {
    event?.preventDefault();
    setError('');
    setInfo(null);
    if (!schoolId || !studentId.trim()) {
      setError('Select the school and enter the student ID.');
      return;
    }
    setLookingUp(true);
    try {
      const { data } = await axios.post('/api/public/fees/lookup', {
        schoolId,
        studentId: studentId.trim(),
      });
      setInfo(data);
      if (data.amount > 0 && !amount) setAmount(String(data.amount));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not find this student.');
    } finally {
      setLookingUp(false);
    }
  };

  const startPay = async (event) => {
    event?.preventDefault();
    setPaying(true);
    setError('');
    try {
      const payload = {
        schoolId: info?.school_id || schoolId,
        studentId: info?.barcode || info?.roll_number || studentId.trim(),
        amount: Number(amount),
        method,
        phone: method === 'momo' ? phone : undefined,
        provider: method === 'momo' ? provider : undefined,
      };
      const path = barcode
        ? `/api/public/fees/${encodeURIComponent(barcode)}/checkout`
        : '/api/public/fees/pay';
      const { data } = await axios.post(path, payload);
      if (method === 'momo' || data.mode === 'momo') {
        setMomoPrompt({
          reference: data.reference,
          display_text: data.display_text,
          needs_code: Boolean(data.needs_code),
          code_type: data.code_type || 'otp',
          live_mode: data.live_mode !== false,
        });
        if (!data.live_mode) {
          setError('Paystack is in test mode, so it SMS-es a test PIN instead of a MoMo prompt. Use live keys (sk_live_) on the server.');
        }
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setError('Paystack did not return a checkout link.');
      setPaying(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start payment.');
      setPaying(false);
    }
  };

  const submitMomoCode = async (event) => {
    event?.preventDefault();
    if (!momoPrompt?.reference || !otpCode.trim()) {
      setError('Enter the voucher or code from the prompt.');
      return;
    }
    setPaying(true);
    setError('');
    try {
      const { data } = await axios.post('/api/public/fees/authorize', {
        reference: momoPrompt.reference,
        otp: otpCode.trim(),
        code_type: momoPrompt.code_type || 'otp',
      });
      if (data.status === 'success') {
        window.location.href = `/pay/receipt?reference=${encodeURIComponent(data.reference)}`;
        return;
      }
      setMomoPrompt((prev) => ({
        ...prev,
        needs_code: Boolean(data.needs_code),
        display_text: data.display_text || prev?.display_text,
      }));
      if (!data.needs_code) setOtpCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'That code was not accepted.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <header className="text-center">
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
            Schooltype
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Fees payment</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pay with MoMo or bank. The amount goes to the selected school’s Bank Settings account.
          </p>
        </header>

        <form
          onSubmit={momoPrompt?.needs_code ? submitMomoCode : info ? startPay : lookupStudent}
          className="space-y-4 rounded-3xl border border-slate-700 bg-slate-900/70 p-6"
        >
          {!barcode ? (
            <>
              <label className="block text-sm font-medium text-slate-300">
                School name
                <select
                  className={`${fieldClass} mt-2`}
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setInfo(null);
                  }}
                  disabled={loadingSchools}
                  required
                >
                  <option value="">{loadingSchools ? 'Loading schools…' : 'Select school'}</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Student ID
                <input
                  className={`${fieldClass} mt-2`}
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setInfo(null);
                  }}
                  placeholder="Roll number or ID on the student card"
                  required
                />
              </label>
            </>
          ) : null}

          {lookingUp && !info ? <p className="text-sm text-slate-400">Finding student…</p> : null}

          {info ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-lg font-semibold">{info.student_name}</p>
              <p className="mt-1 text-sm text-slate-400">
                {info.school_name}
                {info.class_name ? ` · ${info.class_name}` : ''}
                {info.roll_number ? ` · ${info.roll_number}` : ''}
              </p>
              {info.paid ? (
                <p className="mt-3 text-sm text-emerald-300">This student already has a payment recorded this month. You can still pay an extra amount.</p>
              ) : null}
            </div>
          ) : null}

          {info ? (
            <>
              <label className="block text-sm font-medium text-slate-300">
                Amount (GHS)
                <input
                  className={`${fieldClass} mt-2`}
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>

              <div>
                <p className="text-sm font-medium text-slate-300">Payment method</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: 'momo', label: 'MoMo', Icon: Smartphone, hint: 'PIN on your phone' },
                    { id: 'bank', label: 'Bank', Icon: Landmark, hint: 'Paystack bank page' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMethod(option.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        method === option.id
                          ? 'border-sky-400 bg-sky-500/10'
                          : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
                      }`}
                    >
                      <option.Icon className="h-4 w-4 text-sky-300" />
                      <p className="mt-2 text-sm font-semibold">{option.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {method === 'momo' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Network
                      <select className={`${fieldClass} mt-2`} value={provider} onChange={(e) => setProvider(e.target.value)}>
                        {MOMO_PROVIDERS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-300">
                      MoMo number
                      <input
                        className={`${fieldClass} mt-2`}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0551234567"
                        required={method === 'momo'}
                      />
                    </label>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {provider === 'vod'
                      ? 'Telecel asks you to generate a voucher (*110#). Enter that voucher here — it is not your MoMo PIN.'
                      : 'After you tap Pay, a prompt should open on this number. Enter your MoMo PIN there. A Paystack SMS PIN means Bank checkout or test keys were used.'}
                  </p>
                </>
              ) : (
                <p className="rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                  Bank uses the Paystack page. They may SMS a code. For your MoMo PIN, choose MoMo instead.
                </p>
              )}
            </>
          ) : null}

          {momoPrompt ? (
            <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                {!momoPrompt.needs_code ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
                <p>
                  {momoPrompt.display_text ||
                    'Approve the MoMo prompt on your phone and enter your MoMo PIN. Do not wait for a Paystack SMS.'}
                </p>
              </div>
              {momoPrompt.needs_code ? (
                <label className="block text-sm font-medium text-emerald-50">
                  Voucher / code
                  <input
                    className={`${fieldClass} mt-2`}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter the voucher or code"
                    autoComplete="one-time-code"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={paying || lookingUp || loadingSchools || (info && !(Number(amount) > 0))}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
          >
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : info ? (
              <CreditCard className="h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            {paying ? 'Processing…' : momoPrompt?.needs_code ? 'Submit code' : info ? 'Pay' : 'Find student'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FeesPay;
