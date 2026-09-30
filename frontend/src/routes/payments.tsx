import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  updateRecord,
  invoiceTotals,
  money,
  nextNumber,
  nowISO,
} from "@/services/store";
import { useSession } from "@/lib/auth";
import type { PaymentMethod } from "@/types";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => meta("Payments", "Payments — Amani Eye practice manager."),
  component: () => (
    <AppShell module="payments">
      <Payments />
    </AppShell>
  ),
});

const methods: PaymentMethod[] = ["cash", "mpesa", "card", "bank_transfer", "insurance", "other"];

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

  const handleVoidPayment = async (paymentId: string) => {
    const payment = db.payments.find((item) => item.id === paymentId);
    const invoice = payment && db.invoices.find((item) => item.id === payment.invoiceId);
    if (!payment || !invoice || payment.status !== "confirmed") return;
    if (!confirm(`Void receipt ${payment.receiptNumber}?`)) return;

    try {
      await updateRecord("payments", payment.id, { status: "voided" });
      const paidAfterVoid = invoiceTotals(invoice, {
        ...db,
        payments: db.payments.map((item) =>
          item.id === payment.id ? { ...item, status: "voided" } : item,
        ),
      }).paid;
      const nextStatus =
        paidAfterVoid === 0
          ? "unpaid"
          : paidAfterVoid >= invoiceTotals(invoice, db).total
            ? "paid"
            : "partially_paid";
      await updateRecord("invoices", invoice.id, { status: nextStatus });
      toast.success("Payment voided");
    } catch (error) {
      toast.error("Failed to void payment");
      console.error(error);
    }
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
                        {payment.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleVoidPayment(payment.id)}
                          >
                            Void
                          </Button>
                        )}
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
