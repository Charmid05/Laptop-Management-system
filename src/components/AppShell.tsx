import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3, Boxes, CalendarDays, ClipboardList, Eye, FileText, Glasses, LayoutDashboard,
  ListOrdered, LogOut, Menu, Receipt, Search, Settings, ShieldCheck, Truck, Users, Wallet, X,
} from "lucide-react";
import type { ModuleKey } from "@/types";
import { logout, useSession } from "@/lib/auth";
import { canAccess, patientName, useDB } from "@/services/store";
import { cn } from "@/lib/utils";

const nav: { to: string; label: string; icon: typeof Eye; module: ModuleKey }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/patients", label: "Patients", icon: Users, module: "patients" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, module: "appointments" },
  { to: "/queue", label: "Patient queue", icon: ListOrdered, module: "queue" },
  { to: "/clinical", label: "Clinical visits", icon: Eye, module: "clinical" },
  { to: "/prescriptions", label: "Prescriptions", icon: Glasses, module: "prescriptions" },
  { to: "/invoices", label: "Invoices", icon: FileText, module: "invoices" },
  { to: "/payments", label: "Payments", icon: Wallet, module: "payments" },
  { to: "/insurance", label: "Insurance claims", icon: ShieldCheck, module: "insurance" },
  { to: "/inventory", label: "Inventory", icon: Boxes, module: "inventory" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, module: "suppliers" },
  { to: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { to: "/admin", label: "Administration", icon: ClipboardList, module: "administration" },
  { to: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

export function AppShell({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { ready, user } = useSession();
  const navigate = useNavigate();
  const db = useDB();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  const role = db.roles.find((r) => r.id === user.role);
  const allowed = canAccess(user.role, module);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform print:hidden lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground"><Eye className="size-5" /></span>
          <div>
            <p className="font-display text-lg font-extrabold leading-none">{db.settings.practiceName}</p>
            <p className="text-xs opacity-60">Practice manager</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {nav.filter((n) => canAccess(user.role, n.module)).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-80 transition hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100 font-semibold [&>svg]:text-sidebar-primary" }}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="text-sm font-semibold">{user.fullName}</p>
          <p className="text-xs opacity-60">{role?.name}</p>
          <button
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            className="mt-3 flex items-center gap-2 text-xs opacity-70 hover:opacity-100"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur print:hidden md:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
          <PatientSearch />
          <span className="ml-auto hidden text-sm text-muted-foreground sm:block">
            {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          {allowed ? children : (
            <div className="mx-auto mt-20 max-w-md text-center">
              <Receipt className="mx-auto size-10 text-muted-foreground" />
              <h1 className="mt-4 text-2xl">No access</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your role ({role?.name}) can't open this module.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PatientSearch() {
  const db = useDB();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return db.patients.filter((p) =>
      `${patientName(p)} ${p.patientNumber} ${p.phone} ${p.nationalId ?? ""}`.toLowerCase().includes(s),
    ).slice(0, 6);
  }, [q, db.patients]);
  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search patients by name, number, phone or ID"
        className="h-9 w-full rounded-full border border-input bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {results.map((p) => (
            <Link key={p.id} to="/patients/$id" params={{ id: p.id }} onClick={() => setQ("")} className="flex justify-between px-4 py-2.5 text-sm hover:bg-muted">
              <span className="font-medium">{patientName(p)}</span>
              <span className="text-muted-foreground">{p.patientNumber}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
