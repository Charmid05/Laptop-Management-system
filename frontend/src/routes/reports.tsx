import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, StatusBadge, selectCls, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import {
  useDB,
  fetchAnalytics,
  invoiceTotals,
  money,
  patientName,
  type SeriesPoint,
} from "@/services/store";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => meta("Reports", "Reports — Amani Eye practice manager."),
  component: () => (
    <AppShell module="reports">
      <Reports />
    </AppShell>
  ),
});

type RangeKey = "week" | "sixMonths";

const rangeStart = (range: RangeKey) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "week") {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - 5);
  }
  return start;
};

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function Reports() {
  const db = useDB();
  const [range, setRange] = useState<RangeKey>("week");
  const [series, setSeries] = useState<{ weekly: SeriesPoint[]; monthly: SeriesPoint[] } | null>(
    null,
  );
  const [analyticsError, setAnalyticsError] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    fetchAnalytics()
      .then((result) => {
        setSeries(result);
        setAnalyticsError(false);
      })
      .catch((error: unknown) => {
        setAnalyticsError(true);
        console.error(error);
      });
  }, []);

  const start = fromDate ? new Date(`${fromDate}T00:00:00`) : rangeStart(range);
  const end = toDate ? new Date(`${toDate}T23:59:59.999`) : new Date();
  const startTime = start.getTime();
  const endTime = end.getTime();
  const inDateRange = (value: string) => {
    const time = new Date(value.length === 10 ? `${value}T12:00:00` : value).getTime();
    return time >= startTime && time <= endTime;
  };

  const payments = db.payments.filter(
    (payment) => payment.status === "confirmed" && inDateRange(payment.date),
  );
  const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const visits = db.visits.filter((visit) => inDateRange(visit.date));
  const newPatients = db.patients.filter((patient) => inDateRange(patient.registeredAt));
  const invoicesInRange = db.invoices.filter((invoice) => inDateRange(invoice.date));
  const outstandingInvoices = db.invoices
    .map((invoice) => ({ invoice, balance: invoiceTotals(invoice, db).balance }))
    .filter(
      ({ invoice, balance }) =>
        balance > 0 && !["draft", "cancelled", "refunded"].includes(invoice.status),
    )
    .sort((a, b) => b.balance - a.balance);
  const paymentMethods = payments.reduce<Record<string, number>>((totals, payment) => {
    totals[payment.method] = (totals[payment.method] ?? 0) + payment.amount;
    return totals;
  }, {});
  const chartData = series ? (range === "week" ? series.weekly : series.monthly) : [];

  const handleDownload = () => {
    const rows: Array<Array<string | number>> = [
      ["Report", range === "week" ? "Last 7 days" : "Last 6 months"],
      ["From", start.toLocaleDateString()],
      ["To", end.toLocaleDateString()],
      [],
      ["Metric", "Value"],
      ["Confirmed revenue", revenue],
      ["Confirmed payments", payments.length],
      ["Visits", visits.length],
      ["New patients", newPatients.length],
      ["Invoices issued", invoicesInRange.length],
      [],
      ["Trend", "Revenue", "Visits", "New patients", "Returning visits"],
      ...chartData.map((point) => [
        point.label,
        point.revenue,
        point.visits,
        point.newPatients,
        point.returning,
      ]),
    ];
    downloadCsv(
      `amani-report-${range === "week" ? "weekly" : "six-months"}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Practice activity and financial performance"
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
            <Button onClick={handleDownload}>
              <Download className="size-4" /> Export CSV
            </Button>
          </>
        }
      />

      <Panel className="mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Reporting period
            <select
              value={range}
              onChange={(event) => {
                setRange(event.target.value as RangeKey);
                setFromDate("");
                setToDate("");
              }}
              className={selectCls}
            >
              <option value="week">Last 7 days</option>
              <option value="sixMonths">Last 6 months</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            From
            <Input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            To
            <Input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear dates
            </Button>
          )}
        </div>
      </Panel>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Confirmed revenue"
          value={money(revenue, db.settings.currency)}
          hint={`${payments.length} receipts in period`}
          accent="accent"
        />
        <Stat
          label="Clinical visits"
          value={visits.length}
          hint={`${visits.filter((visit) => visit.status === "completed").length} completed`}
          accent="info"
        />
        <Stat
          label="New patients"
          value={newPatients.length}
          hint="Registrations in period"
          accent="brand"
        />
        <Stat
          label="Outstanding balances"
          value={money(
            outstandingInvoices.reduce((sum, item) => sum + item.balance, 0),
            db.settings.currency,
          )}
          hint={`${outstandingInvoices.length} open invoices`}
          accent="ink"
        />
      </div>

      {analyticsError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Trend analytics could not be loaded. Summary figures remain available from current
          records.
        </p>
      )}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title={`Revenue · ${range === "week" ? "last 7 days" : "last 6 months"}`}>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip formatter={(value: number) => money(value, db.settings.currency)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    fill="url(#reportRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {analyticsError ? "No trend data available" : "Loading trend data..."}
            </p>
          )}
        </Panel>
        <Panel title="Visits and patient growth">
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="visits" name="Visits" fill="var(--info)" radius={[3, 3, 0, 0]} />
                  <Bar
                    dataKey="newPatients"
                    name="New patients"
                    fill="var(--accent)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity trend data available
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Collections by method">
          {Object.keys(paymentMethods).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No confirmed payments in this period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Receipts</th>
                    <th>Collected</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(paymentMethods)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, total]) => {
                      const count = payments.filter((payment) => payment.method === method).length;
                      return (
                        <tr key={method}>
                          <td className="capitalize">{method.replace(/_/g, " ")}</td>
                          <td>{count}</td>
                          <td className="font-semibold">{money(total, db.settings.currency)}</td>
                          <td>{revenue > 0 ? `${Math.round((total / revenue) * 100)}%` : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel
          title="Outstanding invoices"
          action={
            <span className="text-sm text-muted-foreground">
              {money(
                outstandingInvoices.reduce((sum, item) => sum + item.balance, 0),
                db.settings.currency,
              )}
            </span>
          }
        >
          {outstandingInvoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No outstanding invoices
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Patient</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.slice(0, 8).map(({ invoice, balance }) => (
                    <tr key={invoice.id}>
                      <td className="font-mono">{invoice.invoiceNumber}</td>
                      <td>
                        {patientName(
                          db.patients.find((patient) => patient.id === invoice.patientId),
                        )}
                      </td>
                      <td className="font-semibold">{money(balance, db.settings.currency)}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
