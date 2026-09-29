import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, StatusBadge, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";
import { useSession } from "@/lib/auth";
import {
  fetchAnalytics, invoiceTotals, money, patientName, todayISO, useDB, type SeriesPoint,
} from "@/services/store";

export const Route = createFileRoute("/")({
  head: () => meta("Dashboard", "Today's appointments, queue, revenue and stock alerts at a glance."),
  component: () => <AppShell module="dashboard"><Dashboard /></AppShell>,
});

function useRevenueSeries(): SeriesPoint[] {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  useEffect(() => {
    fetchAnalytics()
      .then((a) => setSeries(a.weekly))
      .catch((error: unknown) => console.error(error));
  }, []);
  return series;
}

function Dashboard() {
  const db = useDB();
  const { user } = useSession();
  const revenueSeries = useRevenueSeries();
  const t = todayISO();
  const appts = db.appointments.filter((a) => a.date === t);
  const waiting = db.queue.filter((q) => q.date === t && (q.status === "waiting" || q.status === "checked_in"));
  const revenueToday = db.payments.filter((p) => p.date.slice(0, 10) === t && p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const outstanding = db.invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft").reduce((s, i) => s + invoiceTotals(i, db).balance, 0);
  const lowStock = db.products.filter((p) => p.status === "active" && p.quantity <= p.reorderLevel);
  const pName = (id: string) => patientName(db.patients.find((p) => p.id === id));

  return (
    <>
      <PageHeader
        title={`Good day, ${user?.fullName.split(" ").slice(-2, -1)[0] ?? ""}`}
        subtitle="Here's what's happening at the practice today."
        actions={<>
          <Button asChild variant="outline" className="rounded-full"><Link to="/patients/new">Register patient</Link></Button>
          <Button asChild className="rounded-full"><Link to="/appointments">Book appointment</Link></Button>
        </>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Appointments today" value={appts.length} hint={`${appts.filter((a) => a.status === "completed").length} completed`} />
        <Stat label="In the queue" value={waiting.length} hint="waiting or checked in" accent="info" />
        <Stat label="Collected today" value={money(revenueToday)} accent="accent" />
        <Stat label="Outstanding balances" value={money(outstanding)} hint={`${lowStock.length} stock alerts`} accent="ink" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Revenue this week" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="New vs returning">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={revenueSeries}>
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="returning" stackId="a" fill="var(--info)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="newPatients" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Today's appointments" action={<Link to="/appointments" className="text-sm font-semibold text-brand">View all</Link>}>
          <table className={tableCls}>
            <thead><tr><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {appts.sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
                <tr key={a.id}><td className="data-figure font-semibold">{a.time}</td><td>{pName(a.patientId)}</td><td className="text-muted-foreground">{a.reason}</td><td><StatusBadge status={a.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Low stock" action={<Link to="/inventory" className="text-sm font-semibold text-brand">Inventory</Link>}>
          <table className={tableCls}>
            <thead><tr><th>Item</th><th>In stock</th><th>Reorder at</th></tr></thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td><StatusBadge status={p.quantity === 0 ? "out" : "low"} text={String(p.quantity)} /></td><td>{p.reorderLevel}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
