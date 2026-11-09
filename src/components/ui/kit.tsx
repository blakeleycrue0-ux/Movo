"use client";

import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, X, AlertCircle, CheckCircle2, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/app-context";
import { t } from "@/i18n";

/* ---------------------------------------------------------------- Button */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode; full?: boolean;
}>(function Button({ variant = "primary", size = "md", loading, icon, full, className, children, disabled, ...rest }, ref) {
  const v: Record<Variant, string> = {
    primary: "bg-ink text-white hover:bg-[#33363a] active:bg-black shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.12)]",
    secondary: "bg-card text-ink border border-line-strong hover:bg-[#fafafa] shadow-sm",
    soft: "bg-fill text-ink hover:bg-fill-strong",
    ghost: "text-ink hover:bg-fill",
    danger: "bg-pass text-white hover:brightness-95",
  };
  const s: Record<Size, string> = {
    sm: "h-9 px-3.5 text-[14px] gap-1.5",
    md: "h-11 px-5 text-[15px] gap-2",
    lg: "h-[52px] px-6 text-[16px] gap-2",
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        v[variant], s[size], full && "w-full", className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: "ghost" | "soft" | "solid" | "outline"; size?: number }>(
  function IconButton({ label, variant = "ghost", size = 40, className, children, ...rest }, ref) {
    const v = {
      ghost: "text-ink hover:bg-fill",
      soft: "bg-fill text-ink hover:bg-fill-strong",
      solid: "bg-ink text-white hover:bg-[#33363a]",
      outline: "bg-card border border-line-strong text-ink hover:bg-[#fafafa] shadow-sm",
    }[variant];
    return (
      <button ref={ref} aria-label={label} title={label}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40", v, className)}
        style={{ width: size, height: size }} {...rest}>
        {children}
      </button>
    );
  });

/* ---------------------------------------------------------------- Chips */
export function Chip({ children, tone = "neutral", className, icon }: { children: ReactNode; tone?: "neutral" | "connect" | "sun" | "info" | "pass" | "dark" | "outline"; className?: string; icon?: ReactNode }) {
  const tones = {
    neutral: "bg-fill text-ink",
    connect: "bg-connect-soft text-[#136b4a]",
    sun: "bg-sun-soft text-[#8a5a10]",
    info: "bg-info-soft text-[#245a94]",
    pass: "bg-pass-soft text-[#a3302b]",
    dark: "bg-ink text-white",
    outline: "border border-line-strong text-ink-2",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] font-medium", tones[tone], className)}>
      {icon}{children}
    </span>
  );
}

/** Toggleable chip used for multi-select options. */
export function ToggleChip({ selected, onToggle, children, disabled }: { selected: boolean; onToggle: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onToggle} disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition active:scale-[0.97] disabled:opacity-40",
        selected ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:border-ink/40",
      )}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Inputs */
export function Field({ label, hint, error, children, htmlFor, aside }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ink">{label}</label>
        {aside}
      </div>
      {children}
      {error ? <p className="flex items-center gap-1 text-[13px] text-pass" role="alert"><AlertCircle className="h-3.5 w-3.5" aria-hidden />{error}</p>
        : hint ? <p className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

const inputBase = "w-full rounded-2xl border border-line-strong bg-card px-4 text-[16px] text-ink placeholder:text-ink-3 outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/5 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, "h-12", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "min-h-[96px] resize-y py-3 leading-relaxed", className)} {...rest} />;
});

export function Select({ value, onChange, options, id, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string; ariaLabel?: string }) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputBase, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235f6368%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_14px_center] bg-no-repeat pr-10")}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ---------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({ value, onChange, options, label, layoutId }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; layoutId: string }) {
  return (
    <div role="tablist" aria-label={label} className="relative inline-flex rounded-full bg-fill p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cn("relative z-10 h-9 rounded-full px-4 text-[14px] font-semibold transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}>
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-full bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */
export function Spinner({ className, label = t.common.loading }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-ink-2", className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-ink shadow-sm hairline">{icon}</div>}
      <h3 className="text-[18px] text-ink text-balance">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[15px] text-ink-2 text-balance">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState icon={<AlertCircle className="h-6 w-6" />} title={t.common.errorTitle} body={message}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>{t.common.retry}</Button>} />
  );
}

/* ---------------------------------------------------------------- Sheet / dialog */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input,textarea,select,button:not([data-close])")?.focus());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.div className="absolute inset-0 bg-[rgba(20,22,26,0.32)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog" aria-modal="true" aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={cn("relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-card shadow-lg sm:rounded-[28px]", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-fill-strong sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
              <h2 id={titleId} className="text-[19px]">{title}</h2>
              <IconButton label={t.common.close} onClick={onClose} variant="soft" size={36} data-close><X className="h-4.5 w-4.5" /></IconButton>
            </div>
            <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
            {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, onConfirm, danger, busy }: {
  open: boolean; onClose: () => void; title: string; body: string; confirmLabel: string; onConfirm: () => void; danger?: boolean; busy?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[15px] text-ink-2">{body}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" full onClick={onClose}>{t.common.cancel}</Button>
        <Button variant={danger ? "danger" : "primary"} full onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Toasts & connection */
export function Toaster() {
  const { toasts, dismissToast, online } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }} aria-live="polite">
      <AnimatePresence>
        {!online && (
          <motion.div key="offline" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-white shadow-lg" role="status">
            <WifiOff className="h-4 w-4" aria-hidden /> {t.common.offline}
          </motion.div>
        )}
        {toasts.map((ts) => (
          <motion.div key={ts.id} layout initial={{ y: -16, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -12, opacity: 0, scale: 0.96 }}
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-card py-2.5 pl-3.5 pr-2 text-[14px] text-ink shadow-lg hairline">
            {ts.tone === "error" ? <AlertCircle className="h-4.5 w-4.5 shrink-0 text-pass" aria-hidden /> : ts.tone === "success" ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-connect" aria-hidden /> : null}
            <span className="flex-1">{ts.text}</span>
            {ts.action && <button className="rounded-full px-2.5 py-1 font-semibold hover:bg-fill" onClick={() => { ts.action!.onClick(); dismissToast(ts.id); }}>{ts.action.label}</button>}
            <button aria-label={t.common.close} className="rounded-full p-1 text-ink-2 hover:bg-fill" onClick={() => dismissToast(ts.id)}><X className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- Section header */
export function SectionHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[19px] text-ink">{title}</h2>
      {action}
    </div>
  );
}
