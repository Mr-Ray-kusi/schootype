import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export const AUTH_ORANGE = '#ff5722';

export function AuthBrandMark({ compact = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff5722] text-white shadow-sm">
        <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="leading-none">
        <span className="block text-[12px] font-extrabold tracking-[0.16em] text-white">SCHOOLTYPE</span>
        {!compact && (
          <span className="mt-0.5 block text-[9px] font-medium tracking-[0.2em] text-white/65">SCHOOL SYSTEM</span>
        )}
      </span>
    </Link>
  );
}

function PromoPanel({ mode }) {
  const isSignup = mode === 'signup';

  return (
    <div className="relative flex min-h-[280px] flex-col overflow-hidden bg-[#ff5722] px-8 py-10 text-white md:min-h-[640px] md:px-12 md:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full border border-white/25"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 rounded-full ${i === 0 ? 'w-7 bg-white' : 'w-5 bg-white/40'}`}
            />
          ))}
        </div>

        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <GraduationCap className="h-3 w-3" />
          {isSignup ? 'Welcome back' : 'Schooltype'}
        </span>

        <h2 className="max-w-xs font-serif text-[2rem] font-bold leading-tight md:text-[2.35rem]">
          {isSignup ? 'Back in the driver’s seat' : 'New to the crew?'}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/90 md:text-[15px]">
          {isSignup
            ? 'Sign in to keep the school moving — attendance, fees and reports await.'
            : 'Create your school account and put academics to work in minutes.'}
        </p>

        <Link
          to={isSignup ? '/login' : '/plans'}
          className="mt-8 inline-flex min-w-[160px] items-center justify-center rounded-xl border border-white/85 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {isSignup ? 'Sign in' : 'Create account'}
        </Link>
      </div>

      <p className="relative mt-8 text-center text-xs italic text-white/85 md:mt-0">
        {isSignup ? '“The journey, not the destination, matters.”' : '“Every school deserves a connected academic life.”'}
      </p>
    </div>
  );
}

export function AuthField({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  name,
  placeholder,
  required,
  rightSlot,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-300">{label}</span>
      <span className="relative flex items-center">
        {Icon ? <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" /> : null}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`auth-field w-full rounded-xl py-3 text-sm placeholder:text-neutral-500 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${rightSlot ? 'pr-11' : 'pr-3.5'}`}
        />
        {rightSlot ? <span className="absolute right-3 flex items-center">{rightSlot}</span> : null}
      </span>
    </label>
  );
}

export default function AuthSplitLayout({ mode = 'login', children }) {
  const isSignup = mode === 'signup';

  return (
    <div className="auth-page relative min-h-screen overflow-hidden bg-[#111] font-sans text-white">
      <div
        aria-hidden
        className="absolute inset-0 scale-105 bg-cover bg-center blur-[2px]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(10,10,10,.55), rgba(10,10,10,.7)), url('https://images.unsplash.com/photo-1470114716159-e389cf0291a8?auto=format&fit=crop&w=2000&q=60')",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-8 md:py-8">
        <div className="mb-5 md:mb-6">
          <AuthBrandMark />
        </div>

        <div className="mx-auto grid w-full max-w-5xl flex-1 overflow-hidden rounded-[28px] bg-[#121212] shadow-2xl shadow-black/50 md:min-h-[640px] md:grid-cols-2">
          <div className={`order-1 ${isSignup ? 'md:order-2' : 'md:order-1'}`}>
            <div className="flex h-full flex-col justify-center px-6 py-8 sm:px-10 md:px-12">{children}</div>
          </div>
          <div className={`order-2 ${isSignup ? 'md:order-1' : 'md:order-2'}`}>
            <PromoPanel mode={mode} />
          </div>
        </div>
      </div>
    </div>
  );
}
