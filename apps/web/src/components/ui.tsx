import type { ButtonHTMLAttributes, ReactNode } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<string, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400',
  ghost: 'border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </header>
      <div className="space-y-3">{children}</div>
      {footer ? (
        <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">{footer}</div>
      ) : null}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none';

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </p>
  );
}

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'green' | 'amber';
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-700 text-slate-300',
    green: 'border-emerald-500/40 text-emerald-300',
    amber: 'border-amber-500/40 text-amber-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
