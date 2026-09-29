import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { label } from "@/services/store";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const tone: Record<string, string> = {
  good: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning-foreground",
  bad: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  mute: "bg-muted text-muted-foreground",
};
const statusTone: Record<string, keyof typeof tone> = {
  active: "good", paid: "good", completed: "good", confirmed: "good", approved: "good",
  unpaid: "bad", rejected: "bad", cancelled: "bad", no_show: "bad", voided: "bad", disabled: "bad",
  partially_paid: "warn", partially_approved: "warn", waiting: "warn", draft: "mute", scheduled: "info",
  checked_in: "info", in_consultation: "info", submitted: "info", refunded: "mute", archived: "mute",
  discontinued: "mute", inactive: "mute", low: "warn", out: "bad",
};

export function StatusBadge({ status, text }: { status: string; text?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tone[statusTone[status] ?? "mute"])}>
      {text ?? label(status)}
    </span>
  );
}

export function Stat({ label: l, value, hint, accent = "brand" }: { label: string; value: ReactNode; hint?: string; accent?: "brand" | "accent" | "info" | "ink" }) {
  const bar = { brand: "bg-brand", accent: "bg-accent", info: "bg-info", ink: "bg-ink" }[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", bar)} />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{l}</p>
      <p className="stat-figure mt-2 text-3xl text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Field({ label: l, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium text-foreground">{l}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export const tableCls = "w-full text-sm [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2.5 [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/60";

export const selectCls = "h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
