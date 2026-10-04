import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";
import { useSession } from "@/lib/auth";
import {
  fetchAnalytics, invoiceTotals, money, customerName, todayISO, useDB, type SeriesPoint,
} from "@/services/store";

export const Route = createFileRoute("/")({
  head: () => meta("Dashboard", "Today's sales, revenue and stock alerts at a glance."),
  component: () => <AppShell module="dashboard"><Dashboard /></AppShell>,
});

/* ── Data hook (unchanged) ───────────────────────────────── */
function useRevenueSeries(): SeriesPoint[] {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  useEffect(() => {
    fetchAnalytics()
      .then((a) => setSeries(a.weekly))
      .catch((error: unknown) => console.error(error));
  }, []);
  return series;
}

/* ── Micro helpers ───────────────────────────────────────── */
function Ava({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  const hue = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
      background: `oklch(0.52 0.14 ${hue})`, color: "#fff", fontSize: 10, fontWeight: 700,
    }}>{initials || "?"}</span>
  );
}

function TUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function TDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

/* ── Custom tooltips ─────────────────────────────────────── */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: "oklch(0.175 0.032 266)", border: "1px solid oklch(0.30 0.035 265)",
  borderRadius: 10, padding: "8px 13px", fontSize: 12, color: "#fff",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

function RevTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ opacity: 0.55, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>{label}</p>
      <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{money(payload[0].value)}</p>
    </div>
  );
}

function BarTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ opacity: 0.55, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ display: "flex", alignItems: "center", gap: 5, margin: "2px 0", fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: p.fill, display: "inline-block" }} />
          <span style={{ opacity: 0.65, marginRight: 3 }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ── KPI card (compact) ──────────────────────────────────── */
interface KpiProps {
  label: string; value: React.ReactNode; hint?: string;
  color: string; softColor: string; icon: React.ReactNode; up?: boolean;
}
function Kpi({ label, value, hint, color, softColor, icon, up }: KpiProps) {
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
      gap: 12, position: "relative", overflow: "hidden",
      boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      transition: "transform 0.18s, box-shadow 0.18s",
    }}
      onMouseEnter={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.transform = "translateY(-2px)"; d.style.boxShadow = "0 6px 22px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ""; d.style.boxShadow = "0 1px 8px rgba(0,0,0,0.05)"; }}
    >
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: color, borderRadius: "14px 14px 0 0" }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: softColor, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--color-muted-foreground)", margin: 0 }}>{label}</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, lineHeight: 1.1, margin: "4px 0 0", color: "var(--color-foreground)" }}>{value}</p>
        {hint && (
          <p style={{ fontSize: 11, color: "var(--color-muted-foreground)", margin: "3px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
            {up !== undefined && <span style={{ color: up ? color : "oklch(0.577 0.225 25)", display: "flex" }}>{up ? <TUp /> : <TDown />}</span>}
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Panel (flex-column, fills grid cell) ────────────────── */
function Panel({ title, action, children, style }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
      boxShadow: "0 1px 8px rgba(0,0,0,0.05)", ...style,
    }}>
      {(title ?? action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px 8px", flexShrink: 0, borderBottom: "1px solid var(--color-border)" }}>
          {title && <h2 style={{ fontSize: 12.5, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted-foreground)" }}>{title}</h2>}
          {action}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Donut chart with centred label ──────────────────────── */
function DonutChart({ data, centerLabel }: { data: { name: string; value: number; color: string }[]; centerLabel: React.ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: "flex", height: "100%", alignItems: "center", gap: 0 }}>
      {/* Donut */}
      <div style={{ flex: "0 0 auto", width: "52%", height: "100%", position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%"
              innerRadius="52%" outerRadius="80%"
              dataKey="value" strokeWidth={0} paddingAngle={2}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color} opacity={active === null || active === i ? 1 : 0.45} />
              ))}
            </Pie>
            <Tooltip
              content={({ active: a, payload: p }) => {
                if (!a || !p?.length) return null;
                const item = p[0].payload as { name: string; value: number; color: string };
                return (
                  <div style={{ ...TOOLTIP_STYLE, padding: "7px 11px" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{item.name}</p>
                    <p style={{ margin: "2px 0 0", opacity: 0.65, fontSize: 11 }}>
                      {item.value} · {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {centerLabel}
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 14, display: "flex", flexDirection: "column", gap: 5 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 11.5, color: "var(--color-muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-foreground)" }}>{d.value}</span>
          </div>
        ))}
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted-foreground)" }}>Total</span>
          <span style={{ fontSize: 13, fontWeight: 900, fontFamily: "var(--font-display)" }}>{total}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Compact table row height ────────────────────────────── */
const TH: React.CSSProperties = { padding: "0 12px 7px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted-foreground)", textAlign: "left", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "6px 12px", fontSize: 12.5, borderTop: "1px solid var(--color-border)", verticalAlign: "middle" };

/* ═══════════════════════════════════════════════════════════ */

function Dashboard() {
  const db = useDB();
  const { user } = useSession();
  const revenueSeries = useRevenueSeries();
  const t = todayISO();

  /* ── All original data logic – untouched ── */
  const salesToday      = db.invoices.filter((invoice) => invoice.date === t);
  const revenueToday    = db.payments.filter((p) => p.date.slice(0, 10) === t && p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const outstanding     = db.invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft").reduce((s, i) => s + invoiceTotals(i, db).balance, 0);
  const lowStock        = db.products.filter((p) => p.status === "active" && p.quantity <= p.reorderLevel);
  const recentSales     = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  /* ── Derived display data ── */
  const invoicePie = [
    { name: "Paid",       value: db.invoices.filter((i) => i.status === "paid").length,           color: "oklch(0.60 0.16 150)" },
    { name: "Partial",    value: db.invoices.filter((i) => i.status === "partially_paid").length,  color: "oklch(0.72 0.16 62)"  },
    { name: "Unpaid",     value: db.invoices.filter((i) => i.status === "unpaid").length,          color: "oklch(0.577 0.225 25)" },
    { name: "Draft",      value: db.invoices.filter((i) => i.status === "draft").length,           color: "oklch(0.55 0.03 265)" },
    { name: "Cancelled",  value: db.invoices.filter((i) => i.status === "cancelled").length,       color: "oklch(0.72 0.02 265)" },
  ].filter((d) => d.value > 0);

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /* ── Layout constants ──
     Header = 57px, main py-3 = 12px×2 = 24px → overhead ≈ 81px
     Grid rows: header(auto ~40px) + kpi(auto ~68px) + 2×1fr + 3 gaps(10px) = ~130px fixed
     Each 1fr ≈ (100vh - 81px - 130px) / 2
  */
  return (
    <div style={{
      height: "calc(100vh - 82px)",
      display: "grid",
      gridTemplateRows: "auto auto 1fr 1fr",
      gap: 10,
      overflow: "hidden",
    }}>

      {/* ── Row 1: Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "var(--color-foreground)" }}>
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ fontSize: 11.5, color: "var(--color-muted-foreground)", margin: "2px 0 0" }}>
            {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            &ensp;·&ensp;
            {db.invoices.length} invoices total
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/customers/new">Add customer</Link></Button>
          <Button asChild size="sm" className="rounded-full"><Link to="/invoices">+ New sale</Link></Button>
        </div>
      </div>

      {/* ── Row 2: KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>
        <Kpi
          label="Sales today" value={salesToday.length}
          hint={`of ${db.customers.length} customers`} up={salesToday.length > 0}
          color="oklch(0.627 0.17 149)" softColor="oklch(0.94 0.05 150)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
        />
        <Kpi
          label="Collected today" value={money(revenueToday)}
          hint={revenueToday > 0 ? "Confirmed payments" : "No payments yet"} up={revenueToday > 0}
          color="oklch(0.769 0.166 70)" softColor="oklch(0.96 0.05 80)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <Kpi
          label="Outstanding" value={money(outstanding)}
          hint="Pending balance" up={outstanding === 0}
          color="oklch(0.577 0.225 25)" softColor="oklch(0.95 0.04 25)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
        />
        <Kpi
          label="Low stock alerts" value={lowStock.length}
          hint={lowStock.length === 0 ? "All levels healthy" : "Items need reorder"} up={lowStock.length === 0}
          color="oklch(0.685 0.145 237)" softColor="oklch(0.95 0.035 237)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.91 8.84 8.56 2.23a1 1 0 0 0-.96 0L3.1 4.13a1 1 0 0 0-.5.86v14a1 1 0 0 0 .5.86l4.5 2.52a1 1 0 0 0 .96 0L20.91 15.16a1 1 0 0 0 .5-.86V9.7a1 1 0 0 0-.5-.86z"/></svg>}
        />
      </div>

      {/* ── Row 3: Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 1fr", gap: 10, overflow: "hidden" }}>

        {/* Revenue area */}
        <Panel title="Revenue — This Week" action={
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "oklch(0.627 0.17 149)", background: "oklch(0.94 0.05 150)", padding: "2px 9px", borderRadius: 99 }}>7 days</span>
        }>
          <div style={{ height: "100%", padding: "8px 4px 4px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.627 0.17 149)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.627 0.17 149)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} dy={5} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} width={34} />
                <Tooltip content={<RevTip />} cursor={{ stroke: "oklch(0.627 0.17 149)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.627 0.17 149)" strokeWidth={2.5} fill="url(#rev2)" dot={false} activeDot={{ r: 4, fill: "oklch(0.627 0.17 149)", strokeWidth: 2, stroke: "var(--card)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Bar – sales volume */}
        <Panel title="Sales Volume">
          <div style={{ height: "calc(100% - 28px)", padding: "8px 4px 4px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="32%">
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} dy={5} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={22} />
                <Tooltip content={<BarTip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                <Bar dataKey="sales" stackId="a" name="Sales" fill="oklch(0.685 0.145 237)" radius={[0, 0, 3, 3]} />
                <Bar dataKey="newCustomers" stackId="a" name="New customers" fill="oklch(0.769 0.166 70)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 12, padding: "0 12px 8px", flexShrink: 0, justifyContent: "center" }}>
            {[{ c: "oklch(0.685 0.145 237)", l: "Sales" }, { c: "oklch(0.769 0.166 70)", l: "New cust." }].map((x) => (
              <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--color-muted-foreground)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: "inline-block" }} />{x.l}
              </span>
            ))}
          </div>
        </Panel>

        {/* Donut – invoice status */}
        <Panel title="Invoice Status">
          <div style={{ height: "100%", padding: "6px 0" }}>
            {invoicePie.length > 0 ? (
              <DonutChart
                data={invoicePie}
                centerLabel={
                  <>
                    <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--font-display)", lineHeight: 1 }}>{db.invoices.length}</span>
                    <span style={{ fontSize: 9, color: "var(--color-muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>Total</span>
                  </>
                }
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>No invoices yet</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Row 4: Tables ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10, overflow: "hidden" }}>

        {/* Recent Sales */}
        <Panel
          title="Recent Sales"
          action={<Link to="/invoices" style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.627 0.17 149)", textDecoration: "none" }}>View all →</Link>}
        >
          <div style={{ overflowY: "auto", height: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "22%" }} /><col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} /><col style={{ width: "22%" }} />
              </colgroup>
              <thead style={{ position: "sticky", top: 0, background: "var(--color-card)", zIndex: 1 }}>
                <tr>
                  <th style={TH}>Invoice</th>
                  <th style={TH}>Customer</th>
                  <th style={TH}>Date</th>
                  <th style={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((invoice) => {
                  const cust = db.customers.find((c) => c.id === invoice.customerId);
                  const name = customerName(cust);
                  return (
                    <tr key={invoice.id} style={{ transition: "background 0.12s" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-muted)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                    >
                      <td style={TD}>
                        <Link to="/invoices/$id" params={{ id: invoice.id }} style={{ fontWeight: 700, color: "oklch(0.627 0.17 149)", textDecoration: "none", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td style={TD}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Ava name={name} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, color: "var(--color-muted-foreground)", fontSize: 11.5 }}>
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td style={TD}><StatusBadge status={invoice.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Low Stock */}
        <Panel
          title="Low Stock Alerts"
          action={<Link to="/inventory" style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.627 0.17 149)", textDecoration: "none" }}>Inventory →</Link>}
        >
          {lowStock.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="oklch(0.627 0.17 149)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>All stock levels are healthy</p>
            </div>
          ) : (
            <div style={{ overflowY: "auto", height: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "55%" }} /><col style={{ width: "22%" }} /><col style={{ width: "23%" }} />
                </colgroup>
                <thead style={{ position: "sticky", top: 0, background: "var(--color-card)", zIndex: 1 }}>
                  <tr>
                    <th style={TH}>Item</th>
                    <th style={TH}>Qty</th>
                    <th style={TH}>Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-muted)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                      style={{ transition: "background 0.12s" }}
                    >
                      <td style={{ ...TD, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                      <td style={TD}><StatusBadge status={p.quantity === 0 ? "out" : "low"} text={String(p.quantity)} /></td>
                      <td style={{ ...TD, color: "var(--color-muted-foreground)", fontSize: 11.5 }}>{p.reorderLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
