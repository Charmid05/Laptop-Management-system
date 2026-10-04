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
  customerName,
  type SeriesPoint,
} from "@/services/store";
import { CalendarDays, Download, Printer, Search } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => meta("Reports", "Laptop store sales and inventory reports."),
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
  serialNumbers: Set<string>;
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
  serialNumbers?: string;
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
  const salesInRange = db.invoices.filter((invoice) => inDateRange(invoice.date));
  const newCustomers = db.customers.filter((customer) => inDateRange(customer.registeredAt));
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
        inDateRange(invoice.date) && !["draft", "cancelled", "refunded"].includes(invoice.status),
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
          serialNumbers: new Set<string>(),
          searchText:
            `${supplierName} ${productName} ${product?.sku ?? ""} ${product?.brand ?? ""} ${item.description}`.toLowerCase(),
        };
        sale.quantity += item.quantity;
        sale.revenue += item.quantity * item.unitPrice - item.discount;
        sale.invoices.add(invoice.id);
        item.serialNumbers?.forEach((serialNumber) =>
          sale.serialNumbers.add(serialNumber.toLowerCase()),
        );
        supplierSalesByProduct.set(key, sale);
      });
    });

  const supplierSales = [...supplierSalesByProduct.values()]
    .map((sale) => ({ ...sale, invoiceCount: sale.invoices.size }))
    .filter((sale) => {
      const query = search.trim().toLowerCase();
      return (
        sale.searchText.includes(query) ||
        [...sale.serialNumbers].some((serialNumber) => serialNumber.includes(query))
      );
    })
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
    serialNumbers?: string,
  ) => {
    reportRecords.push({
      type,
      date,
      record,
      details,
      status,
      value,
      searchText:
        `${type} ${record} ${details} ${status} ${JSON.stringify(searchable)} ${serialNumbers ?? ""}`.toLowerCase(),
      serialNumbers,
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
  db.customers.forEach((customer) =>
    addReportRecord(
      "Customer",
      customer.registeredAt,
      customerName(customer),
      `${customer.customerNumber} · ${customer.phone} · ${customer.email ?? ""}`,
      customer.status,
      undefined,
      customer,
    ),
  );
  db.invoices.forEach((invoice) => {
    const customer = db.customers.find((item) => item.id === invoice.customerId);
    const totals = invoiceTotals(invoice, db);
    const serialNumbers = invoice.items.flatMap((item) => item.serialNumbers ?? []).join(" ");
    addReportRecord(
      "Invoice",
      invoice.date,
      invoice.invoiceNumber,
      `${customerName(customer)} · ${invoice.items.map((item) => item.description).join(", ")}${serialNumbers ? ` · Serial: ${serialNumbers}` : ""}`,
      invoice.status,
      totals.total,
      { ...invoice, customer: customerName(customer), serialNumbers },
      serialNumbers,
    );
    if (!["draft", "cancelled", "refunded"].includes(invoice.status)) {
      invoice.items.forEach((item) => {
        const product = db.products.find((candidate) => candidate.id === item.productId);
        const supplierId = item.supplierId || product?.supplierId;
        if (!product && !supplierId) return;
        const supplier = db.suppliers.find((candidate) => candidate.id === supplierId);
        const itemSerialNumbers = item.serialNumbers?.join(" ") ?? "";
        addReportRecord(
          "Supplier product sale",
          invoice.date,
          product?.name ?? item.description,
          `${supplier?.name ?? "Unassigned supplier"} · ${product?.sku ?? "No SKU"} · ${invoice.invoiceNumber} · ${customerName(customer)} · ${item.quantity} units${itemSerialNumbers ? ` · Serial: ${itemSerialNumbers}` : ""}`,
          invoice.status,
          item.quantity * item.unitPrice - item.discount,
          {
            ...item,
            supplier: supplier?.name,
            product: product?.name,
            invoice: invoice.invoiceNumber,
            serialNumbers: itemSerialNumbers,
          },
          itemSerialNumbers,
        );
      });
    }
  });
  db.payments.forEach((payment) => {
    const customer = db.customers.find((item) => item.id === payment.customerId);
    const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
    addReportRecord(
      "Payment",
      payment.date,
      payment.receiptNumber,
      `${customerName(customer)} · ${invoice?.invoiceNumber ?? "Unknown invoice"} · ${payment.method}`,
      payment.status,
      payment.amount,
      { ...payment, customer: customerName(customer), invoice: invoice?.invoiceNumber },
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
      ["Sales", salesInRange.length],
      ["New customers", newCustomers.length],
      ["Invoices issued", invoicesInRange.length],
      ["Suppliers", db.suppliers.length],
      ["Products in catalog", db.products.length],
      ["Units in stock", db.products.reduce((sum, product) => sum + product.quantity, 0)],
      ["Inventory cost value", inventoryValue],
      ["Products at or below reorder level", lowStockCount],
      ["Search", search || "All records"],
      [],
      ["Supplier", "Product", "SKU", "Quantity sold", "Invoices", "Serial Numbers", "Sales value"],
      ...supplierSales.map((sale) => {
        const serialNumbersForSale = db.invoices
          .filter(
            (invoice) =>
              inDateRange(invoice.date) &&
              !["draft", "cancelled", "refunded"].includes(invoice.status) &&
              sale.invoices.has(invoice.id),
          )
          .flatMap((invoice) =>
            invoice.items
              .filter((item) => {
                const product = db.products.find((p) => p.id === item.productId);
                const supplierId = item.supplierId || product?.supplierId;
                const supplier = db.suppliers.find((s) => s.id === supplierId);
                return (
                  supplier?.name === sale.supplierName &&
                  (product?.name ?? item.description) === sale.productName
                );
              })
              .flatMap((item) => item.serialNumbers ?? []),
          )
          .join(", ");

        return [
          sale.supplierName,
          sale.productName,
          sale.sku,
          sale.quantity,
          sale.invoiceCount,
          serialNumbersForSale || "",
          sale.revenue,
        ];
      }),
      [],
      ["Record type", "Date", "Record", "Details", "Serial Numbers", "Status", "Value"],
      ...matchingRecords.map((record) => [
        record.type,
        record.date ?? "",
        record.record,
        record.details,
        record.serialNumbers ?? "",
        record.status,
        record.value ?? "",
      ]),
      [],
      ["Trend", "Revenue", "Sales", "New customers"],
      ...chartData.map((point) => [point.label, point.revenue, point.sales, point.newCustomers]),
    ];
    downloadCsv(
      `laptop-store-report-${range === "week" ? "weekly" : "six-months"}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Reports"
        subtitle="A clear overview of sales, collections and inventory performance."
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

      <Panel className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-info-soft text-info">
              <CalendarDays className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Report filters</h2>
              <p className="text-sm text-muted-foreground">
                Choose a period or search across your records.
              </p>
            </div>
          </div>
          {(fromDate || toDate || search) && (
            <Button
              variant="ghost"
              size="sm"
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr]">
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
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Search all records
            <span className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Supplier, product, customer, invoice, receipt, serial number..."
                aria-label="Search all report records"
              />
            </span>
          </label>
        </div>
      </Panel>

      <section aria-label="Key figures">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Key figures
          </h2>
          <span className="text-xs text-muted-foreground">
            {start.toLocaleDateString()} – {end.toLocaleDateString()}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Collected revenue"
            value={money(revenue, db.settings.currency)}
            hint={`${payments.length} confirmed payments`}
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
            accent="accent"
          />
        </div>
      </section>

      {analyticsError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Trend analytics could not be loaded. Summary figures remain available from current
          records.
        </p>
      )}

      <Panel
        title="Products sold by supplier"
        action={
          <span className="text-right text-sm text-muted-foreground">
            <span className="block font-semibold text-foreground">
              {supplierSales.length} products
            </span>
            {money(
              supplierSales.reduce((sum, sale) => sum + sale.revenue, 0),
              db.settings.currency,
            )}
          </span>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Sales attributed to the supplier saved on each invoice item for the selected period.
        </p>
        {supplierSales.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No supplier product sales match this period and search.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className={tableCls}>
              <thead className="bg-muted/50">
                <tr>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Quantity sold</th>
                  <th>Invoices</th>
                  <th>Serial numbers</th>
                  <th className="text-right">Sales value</th>
                </tr>
              </thead>
              <tbody>
                {supplierSales.map((sale) => {
                  const serialNumbersForSale = db.invoices
                    .filter(
                      (invoice) =>
                        inDateRange(invoice.date) &&
                        !["draft", "cancelled", "refunded"].includes(invoice.status) &&
                        sale.invoices.has(invoice.id),
                    )
                    .flatMap((invoice) =>
                      invoice.items
                        .filter((item) => {
                          const product = db.products.find((p) => p.id === item.productId);
                          const supplierId = item.supplierId || product?.supplierId;
                          const supplier = db.suppliers.find((s) => s.id === supplierId);
                          return (
                            supplier?.name === sale.supplierName &&
                            (product?.name ?? item.description) === sale.productName
                          );
                        })
                        .flatMap((item) => item.serialNumbers ?? []),
                    )
                    .join(", ");

                  return (
                    <tr key={sale.key}>
                      <td className="font-medium">{sale.supplierName}</td>
                      <td>{sale.productName}</td>
                      <td className="font-mono text-xs">{sale.sku}</td>
                      <td>{sale.quantity}</td>
                      <td>{sale.invoiceCount}</td>
                      <td
                        className="max-w-xs truncate font-mono text-xs"
                        title={serialNumbersForSale}
                      >
                        {serialNumbersForSale || "—"}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold">
                        {money(sale.revenue, db.settings.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Collections by method"
          action={
            <span className="text-sm font-semibold text-muted-foreground">
              {money(revenue, db.settings.currency)}
            </span>
          }
        >
          {Object.keys(paymentMethods).length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No confirmed payments in this period
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className={tableCls}>
                <thead className="bg-muted/50">
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
            <span className="text-sm font-semibold text-muted-foreground">
              {money(
                outstandingInvoices.reduce((sum, item) => sum + item.balance, 0),
                db.settings.currency,
              )}
            </span>
          }
        >
          {outstandingInvoices.length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No outstanding invoices
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className={tableCls}>
                <thead className="bg-muted/50">
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.slice(0, 8).map(({ invoice, balance }) => (
                    <tr key={invoice.id}>
                      <td className="font-mono text-xs">{invoice.invoiceNumber}</td>
                      <td>
                        {customerName(
                          db.customers.find((customer) => customer.id === invoice.customerId),
                        )}
                      </td>
                      <td className="whitespace-nowrap font-semibold">
                        {money(balance, db.settings.currency)}
                      </td>
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
    </div>
  );
}
