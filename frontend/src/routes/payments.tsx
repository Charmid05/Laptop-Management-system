import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { jsPDF } from "jspdf";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, StatusBadge, Field, selectCls, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import {
  useDB,
  createRecord,
  deleteRecord,
  updateRecord,
  invoiceTotals,
  money,
  nextNumber,
  nowISO,
} from "@/services/store";
import { useSession } from "@/lib/auth";
import type { PaymentMethod } from "@/types";
import { Download, Printer, Receipt } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => meta("Payments", "Payments — Amani Eye practice manager."),
  component: () => (
    <AppShell module="payments">
      <Payments />
    </AppShell>
  ),
});

const methods: PaymentMethod[] = ["cash", "mpesa", "card", "bank_transfer", "insurance", "other"];

const formatReceiptLine = (label: string, value: string) => `${label}: ${value}`;

const createPrintableReceipt = (payment: any, patient: any, invoice: any, receiver: any, currency: string) => {
  const printWindow = window.open("", "_blank", "width=900,height=980");
  if (!printWindow) {
    toast.error("Your browser blocked the payment receipt window. Please allow pop-ups and try again.");
    return false;
  }

  const receiptHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Payment Receipt ${payment.receiptNumber}</title>
        <style>
          :root {
            --bg: #f8fafc;
            --panel: #ffffff;
            --ink: #0f172a;
            --muted: #475569;
            --line: #e2e8f0;
            --primary: #0f172a;
            --accent: #2563eb;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: var(--bg);
            color: var(--ink);
            padding: 28px;
          }
          .receipt {
            max-width: 760px;
            margin: 0 auto;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 20px;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
            color: white;
            padding: 28px 32px;
          }
          .header h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            letter-spacing: 0.03em;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
          }
          .body {
            padding: 28px 32px 18px;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px 22px;
            margin-bottom: 26px;
          }
          .meta-item {
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 12px 14px;
            background: #f8fafc;
          }
          .label {
            display: block;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 4px;
            font-weight: 700;
          }
          .value {
            font-size: 16px;
            font-weight: 700;
          }
          .patient-box {
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 16px 18px;
            margin-bottom: 24px;
            background: #f8fafc;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
            text-align: left;
          }
          th {
            color: var(--muted);
            font-size: 11px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .total {
            margin-top: 22px;
            display: grid;
            justify-items: end;
          }
          .total-box {
            min-width: 260px;
            border: 1px solid var(--line);
            border-radius: 12px;
            overflow: hidden;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 28px;
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 1px solid var(--line);
          }
          .total-row:last-child {
            border-bottom: none;
            background: #0f172a;
            color: white;
            font-size: 18px;
            font-weight: 800;
          }
          .foot {
            border-top: 1px dashed var(--line);
            margin-top: 28px;
            padding-top: 16px;
            color: var(--muted);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .receipt {
              box-shadow: none;
              border: none;
              border-radius: 0;
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>Amani Eye Practice</h1>
            <p>Payment receipt · Proof of payment</p>
          </div>

          <div class="body">
            <div class="meta">
              <div class="meta-item">
                <span class="label">Receipt</span>
                <span class="value">${payment.receiptNumber}</span>
              </div>
              <div class="meta-item">
                <span class="label">Date</span>
                <span class="value">${new Date(payment.date).toLocaleString()}</span>
              </div>
              <div class="meta-item">
                <span class="label">Method</span>
                <span class="value">${payment.method.replace(/_/g, " ")}</span>
              </div>
              <div class="meta-item">
                <span class="label">Received by</span>
                <span class="value">${receiver?.fullName ?? "Unknown"}</span>
              </div>
            </div>

            <div class="patient-box">
              <div class="label">Patient</div>
              <div class="value">${patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient"}</div>
              ${patient?.phone ? `<div style="margin-top:8px;color:#475569;">${patient.phone}</div>` : ""}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${invoice?.invoiceNumber ?? "Unknown invoice"}</td>
                  <td>${payment.reference || "—"}</td>
                  <td>${new Intl.NumberFormat("en-KE", {
                    style: "currency",
                    currency,
                    minimumFractionDigits: 2,
                  }).format(payment.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div class="total">
              <div class="total-box">
                <div class="total-row">
                  <span>Paid</span>
                  <span>${new Intl.NumberFormat("en-KE", {
                    style: "currency",
                    currency,
                    minimumFractionDigits: 2,
                  }).format(payment.amount)}</span>
                </div>
                <div class="total-row">
                  <span>Payment status</span>
                  <span>${payment.status}</span>
                </div>
              </div>
            </div>

            <div class="foot">
              <span>${payment.notes || "No additional notes"}</span>
              <span>Thank you for your payment.</span>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  setTimeout(() => printWindow.focus(), 300);
  setTimeout(() => printWindow.print(), 500);
  return true;
};

const downloadReceiptPdf = (payment: any, patient: any, invoice: any, receiver: any, currency: string) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 52;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 88, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Amani Eye Practice", margin, 42);
  doc.setFontSize(11);
  doc.text("Payment receipt · Proof of payment", margin, 66);

  doc.setTextColor(15, 23, 42);
  y = 118;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`Receipt ${payment.receiptNumber}`, margin, y);

  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const details = [
    formatReceiptLine("Date", new Date(payment.date).toLocaleString()),
    formatReceiptLine("Patient", patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient"),
    formatReceiptLine("Invoice", invoice?.invoiceNumber ?? "Unknown invoice"),
    formatReceiptLine("Method", payment.method.replace(/_/g, " ")),
    formatReceiptLine("Reference", payment.reference || "—"),
    formatReceiptLine("Received by", receiver?.fullName ?? "Unknown"),
    formatReceiptLine("Amount", new Intl.NumberFormat("en-KE", { style: "currency", currency, minimumFractionDigits: 2 }).format(payment.amount)),
  ];

  details.forEach((line) => {
    if (y > 760) {
      doc.addPage();
      y = 52;
    }
    doc.text(line, margin, y);
    y += 20;
  });

  y += 16;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Notes", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const noteText = payment.notes || "No additional notes";
  const noteLines = doc.splitTextToSize(noteText, pageWidth - margin * 2);
  doc.text(noteLines, margin, y);

  y += 28 + noteLines.length * 14;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, pageWidth - margin, y);

  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Thank you for your payment.", margin, y);

  doc.save(`${payment.receiptNumber}.pdf`);
};

function Payments() {
  const db = useDB();
  const { user } = useSession();
  const [showDialog, setShowDialog] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const invoicesWithBalance = db.invoices.filter(
    (invoice) =>
      !["draft", "cancelled", "refunded"].includes(invoice.status) &&
      invoiceTotals(invoice, db).balance > 0,
  );
  const selectedInvoice = db.invoices.find((invoice) => invoice.id === invoiceId);
  const selectedBalance = selectedInvoice ? invoiceTotals(selectedInvoice, db).balance : 0;
  const confirmedTotal = db.payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingTotal = db.invoices.reduce(
    (sum, invoice) => sum + invoiceTotals(invoice, db).balance,
    0,
  );
  const filteredPayments = [...db.payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((payment) => {
      const patient = db.patients.find((item) => item.id === payment.patientId);
      const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
      const matchesSearch =
        `${payment.receiptNumber} ${patient?.firstName ?? ""} ${patient?.lastName ?? ""} ${invoice?.invoiceNumber ?? ""} ${payment.reference ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      return (
        matchesSearch &&
        (statusFilter === "all" || payment.status === statusFilter) &&
        (methodFilter === "all" || payment.method === methodFilter)
      );
    });

  const resetForm = () => {
    setInvoiceId("");
    setAmount("");
    setMethod("cash");
    setReference("");
    setNotes("");
  };

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    const invoice = db.invoices.find((item) => item.id === invoiceId);
    if (!invoice || !user || !Number.isFinite(value) || value <= 0) {
      toast.error("Select an invoice and enter a valid payment amount");
      return;
    }
    const currentTotals = invoiceTotals(invoice, db);
    if (value > currentTotals.balance) {
      toast.error(
        `Payment exceeds the outstanding balance of ${money(currentTotals.balance, db.settings.currency)}`,
      );
      return;
    }

    setSaving(true);
    try {
      const receiptNumber = nextNumber(
        db.settings.receiptPrefix,
        db.payments.map((payment) => payment.receiptNumber),
      );
      await createRecord("payments", {
        receiptNumber,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: value,
        method,
        reference: reference.trim() || undefined,
        date: nowISO(),
        receivedBy: user.id,
        status: "confirmed",
        notes: notes.trim() || undefined,
      });
      const paidAfterPayment = currentTotals.paid + value;
      await updateRecord("invoices", invoice.id, {
        status: paidAfterPayment >= currentTotals.total ? "paid" : "partially_paid",
      });
      toast.success(`Payment recorded · ${receiptNumber}`);
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to record payment");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const payment = db.payments.find((item) => item.id === paymentId);
    const invoice = payment && db.invoices.find((item) => item.id === payment.invoiceId);
    if (!payment) return;
    if (!confirm(`Delete receipt ${payment.receiptNumber}? This cannot be undone.`)) return;

    try {
      await deleteRecord("payments", payment.id);
      if (invoice && payment.status === "confirmed") {
        const updatedTotals = invoiceTotals(invoice, {
          ...db,
          payments: db.payments.filter((item) => item.id !== payment.id),
        });
        const nextStatus =
          updatedTotals.paid === 0
            ? "unpaid"
            : updatedTotals.paid >= updatedTotals.total
              ? "paid"
              : "partially_paid";
        await updateRecord("invoices", invoice.id, { status: nextStatus });
      }
      toast.success("Payment deleted");
    } catch (error) {
      toast.error("Failed to delete payment");
      console.error(error);
    }
  };

  const handleReceiptPrint = (paymentId: string) => {
    const payment = db.payments.find((item) => item.id === paymentId);
    if (!payment) return;

    const patient = db.patients.find((item) => item.id === payment.patientId);
    const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
    const receiver = db.users.find((item) => item.id === payment.receivedBy);

    createPrintableReceipt(payment, patient, invoice, receiver, db.settings.currency);
  };

  const handleReceiptDownload = (paymentId: string) => {
    const payment = db.payments.find((item) => item.id === paymentId);
    if (!payment) return;

    const patient = db.patients.find((item) => item.id === payment.patientId);
    const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
    const receiver = db.users.find((item) => item.id === payment.receivedBy);

    downloadReceiptPdf(payment, patient, invoice, receiver, db.settings.currency);
    toast.success(`Receipt ${payment.receiptNumber} downloaded`);
  };

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`${db.payments.length} receipts recorded`}
        actions={
          <Button
            onClick={() => setShowDialog(true)}
            disabled={invoicesWithBalance.length === 0 || !user}
            className="rounded-full"
          >
            <Receipt className="size-4" /> Record payment
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Received"
          value={money(confirmedTotal, db.settings.currency)}
          hint="Confirmed payments"
          accent="accent"
        />
        <Stat
          label="Outstanding"
          value={money(outstandingTotal, db.settings.currency)}
          hint="Across open invoices"
          accent="ink"
        />
        <Stat
          label="Receipts"
          value={db.payments.length}
          hint={`${db.payments.filter((payment) => payment.status === "confirmed").length} confirmed`}
          accent="info"
        />
      </div>

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search receipt, invoice, patient..."
            aria-label="Search payments"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={selectCls}
            aria-label="Filter by payment status"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            className={selectCls}
            aria-label="Filter by payment method"
          >
            <option value="all">All methods</option>
            {methods.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {filteredPayments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search || statusFilter !== "all" || methodFilter !== "all"
              ? "No payments match these filters"
              : "No payments recorded"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Received by</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const patient = db.patients.find((item) => item.id === payment.patientId);
                  const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
                  const receiver = db.users.find((item) => item.id === payment.receivedBy);
                  return (
                    <tr key={payment.id}>
                      <td className="font-mono">{payment.receiptNumber}</td>
                      <td>{new Date(payment.date).toLocaleString()}</td>
                      <td>
                        {patient ? (
                          <Link
                            to="/patients/$id"
                            params={{ id: patient.id }}
                            className="font-semibold hover:underline"
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                      <td>{invoice?.invoiceNumber ?? "Unknown"}</td>
                      <td className="capitalize">{payment.method.replace(/_/g, " ")}</td>
                      <td>{payment.reference || "—"}</td>
                      <td className="font-semibold">
                        {money(payment.amount, db.settings.currency)}
                      </td>
                      <td>
                        <StatusBadge status={payment.status} />
                      </td>
                      <td>{receiver?.fullName ?? "Unknown"}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReceiptPrint(payment.id)}
                          >
                            <Printer className="size-3.5" /> Print
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReceiptDownload(payment.id)}
                          >
                            <Download className="size-3.5" /> PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleRecordPayment(event)} className="space-y-4">
            <Field label="Invoice *">
              <select
                value={invoiceId}
                onChange={(event) => {
                  setInvoiceId(event.target.value);
                  setAmount("");
                }}
                className={selectCls}
                required
              >
                <option value="">Select invoice</option>
                {invoicesWithBalance.map((invoice) => {
                  const patient = db.patients.find((item) => item.id === invoice.patientId);
                  const balance = invoiceTotals(invoice, db).balance;
                  return (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} · {patient?.firstName} {patient?.lastName} ·{" "}
                      {money(balance, db.settings.currency)}
                    </option>
                  );
                })}
              </select>
            </Field>
            {selectedInvoice && (
              <p className="text-sm text-muted-foreground">
                Balance due: {money(selectedBalance, db.settings.currency)}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount *">
                <Input
                  type="number"
                  min="0.01"
                  max={selectedBalance}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </Field>
              <Field label="Method *">
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  className={selectCls}
                >
                  {methods.map((item) => (
                    <option key={item} value={item}>
                      {item.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Reference">
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="M-Pesa code, card authorization, bank slip"
              />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !user}>
                {saving ? "Recording..." : "Record payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
