import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import { useEffect, useState } from 'react';
import {
  Home as HomeIcon,
  Users,
  Hexagon,
  CreditCard,
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
import { PLAN_LIST, SYSTEM_CAPABILITY_GROUPS, formatPlanPriceGhs, formatPlanPriceUsd } from '../constants/plans';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', to: '#home', Icon: HomeIcon },
  { id: 'about', label: 'About', to: '#about', Icon: Users },
  { id: 'features', label: 'Features', to: '#features', Icon: Hexagon },
  { id: 'plans', label: 'Plans', to: '#plans', Icon: CreditCard },
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
    const sectionIds = NAV_ITEMS.map((item) => item.id);
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

  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-300">
        Redirecting…
      </div>
    );
  }

  const navBar = (
    <>
      <div className="landing-nav mx-auto flex max-w-6xl items-center gap-2 rounded-full px-3 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:gap-3 sm:px-4">
        <a
          href="#home"
          className="flex min-w-0 shrink-0 items-center gap-2.5 pl-1"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick(NAV_ITEMS[0]);
          }}
        >
          <span className="landing-nav-logo flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white">
            S
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
              SCHOOLTYPE
            </span>
            <span className="hidden truncate text-[10px] font-medium tracking-wide text-slate-500 sm:block">
              Connect. Track. Manage.
            </span>
          </span>
        </a>

        <nav className="landing-nav-rail mx-auto hidden min-w-0 flex-1 items-stretch justify-center rounded-full px-1.5 py-1 lg:flex">
          {NAV_ITEMS.map((item, index) => {
            const isActive = activeId === item.id;
            const showDivider = index === 1 || index === 3;
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {token ? (
            <Link
              to={
                school?.role === 'super_admin'
                  ? '/super-admin'
                  : !school?.payment_plan
                    ? '/select-plan'
                    : '/dashboard'
              }
              className="landing-nav-cta group inline-flex items-center gap-2 rounded-full py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110"
            >
              Open dashboard
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-violet-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
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
                className="landing-nav-cta group inline-flex items-center gap-2 rounded-full py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110"
              >
                Get started
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
            className="landing-nav-menu flex h-11 w-11 items-center justify-center rounded-full text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.1)] transition hover:bg-slate-50 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="landing-nav mx-auto mt-2 max-w-6xl overflow-hidden rounded-[1.5rem] p-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)] lg:hidden">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
              Open dashboard
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
            src="/hero-students.jpg"
            alt=""
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

        <div className="relative z-10 flex min-h-[calc(100vh-4.75rem)] flex-col justify-center px-6 pb-16 pt-8 md:px-10 lg:px-14 lg:pb-24">
          <div className="max-w-2xl">
            <p className="animate-hero-fade font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              SCHOOLTYPE
            </p>
            <h1 className="animate-hero-rise mt-5 font-display text-2xl font-bold leading-snug tracking-tight text-white/95 sm:text-3xl md:text-4xl">
              The central connection point for all your school academic activities
            </h1>
            <p className="animate-hero-rise-late mt-5 max-w-lg text-base leading-relaxed text-slate-200/90 sm:text-lg">
              Track students and staff, mark attendance with QR codes, send SMS or email, manage fees
              and wallets — everything your school needs, connected in one place.
            </p>

            <div className="animate-hero-rise-late mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#plans"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(NAV_ITEMS.find((i) => i.id === 'plans'));
                }}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-500/30 transition hover:bg-sky-400 hover:shadow-sky-400/40"
              >
                Get started
              </a>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
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
        className="scroll-mt-28 border-t border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-20 md:px-10 lg:px-14"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">About Schooltype</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Built to connect every part of school life
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
            Schooltype helps schools move from scattered registers and chats to one trusted system —
            connecting people, attendance, academics, messaging, and payments under a single brand
            your staff and parents can rely on.
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {ABOUT_POINTS.map(({ Icon, title, body }) => (
              <div key={title}>
                <Icon className="h-7 w-7 text-sky-400" strokeWidth={1.75} />
                <h3 className="mt-4 font-display text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
            <div>
              <p className="font-display text-3xl font-bold text-white">Multi-tenant</p>
              <p className="mt-1 text-sm text-slate-400">Isolated school workspaces on one platform</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-white">End-to-end</p>
              <p className="mt-1 text-sm text-slate-400">People, attendance, academics & finance</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-white">Plan-ready</p>
              <p className="mt-1 text-sm text-slate-400">Starter to Enterprise feature packages</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-28 bg-slate-900/80 px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Features</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Everything your school needs in one system
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
            From student IDs and QR check-in to report cards, bulk messaging, and school wallets —
            Schooltype covers the daily tools administrators actually use.
          </p>

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

      {/* Plans */}
      <section
        id="plans"
        className="scroll-mt-28 border-t border-white/5 bg-gradient-to-b from-slate-950 to-slate-900 px-6 py-20 md:px-10 lg:px-14"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Plans</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Choose the package that matches your school
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
            Annual plans by school size. Pick the tier that matches your enrollment — billed once per year.
          </p>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">School Size</th>
                  <th className="px-4 py-3 font-semibold">Students</th>
                  <th className="px-4 py-3 font-semibold">Annual Cost (USD)</th>
                  <th className="px-4 py-3 font-semibold">Annual Cost (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {PLAN_LIST.map((plan) => (
                  <tr key={`row-${plan.id}`} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-medium text-white">{plan.name}</td>
                    <td className="px-4 py-3">{plan.sizeLabel}</td>
                    <td className="px-4 py-3">{formatPlanPriceUsd(plan)}</td>
                    <td className="px-4 py-3">{formatPlanPriceGhs(plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {PLAN_LIST.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col border-t-2 pt-6 ${
                  plan.highlighted ? 'border-sky-400' : 'border-white/15'
                }`}
              >
                {plan.highlighted && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Most popular
                  </p>
                )}
                <h3 className="font-display text-2xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm font-medium text-sky-300">{plan.sizeLabel}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.description}</p>
                <div className="mt-5 space-y-1">
                  <p className="font-display text-2xl font-bold text-white">{formatPlanPriceGhs(plan)}</p>
                  <p className="text-sm text-slate-400">{formatPlanPriceUsd(plan)} USD · per year</p>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" strokeWidth={2.5} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/signup?plan=${plan.id}`}
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? 'bg-sky-500 text-white hover:bg-sky-400'
                      : 'border border-white/20 text-white hover:border-white/40 hover:bg-white/5'
                  }`}
                >
                  Start with {plan.name}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Prefer the full comparison page?{' '}
            <Link to="/plans" className="font-medium text-sky-400 hover:text-sky-300">
              View plans
            </Link>
          </p>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-28 bg-slate-900 px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Security</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Built to keep school data authentic and protected
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
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
