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

interface SupplierProductSale {
  key: string;
  supplierName: string;
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
  invoices: Set<string>;
  searchText: string;
}

interface ReportRecord {
  type: string;
  date?: string;
  record: string;
  details: string;
  status: string;
  value?: number;
  searchText: string;
}

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
  const [search, setSearch] = useState("");

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

  const supplierSalesByProduct = new Map<string, SupplierProductSale>();
  db.invoices
    .filter(
      (invoice) =>
        inDateRange(invoice.date) &&
        !["draft", "cancelled", "refunded"].includes(invoice.status),
    )
    .forEach((invoice) => {
      invoice.items.forEach((item) => {
        const product = db.products.find((candidate) => candidate.id === item.productId);
        const supplierId = item.supplierId || product?.supplierId;
        if (!product && !supplierId) return;

        const supplier = db.suppliers.find((candidate) => candidate.id === supplierId);
        const supplierName = supplier?.name ?? "Unassigned supplier";
        const productName = product?.name ?? item.description;
        const key = `${supplierId ?? "unassigned"}:${product?.id ?? item.description}`;
        const sale = supplierSalesByProduct.get(key) ?? {
          key,
          supplierName,
          productName,
          sku: product?.sku ?? "—",
          quantity: 0,
          revenue: 0,
          invoices: new Set<string>(),
          searchText: `${supplierName} ${productName} ${product?.sku ?? ""} ${product?.brand ?? ""} ${item.description}`.toLowerCase(),
        };
        sale.quantity += item.quantity;
        sale.revenue += item.quantity * item.unitPrice - item.discount;
        sale.invoices.add(invoice.id);
        supplierSalesByProduct.set(key, sale);
      });
    });

  const supplierSales = [...supplierSalesByProduct.values()]
    .map((sale) => ({ ...sale, invoiceCount: sale.invoices.size }))
    .filter((sale) => sale.searchText.includes(search.trim().toLowerCase()))
    .sort((a, b) => b.revenue - a.revenue);

  const reportRecords: ReportRecord[] = [];
  const addReportRecord = (
    type: string,
    date: string | undefined,
    record: string,
    details: string,
    status: string,
    value: number | undefined,
    searchable: unknown,
  ) => {
    reportRecords.push({
      type,
      date,
      record,
      details,
      status,
      value,
      searchText: `${type} ${record} ${details} ${status} ${JSON.stringify(searchable)}`.toLowerCase(),
    });
  };

  db.suppliers.forEach((supplier) =>
    addReportRecord(
      "Supplier",
      undefined,
      supplier.name,
      `${supplier.contactPerson} · ${supplier.phone} · ${supplier.email}`,
      "",
      undefined,
      supplier,
    ),
  );
  db.providers.forEach((provider) =>
    addReportRecord(
      "Insurance provider",
      undefined,
      provider.name,
      `${provider.code} · ${provider.contactPerson} · ${provider.phone}`,
      provider.status,
      undefined,
      provider,
    ),
  );
  db.users.forEach((staffMember) =>
    addReportRecord(
      "Team member",
      staffMember.createdAt,
      staffMember.fullName,
      `${staffMember.role.replace(/_/g, " ")} · ${staffMember.email} · ${staffMember.username}`,
      staffMember.status,
      undefined,
      staffMember,
    ),
  );
  db.products.forEach((product) => {
    const supplier = db.suppliers.find((item) => item.id === product.supplierId);
    addReportRecord(
      "Product",
      undefined,
      product.name,
      `${product.sku} · ${supplier?.name ?? "Unassigned supplier"} · ${product.quantity} in stock`,
      product.status,
      product.quantity * product.costPrice,
      { ...product, supplier: supplier?.name },
    );
  });
  db.patients.forEach((patient) =>
    addReportRecord(
      "Patient",
      patient.registeredAt,
      patientName(patient),
      `${patient.patientNumber} · ${patient.phone} · ${patient.email ?? ""}`,
      patient.status,
      undefined,
      patient,
    ),
  );
  db.invoices.forEach((invoice) => {
    const patient = db.patients.find((item) => item.id === invoice.patientId);
    const totals = invoiceTotals(invoice, db);
    addReportRecord(
      "Invoice",
      invoice.date,
      invoice.invoiceNumber,
      `${patientName(patient)} · ${invoice.items.map((item) => item.description).join(", ")}`,
      invoice.status,
      totals.total,
      { ...invoice, patient: patientName(patient) },
    );
    if (!["draft", "cancelled", "refunded"].includes(invoice.status)) {
      invoice.items.forEach((item) => {
        const product = db.products.find((candidate) => candidate.id === item.productId);
        const supplierId = item.supplierId || product?.supplierId;
        if (!product && !supplierId) return;
        const supplier = db.suppliers.find((candidate) => candidate.id === supplierId);
        addReportRecord(
          "Supplier product sale",
          invoice.date,
          product?.name ?? item.description,
          `${supplier?.name ?? "Unassigned supplier"} · ${product?.sku ?? "No SKU"} · ${invoice.invoiceNumber} · ${patientName(patient)} · ${item.quantity} units`,
          invoice.status,
          item.quantity * item.unitPrice - item.discount,
          { ...item, supplier: supplier?.name, product: product?.name, invoice: invoice.invoiceNumber },
        );
      });
    }
  });
  db.payments.forEach((payment) => {
    const patient = db.patients.find((item) => item.id === payment.patientId);
    const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
    addReportRecord(
      "Payment",
      payment.date,
      payment.receiptNumber,
      `${patientName(patient)} · ${invoice?.invoiceNumber ?? "Unknown invoice"} · ${payment.method}`,
      payment.status,
      payment.amount,
      { ...payment, patient: patientName(patient), invoice: invoice?.invoiceNumber },
    );
  });
  db.appointments.forEach((appointment) => {
    const patient = db.patients.find((item) => item.id === appointment.patientId);
    addReportRecord(
      "Appointment",
      appointment.date,
      patientName(patient),
      `${appointment.type.replace(/_/g, " ")} · ${appointment.reason}`,
      appointment.status,
      undefined,
      appointment,
    );
  });
  db.visits.forEach((visit) => {
    const patient = db.patients.find((item) => item.id === visit.patientId);
    addReportRecord(
      "Clinical visit",
      visit.date,
      visit.visitNumber,
      `${patientName(patient)} · ${visit.chiefComplaint.reason} · ${visit.findings}`,
      visit.status,
      undefined,
      visit,
    );
  });
  db.prescriptions.forEach((prescription) => {
    const patient = db.patients.find((item) => item.id === prescription.patientId);
    addReportRecord(
      "Prescription",
      prescription.date,
      prescription.prescriptionNumber,
      `${patientName(patient)} · ${prescription.lensType} · ${prescription.lensMaterial}`,
      "",
      undefined,
      prescription,
    );
  });
  db.stock.forEach((transaction) => {
    const product = db.products.find((item) => item.id === transaction.productId);
    const supplier = product && db.suppliers.find((item) => item.id === product.supplierId);
    addReportRecord(
      "Stock movement",
      transaction.date,
      product?.name ?? "Unknown product",
      `${transaction.type.replace(/_/g, " ")} · ${transaction.quantity} units · ${supplier?.name ?? "Unassigned supplier"} · ${transaction.reason}`,
      transaction.type,
      undefined,
      { ...transaction, product: product?.name, supplier: supplier?.name },
    );
  });
  db.claims.forEach((claim) => {
    const patient = db.patients.find((item) => item.id === claim.patientId);
    const provider = db.providers.find((item) => item.id === claim.providerId);
    const invoice = db.invoices.find((item) => item.id === claim.invoiceId);
    addReportRecord(
      "Insurance claim",
      claim.submittedAt ?? undefined,
      claim.claimNumber,
      `${patientName(patient)} · ${provider?.name ?? "Unknown provider"} · ${invoice?.invoiceNumber ?? "Unknown invoice"}`,
      claim.status,
      claim.claimedAmount,
      { ...claim, patient: patientName(patient), provider: provider?.name },
    );
  });
  db.audit.forEach((entry) => {
    const actor = db.users.find((item) => item.id === entry.userId);
    addReportRecord(
      "Audit activity",
      entry.timestamp,
      entry.action,
      `${entry.module} · ${entry.record} · ${entry.description} · ${actor?.fullName ?? "Unknown user"}`,
      "",
      undefined,
      entry,
    );
  });

  const matchingRecords = reportRecords
    .filter((record) => record.searchText.includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const inventoryValue = db.products.reduce(
    (sum, product) => sum + product.quantity * product.costPrice,
    0,
  );
  const lowStockCount = db.products.filter(
    (product) => product.quantity <= product.reorderLevel,
  ).length;

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
      ["Suppliers", db.suppliers.length],
      ["Products in catalog", db.products.length],
      ["Units in stock", db.products.reduce((sum, product) => sum + product.quantity, 0)],
      ["Inventory cost value", inventoryValue],
      ["Products at or below reorder level", lowStockCount],
      ["Search", search || "All records"],
      [],
      ["Supplier", "Product", "SKU", "Quantity sold", "Sales value", "Invoices"],
      ...supplierSales.map((sale) => [
        sale.supplierName,
        sale.productName,
        sale.sku,
        sale.quantity,
        sale.revenue,
        sale.invoiceCount,
      ]),
      [],
      ["Record type", "Date", "Record", "Details", "Status", "Value"],
      ...matchingRecords.map((record) => [
        record.type,
        record.date ?? "",
        record.record,
        record.details,
        record.status,
        record.value ?? "",
      ]),
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
          <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-medium">
            Search all records
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Supplier, product, patient, invoice, receipt..."
              aria-label="Search all report records"
            />
          </label>
          {(fromDate || toDate || search) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Panel>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <Stat
          label="Products in stock"
          value={db.products.reduce((sum, product) => sum + product.quantity, 0)}
          hint={`${db.products.length} catalog products`}
          accent="info"
        />
        <Stat
          label="Inventory cost value"
          value={money(inventoryValue, db.settings.currency)}
          hint="Current stock at recorded cost price"
          accent="brand"
        />
        <Stat
          label="Low stock products"
          value={lowStockCount}
          hint="At or below reorder level"
          accent="accent"
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

      <Panel
        title="Products sold by supplier"
        action={
          <span className="text-sm text-muted-foreground">
            {supplierSales.length} products · {money(
              supplierSales.reduce((sum, sale) => sum + sale.revenue, 0),
              db.settings.currency,
            )}
          </span>
        }
        className="mb-6"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Sales attributed to the supplier saved on each invoice item for the selected period.
        </p>
        {supplierSales.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No supplier product sales match this period and search.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Quantity sold</th>
                  <th>Invoices</th>
                  <th>Sales value</th>
                </tr>
              </thead>
              <tbody>
                {supplierSales.map((sale) => (
                  <tr key={sale.key}>
                    <td className="font-medium">{sale.supplierName}</td>
                    <td>{sale.productName}</td>
                    <td className="font-mono">{sale.sku}</td>
                    <td>{sale.quantity}</td>
                    <td>{sale.invoiceCount}</td>
                    <td className="font-semibold">
                      {money(sale.revenue, db.settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

      <Panel
        title="Search results across all records"
        action={
          <span className="text-sm text-muted-foreground">
            {matchingRecords.length.toLocaleString()} records
          </span>
        }
        className="mt-6"
      >
        {matchingRecords.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No records match your search.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Record</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {matchingRecords.slice(0, 100).map((record, index) => (
                  <tr key={`${record.type}-${record.record}-${record.date ?? "master"}-${index}`}>
                    <td>{record.type}</td>
                    <td className="whitespace-nowrap">
                      {record.date ? new Date(record.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="font-medium">{record.record}</td>
                    <td className="max-w-sm truncate" title={record.details}>
                      {record.details || "—"}
                    </td>
                    <td>{record.status ? <StatusBadge status={record.status} /> : "—"}</td>
                    <td className="whitespace-nowrap">
                      {record.value === undefined ? "—" : money(record.value, db.settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matchingRecords.length > 100 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Showing the first 100 records. Export CSV to get all {matchingRecords.length} matches.
              </p>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
