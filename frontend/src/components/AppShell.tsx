import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3, Boxes, ClipboardList, FileText, LayoutDashboard,
  LogOut, Menu, Receipt, Settings, ShoppingCart, Truck, Users, Wallet, Wrench, X,
} from "lucide-react";
import type { ModuleKey } from "@/types";
import { logout, useSession } from "@/lib/auth";
import { canAccess, useDB } from "@/services/store";
import { cn } from "@/lib/utils";

const nav: { to: string; label: string; icon: typeof Boxes; module: ModuleKey }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/customers", label: "Customers", icon: Users, module: "customers" },
  { to: "/invoices", label: "Sales", icon: FileText, module: "invoices" },
  { to: "/payments", label: "Payments", icon: Wallet, module: "payments" },
  { to: "/inventory", label: "Inventory", icon: Boxes, module: "inventory" },
  { to: "/stock", label: "Stock", icon: ClipboardList, module: "inventory" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, module: "suppliers" },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart, module: "purchases" },
  { to: "/service", label: "Repairs & warranty", icon: Wrench, module: "service" },
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

  if (!ready || !user || !db.ready) {
    return (
      <div style={{
        display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
        background: "var(--color-background)", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid var(--color-brand)", borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>Loading…</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const role = db.roles.find((r) => r.id === user.role);
  const allowed = canAccess(user.role, module);
  const initials = user.fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform print:hidden lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ borderRight: "1px solid var(--color-sidebar-border)" }}
      >
        {/* Brand */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--color-sidebar-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* TA shield mini logo */}
            <div style={{ flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(62,207,142,0.4))" }}>
              <svg width="34" height="37" viewBox="0 0 60 66" fill="none">
                <path d="M30 2L4 13V34C4 47.8 15.6 60.2 30 64C44.4 60.2 56 47.8 56 34V13L30 2Z" fill="url(#sb)" stroke="rgba(62,207,142,0.35)" strokeWidth="1" />
                <path d="M30 7L9 16.5V34C9 45.2 18.5 56 30 59.5C41.5 56 51 45.2 51 34V16.5L30 7Z" fill="rgba(255,255,255,0.06)" />
                <rect x="16" y="22" width="19" height="3" rx="1.5" fill="white" opacity="0.95" />
                <rect x="23.5" y="22" width="3" height="13" rx="1.5" fill="white" opacity="0.95" />
                <path d="M37 37L40.5 24H41.5L45 37" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" fill="none" />
                <line x1="38.3" y1="32.5" x2="43.7" y2="32.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95" />
                <defs>
                  <linearGradient id="sb" x1="30" y1="2" x2="30" y2="64" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3ecf8e" />
                    <stop offset="100%" stopColor="#1a7a50" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, lineHeight: 1, margin: 0, letterSpacing: "-0.01em" }}>
                <span style={{ color: "#fff" }}>TENSEI </span>
                <span style={{ color: "#3ecf8e" }}>ARK</span>
              </p>
              <p style={{ fontSize: 10, opacity: 0.45, margin: "3px 0 0", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {db.settings.storeName}
              </p>
            </div>
            <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" style={{ opacity: 0.6 }}>
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.filter((n) => canAccess(user.role, n.module)).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: n.to === "/" }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, fontSize: 13.5, fontWeight: 500, textDecoration: "none", transition: "background 0.15s, opacity 0.15s", opacity: 0.72, color: "inherit" }}
              activeProps={{
                style: {
                  background: "var(--color-sidebar-accent)", opacity: 1, fontWeight: 700,
                  color: "var(--color-sidebar-foreground)",
                } as React.CSSProperties,
              }}
            >
              <n.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
              {n.label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: "14px 14px 18px", borderTop: "1px solid var(--color-sidebar-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #3ecf8e, #1a7a50)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 0.5,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.fullName}</p>
              <p style={{ fontSize: 11, opacity: 0.5, margin: "2px 0 0" }}>{role?.name}</p>
            </div>
            <button
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              title="Sign out"
              style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 4, color: "inherit", transition: "opacity 0.15s", display: "flex" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.5")}
            >
              <LogOut style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64 print:pl-0">
        {/* Top bar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 20,
          display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(var(--background), 0.92)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          padding: "0 24px", height: 56,
        }} className="print:hidden">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>

          {/* Breadcrumb / date */}
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--color-muted-foreground)", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
          </span>

          {/* User pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "var(--color-muted)", borderRadius: 99,
            padding: "4px 12px 4px 6px", fontSize: 12.5, fontWeight: 600,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "linear-gradient(135deg, #3ecf8e, #1a7a50)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff",
            }}>
              {initials}
            </div>
            {user.fullName.split(" ")[0]}
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-4 py-3 md:px-6">
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
