import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { useEffect, useState } from 'react';
import {
  Home as HomeIcon,
  Users,
  Hexagon,
  Shield,
  ArrowUpRight,
  Menu,
  X,
  Building2,
  Headphones,
  Workflow,
  Check,
  QrCode,
  MessageSquare,
  GraduationCap,
  Wallet,
  Lock,
  KeyRound,
  ShieldCheck,
  Database,
  Fingerprint,
} from 'lucide-react';
import { SYSTEM_CAPABILITY_GROUPS } from '../constants/plans';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', to: '#home', Icon: HomeIcon },
  { id: 'about', label: 'About', to: '#about', Icon: Users },
  { id: 'features', label: 'Features', to: '#features', Icon: Hexagon },
  { id: 'fees', label: 'Fees', to: '/fees', Icon: Wallet },
  { id: 'security', label: 'Security', to: '#security', Icon: Shield },
];

const ABOUT_POINTS = [
  {
    Icon: Building2,
    title: 'Who we are',
    body: 'Schooltype is a school operations company building the central connection point for academic life — from enrollment and attendance to fees, messaging, and reporting.',
  },
  {
    Icon: Workflow,
    title: 'What we do',
    body: 'We design multi-tenant school management software that keeps student, staff, and finance data organized, auditable, and accessible to the right people.',
  },
  {
    Icon: Headphones,
    title: 'How we support schools',
    body: 'Schools get guided onboarding, plan-based feature access, wallet and payment tooling, and a product roadmap shaped around real daily school workflows.',
  },
];

const FEATURE_ICONS = [Users, QrCode, MessageSquare, GraduationCap];

const SECURITY_POINTS = [
  {
    Icon: KeyRound,
    title: 'Authenticated access',
    body: 'Every school session is protected with JWT-based sign-in. Passwords are hashed with bcrypt so credentials are never stored in plain text.',
  },
  {
    Icon: Database,
    title: 'Tenant isolation',
    body: 'Each school operates in its own data boundary. Students, staff, attendance, fees, and messages stay scoped to the authenticated school account.',
  },
  {
    Icon: Lock,
    title: 'Controlled feature access',
    body: 'Plan approvals and feature gates ensure schools only reach modules they are entitled to use — reducing accidental exposure of sensitive tools.',
  },
  {
    Icon: Fingerprint,
    title: 'Trusted check-ins',
    body: 'QR attendance and scanner tokens tie check-ins to verified school identities, so records remain attributable and harder to spoof.',
  },
  {
    Icon: ShieldCheck,
    title: 'Operational safeguards',
    body: 'Login and signup rate limits, password strength checks, and role-aware routing help keep admin dashboards authentic and abuse-resistant.',
  },
];

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Home = () => {
  const { token, school, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState('home');

  useEffect(() => {
    // Always keep "/" as the marketing home. Logged-in users can open the dashboard from the nav.
  }, []);

  useEffect(() => {
    const sectionIds = NAV_ITEMS.filter((item) => item.to.startsWith('#')).map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.35, 0.55] }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading, token]);

  const handleNavClick = (item) => {
    setActiveId(item.id);
    setMenuOpen(false);
    if (item.to.startsWith('/')) {
      navigate(item.to);
      return;
    }
    if (item.to.startsWith('#')) {
      scrollToId(item.id);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        Loading…
      </div>
    );
  }

  const navBar = (
    <>
      <div className="landing-nav mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:gap-3 sm:px-4 sm:py-2.5">
        <a
          href="#home"
          className="flex shrink-0 items-center gap-2 pl-0.5 sm:gap-2.5"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick(NAV_ITEMS[0]);
          }}
        >
          <span className="landing-nav-logo flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white sm:h-10 sm:w-10 sm:text-sm">
            S
          </span>
          <span className="leading-tight">
            <span className="block whitespace-nowrap font-display text-[15px] font-extrabold tracking-tight text-slate-900 sm:text-lg">
              SCHOOLTYPE
            </span>
            <span className="hidden text-[10px] font-medium tracking-wide text-slate-500 sm:block">
              Connect. Track. Manage.
            </span>
          </span>
        </a>

        <nav className="landing-nav-rail mx-auto hidden min-w-0 flex-1 items-stretch justify-center rounded-full px-1.5 py-1 lg:flex">
          {NAV_ITEMS.map((item, index) => {
            const isActive = activeId === item.id;
            const showDivider = index === 2;
            const content = (
              <>
                <item.Icon
                  className={`h-4 w-4 ${isActive ? 'text-violet-600' : 'text-slate-500'}`}
                  strokeWidth={1.75}
                />
                <span
                  className={`text-[11px] font-semibold tracking-wide ${
                    isActive ? 'text-violet-700' : 'text-slate-600'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && <span className="mt-0.5 h-1 w-1 rounded-full bg-violet-600" />}
              </>
            );

            return (
              <div key={item.id} className="flex items-center">
                {showDivider && <span className="mx-0.5 h-7 w-px bg-slate-200/90" aria-hidden />}
                <a
                  href={item.to}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item);
                  }}
                  className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition ${
                    isActive ? 'bg-white shadow-sm' : 'hover:bg-white/70'
                  }`}
                >
                  {content}
                </a>
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {token ? (
            <Link
              to={
                school?.role === 'super_admin'
                  ? '/super-admin'
                  : !school?.payment_plan
                    ? '/select-plan'
                    : '/dashboard'
              }
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/80 lg:inline-flex"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/80 sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/plans"
                className="landing-nav-cta group hidden items-center gap-2 rounded-full py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110 sm:inline-flex"
              >
                <span className="whitespace-nowrap">Get started</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-violet-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="landing-nav-menu flex h-9 w-9 items-center justify-center rounded-full text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.1)] transition hover:bg-slate-50 sm:h-11 sm:w-11 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="landing-nav mx-auto mt-2 max-w-6xl overflow-hidden rounded-[1.5rem] p-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)] lg:hidden">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={item.to}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 transition ${
                    isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item);
                  }}
                >
                  <item.Icon
                    className={`h-5 w-5 ${isActive ? 'text-violet-600' : 'text-slate-500'}`}
                    strokeWidth={1.75}
                  />
                  <span className="text-xs font-semibold">{item.label}</span>
                </a>
              );
            })}
          </div>
          {token ? (
            <Link
              to={
                school?.role === 'super_admin'
                  ? '/super-admin'
                  : !school?.payment_plan
                    ? '/select-plan'
                    : '/dashboard'
              }
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center justify-center rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center justify-center rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="relative bg-slate-950 font-sans text-white">
      <header className="animate-hero-fade sticky top-0 z-50 px-3 pt-4 sm:px-5 md:px-8">
        {navBar}
      </header>

      {/* Hero — full-bleed under sticky nav */}
      <section id="home" className="relative -mt-[4.75rem] min-h-screen scroll-mt-0 overflow-hidden pt-[4.75rem]">
        <div className="absolute inset-0">
          <img
            src="/landing-hero.jpg"
            alt="Students at a school courtyard"
            className="h-full w-full object-cover animate-ken-burns"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, rgba(2, 12, 27, 0.92) 0%, rgba(2, 12, 27, 0.78) 42%, rgba(2, 12, 27, 0.45) 70%, rgba(2, 12, 27, 0.55) 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 50% 40% at 15% 80%, rgba(14, 165, 233, 0.25), transparent), radial-gradient(ellipse 40% 35% at 85% 20%, rgba(34, 197, 94, 0.12), transparent)',
            }}
          />
        </div>

        <div className="relative z-10 flex min-h-[calc(100vh-4.75rem)] flex-col justify-center px-4 pb-12 pt-6 sm:px-6 md:px-10 lg:px-14 lg:pb-24">
          <div className="max-w-2xl">
            <p className="animate-hero-fade font-display text-[1.65rem] font-extrabold tracking-tight text-white sm:text-4xl md:text-6xl lg:text-7xl">
              SCHOOLTYPE
            </p>
            <h1 className="animate-hero-rise mt-3 font-display text-lg font-bold leading-snug tracking-tight text-white/95 sm:mt-5 sm:text-2xl md:text-4xl">
              The central connection point for all your school academic activities
            </h1>
            <p className="animate-hero-rise-late mt-3 max-w-lg text-sm leading-relaxed text-slate-200/90 sm:mt-5 sm:text-base md:text-lg">
              Track students and staff, mark attendance with QR codes, send SMS or email, manage fees
              and wallets — everything your school needs, connected in one place.
            </p>

            <div className="animate-hero-rise-late mt-6 grid grid-cols-3 gap-1.5 sm:mt-10 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                to="/plans"
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-2 py-2.5 text-center text-[11px] font-semibold leading-tight text-white shadow-xl shadow-sky-500/30 transition hover:bg-sky-400 sm:px-7 sm:py-3.5 sm:text-sm"
              >
                Get started
              </Link>
              <Link
                to="/fees"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-2 py-2.5 text-center text-[11px] font-semibold leading-tight text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10 sm:px-7 sm:py-3.5 sm:text-sm"
              >
                Pay fees
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-2 py-2.5 text-center text-[11px] font-semibold leading-tight text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10 sm:px-7 sm:py-3.5 sm:text-sm"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="scroll-mt-28 border-t border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-16 sm:px-6 md:px-10 lg:px-14 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <img
                src="/landing-about.jpg"
                alt="A teacher helping students in class"
                className="h-56 w-full object-cover sm:h-72 lg:h-[28rem]"
                loading="lazy"
              />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">About Schooltype</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Built to connect every part of school life
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base md:text-lg">
                Schooltype helps schools move from scattered registers and chats to one trusted system —
                connecting people, attendance, academics, messaging, and payments under a single brand
                your staff and parents can rely on.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {ABOUT_POINTS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <Icon className="h-7 w-7 text-sky-400" strokeWidth={1.75} />
                <h3 className="mt-4 font-display text-lg font-bold text-white sm:text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">Multi-tenant</p>
              <p className="mt-1 text-sm text-slate-400">Isolated school workspaces on one platform</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">End-to-end</p>
              <p className="mt-1 text-sm text-slate-400">People, attendance, academics & finance</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">Plan-ready</p>
              <p className="mt-1 text-sm text-slate-400">Starter to Enterprise feature packages</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-28 bg-slate-900/80 px-4 py-16 sm:px-6 md:px-10 lg:px-14 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:order-1">
              <img
                src="/landing-features.jpg"
                alt="A school administrator checking student attendance"
                className="h-56 w-full object-cover sm:h-72 lg:h-[26rem]"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Features</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Everything your school needs in one system
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base md:text-lg">
                From student IDs and QR check-in to report cards, bulk messaging, and school wallets —
                Schooltype covers the daily tools administrators actually use.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-12 sm:grid-cols-2">
            {SYSTEM_CAPABILITY_GROUPS.map((group, index) => {
              const Icon = FEATURE_ICONS[index] || Hexagon;
              return (
                <div key={group.title} className="border-l border-sky-500/40 pl-5">
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-sky-400" strokeWidth={1.75} />
                    <h3 className="font-display text-xl font-bold text-white">{group.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" strokeWidth={2.5} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex items-center gap-3 text-sm text-slate-400">
            <Wallet className="h-5 w-5 text-sky-400" strokeWidth={1.75} />
            <p>Plus school wallet, bank, and MoMo settings for deposits and payouts.</p>
          </div>
        </div>
      </section>

      {/* Fees payment */}
      <section
        id="fees"
        className="scroll-mt-28 border-t border-white/5 bg-slate-950 px-4 py-16 sm:px-6 md:px-10 lg:px-14 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Fees payment</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Parents pay school fees online
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base md:text-lg">
                Choose the school, enter the student ID, verify the student, then pay with MoMo or bank.
              </p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <img
                src="/landing-fees.jpg"
                alt="A parent paying school fees on a phone"
                className="h-56 w-full object-cover sm:h-72 lg:h-80"
                loading="lazy"
              />
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { step: '1', title: 'Select school and student ID', body: 'Pick the school, then enter the student ID from the ID card to search.' },
              { step: '2', title: 'Verify student details', body: 'Confirm the name, class, and fee belong to the right student before you pay.' },
              { step: '3', title: 'Pay and confirm', body: 'Choose MoMo or bank, enter the amount, and confirm the payment.' },
            ].map((item) => (
              <div key={item.step} className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Step {item.step}</p>
                <h3 className="mt-3 font-display text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>

          <Link
            to="/fees"
            className="mt-10 inline-flex items-center justify-center rounded-full bg-sky-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-500/30 transition hover:bg-sky-400"
          >
            Pay fees
          </Link>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-28 bg-slate-900 px-4 py-16 sm:px-6 md:px-10 lg:px-14 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/10">
            <img
              src="/landing-security.jpg"
              alt="A school administrator reviewing records in a quiet office"
              className="h-48 w-full object-cover sm:h-64 md:h-80"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Security</p>
              <h2 className="mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Built to keep school data authentic and protected
              </h2>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base md:text-lg">
            Schooltype treats school records as sensitive operational data. Access is authenticated,
            schools are isolated from each other, and critical actions stay behind verified
            sessions and plan-approved roles.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_POINTS.map(({ Icon, title, body }) => (
              <div key={title}>
                <Icon className="h-7 w-7 text-sky-400" strokeWidth={1.75} />
                <h3 className="mt-4 font-display text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-lg font-bold text-white">SCHOOLTYPE</p>
            <p className="text-sm text-slate-500">Connect. Track. Manage.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <Link to="/fees" className="hover:text-white">
              Fees payment
            </Link>
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link to="/plans" className="hover:text-white">
              Get started
            </Link>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToId('about'); }} className="hover:text-white">
              About
            </a>
            <a href="#security" onClick={(e) => { e.preventDefault(); scrollToId('security'); }} className="hover:text-white">
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
