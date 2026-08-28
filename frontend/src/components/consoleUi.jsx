import { Search, Settings, ChevronDown } from 'lucide-react';

export function ConsoleHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-[1.85rem] font-bold leading-tight text-[#111827]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function ConsoleSearch({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b2]" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#d7deea] py-2.5 pl-10 pr-3 text-sm"
      />
    </div>
  );
}

export function ConsoleTabs({ tabs, value, onChange }) {
  return (
    <div className="console-tabs overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`console-tab shrink-0 ${value === tab.id ? 'is-active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ConsoleStatus({ tone = 'blue', label }) {
  const colors = {
    blue: '#2f6eff',
    orange: '#ff6a3c',
    green: '#16a34a',
    gray: '#9ca3af',
    black: '#111827',
  };
  return (
    <span className="console-status">
      <span className="console-status-dot" style={{ background: colors[tone] || colors.blue }} />
      {label}
    </span>
  );
}

export function ConsoleAvatar({ src, name, size = 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  if (src) {
    return <img src={src} alt="" className={`${dim} rounded-full object-cover`} />;
  }
  return (
    <span className={`inline-flex ${dim} items-center justify-center rounded-full bg-[#2f6eff]/15 text-xs font-bold text-[#2f6eff]`}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

export function ConsoleActions({ children }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1">
      {children || (
        <>
          <Settings className="h-4 w-4" />
          <ChevronDown className="h-4 w-4" />
        </>
      )}
    </div>
  );
}

export function ConsoleEmpty({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d7deea] bg-[#f8fafc] py-16 text-center">
      {Icon ? <Icon className="mx-auto mb-3 h-10 w-10 text-[#9aa3b2]" /> : null}
      <p className="font-medium text-[#111827]">{title}</p>
      {text ? <p className="mt-1 text-sm text-[#6b7280]">{text}</p> : null}
    </div>
  );
}

export function ConsoleModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {title ? <h2 className="mb-4 text-xl font-bold text-[#111827]">{title}</h2> : null}
        {children}
        {onClose ? (
          <button type="button" onClick={onClose} className="sr-only">
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ConsoleButton({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-[#2f6eff] text-white hover:bg-[#1f58e0]',
    orange: 'bg-[#ff6a3c] text-white hover:bg-[#ff5722]',
    ghost: 'border border-[#d7deea] bg-white text-[#111827] hover:bg-[#f8fafc]',
    dark: 'bg-[#111827] text-white hover:bg-black',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${styles[variant] || styles.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const consoleFieldClass =
  'w-full rounded-xl border border-[#d7deea] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none focus:border-[#2f6eff] focus:ring-2 focus:ring-[#2f6eff]/20';
