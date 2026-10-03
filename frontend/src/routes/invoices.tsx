import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, StatusBadge, tableCls, selectCls, Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import {
  useDB,
  patientName,
  createRecord,
  updateRecord,
  deleteRecord,
  nextNumber,
  todayISO,
  nowISO,
  invoiceTotals,
  money,
  uid,
} from "@/services/store";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Trash2, Receipt, Printer, Send } from "lucide-react";

export const Route = createFileRoute("/invoices")({
  head: () => meta("Invoices", "Invoices and billing — Amani Eye practice manager."),
  component: InvoiceRouteView,
});

function InvoiceRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/invoices" ? (
    <AppShell module="invoices">
      <Invoices />
    </AppShell>
  ) : (
    <Outlet />
  );
}

function Invoices() {
  const navigate = useNavigate();
  const db = useDB();
  const { user } = useSession();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedInvoicePatient, setSelectedInvoicePatient] = useState("");
  const [selectedInvoicePatientName, setSelectedInvoicePatientName] = useState("");
  const [includeTax, setIncludeTax] = useState(true);
  const [taxRate, setTaxRate] = useState(db.settings.taxRate);
  const [saving, setSaving] = useState(false);

  const invoices = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date));
  const filteredInvoices = invoices.filter((invoice) => {
    const patient = db.patients.find((item) => item.id === invoice.patientId);
    const matchesSearch =
      `${invoice.invoiceNumber} ${patientName(patient)} ${patient?.patientNumber ?? ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesSearch && (statusFilter === "all" || invoice.status === statusFilter);
  });
  const outstanding = invoices.reduce(
    (sum, invoice) => sum + invoiceTotals(invoice, db).balance,
    0,
  );
  const collected = db.payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const [newInvoice, setNewInvoice] = useState({
    patientId: "",
    items: [{ id: uid("ii"), description: "", productId: "", supplierId: "", quantity: 1, unitPrice: 0, discount: 0 }],
    notes: "",
  });

  const supplierOptions = db.suppliers;

  const filteredPatients = db.patients
    .filter(
      (p) =>
        p.status === "active" &&
        `${patientName(p)} ${p.patientNumber} ${p.phone}`
          .toLowerCase()
          .includes(patientSearch.toLowerCase()),
    )
    .slice(0, 8);

  const showPatientDropdown = patientSearch.length > 0 && !selectedInvoicePatient && filteredPatients.length > 0;

  const addInvoiceItem = () => {
    setNewInvoice({
      ...newInvoice,
      items: [
        ...newInvoice.items,
        { id: uid("ii"), description: "", productId: "", supplierId: "", quantity: 1, unitPrice: 0, discount: 0 },
      ],
    });
  };

  const updateInvoiceItemSupplier = (index: number, supplierId: string) => {
    const updated = [...newInvoice.items];
    updated[index] = {
      ...updated[index],
      supplierId,
      productId: "",
      description: "",
      unitPrice: 0,
    };
    setNewInvoice({ ...newInvoice, items: updated });
  };

  const updateInvoiceItemProduct = (index: number, productId: string) => {
    const selectedProduct = db.products.find((product) => product.id === productId);
    const updated = [...newInvoice.items];
    updated[index] = {
      ...updated[index],
      productId,
      description: selectedProduct?.name ?? updated[index].description,
      unitPrice: selectedProduct?.sellingPrice ?? updated[index].unitPrice,
    };
    setNewInvoice({ ...newInvoice, items: updated });
  };

  const removeInvoiceItem = (index: number) => {
    setNewInvoice({
      ...newInvoice,
      items: newInvoice.items.filter((_, i) => i !== index),
    });
  };

  const updateInvoiceItem = (index: number, field: string, value: string | number) => {
    const updated = [...newInvoice.items];
    updated[index] = { ...updated[index], [field]: value };
    setNewInvoice({ ...newInvoice, items: updated });
  };

  const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !user ||
      !newInvoice.patientId ||
      newInvoice.items.some(
        (item) =>
          !(item.productId || item.description.trim()) ||
          item.quantity <= 0 ||
          item.unitPrice <= 0 ||
          item.discount < 0 ||
          item.discount > item.quantity * item.unitPrice,
      )
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const invoiceNumber = nextNumber(
        db.settings.invoicePrefix,
        db.invoices.map((i) => i.invoiceNumber),
      );
      const invoice = await createRecord("invoices", {
        invoiceNumber,
        patientId: newInvoice.patientId,
        date: todayISO(),
        items: newInvoice.items,
        taxRate: includeTax ? taxRate : 0,
        status: "unpaid",
        notes: newInvoice.notes,
        createdBy: user.id,
        createdAt: nowISO(),
      });

      toast.success("Invoice created successfully");
      setShowNewDialog(false);
      setNewInvoice({
        patientId: "",
        items: [{ id: uid("ii"), description: "", productId: "", supplierId: "", quantity: 1, unitPrice: 0, discount: 0 }],
        notes: "",
      });
      setIncludeTax(true);
      setTaxRate(db.settings.taxRate);
      setPatientSearch("");
      navigate({ to: "/invoices/$id", params: { id: invoice.id } });
    } catch (error) {
      toast.error("Failed to create invoice");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvoice = async (id: string, number: string) => {
    if (!confirm(`Delete invoice ${number}? This action cannot be undone.`)) return;
    try {
      await deleteRecord("invoices", id);
      toast.success("Invoice deleted successfully");
    } catch (error) {
      toast.error("Failed to delete invoice");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total invoices`}
        actions={
          db.patients.some((patient) => patient.status === "active") ? (
            <Dialog
              open={showNewDialog}
              onOpenChange={(open) => {
                setShowNewDialog(open);
                if (!open) {
                  setPatientSearch("");
                  setSelectedInvoicePatient("");
                  setSelectedInvoicePatientName("");
                  setIncludeTax(true);
                  setTaxRate(db.settings.taxRate);
                  setNewInvoice({ patientId: "", items: [{ id: uid("ii"), description: "", productId: "", supplierId: "", quantity: 1, unitPrice: 0, discount: 0 }], notes: "" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="rounded-full" disabled={!user}>
                  <Plus className="mr-2 size-4" /> New invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create new invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={(event) => void handleCreateInvoice(event)} className="space-y-4">
                  <div className="relative">
                    <label className="text-sm font-medium">Patient *</label>
                    {selectedInvoicePatient ? (
                      <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                        <span className="flex-1 text-sm font-medium">{selectedInvoicePatientName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoicePatient("");
                            setSelectedInvoicePatientName("");
                            setNewInvoice({ ...newInvoice, patientId: "" });
                            setPatientSearch("");
                          }}
                          className="text-muted-foreground hover:text-destructive text-xs underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Type name, ID or phone..."
                          value={patientSearch}
                          onChange={(e) => {
                            setPatientSearch(e.target.value);
                            setNewInvoice({ ...newInvoice, patientId: "" });
                          }}
                          className="mt-1"
                          autoComplete="off"
                        />
                        {showPatientDropdown && (
                          <div className="absolute left-0 right-0 top-[4.5rem] z-50 overflow-hidden rounded-xl border bg-popover shadow-lg max-h-56 overflow-y-auto">
                            {filteredPatients.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInvoicePatient(p.id);
                                  setSelectedInvoicePatientName(patientName(p));
                                  setNewInvoice({ ...newInvoice, patientId: p.id });
                                  setPatientSearch("");
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b last:border-0"
                              >
                                <span className="font-medium">{patientName(p)}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{p.patientNumber} · {p.phone}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={includeTax}
                          onChange={(e) => setIncludeTax(e.target.checked)}
                        />
                        Include {db.settings.taxLabel}
                      </label>
                      {includeTax && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={taxRate}
                            onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Items *</label>
                      <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                        <Plus className="size-4" /> Add item
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {newInvoice.items.map((item, index) => {
                        const availableProducts = item.supplierId
                          ? db.products.filter(
                              (product) =>
                                product.status === "active" && product.supplierId === item.supplierId,
                            )
                          : [];

                        return (
                        <div
                          key={item.id}
                          className="rounded-lg border bg-muted/20 p-3"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Supplier">
                              <select
                                value={item.supplierId ?? ""}
                                onChange={(e) => updateInvoiceItemSupplier(index, e.target.value)}
                                className={selectCls}
                              >
                                <option value="">Select supplier</option>
                                {supplierOptions.map((supplier) => (
                                  <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Product">
                              <select
                                value={item.productId ?? ""}
                                onChange={(e) => updateInvoiceItemProduct(index, e.target.value)}
                                className={selectCls}
                                disabled={!item.supplierId}
                              >
                                <option value="">{item.supplierId ? "Select product" : "Select supplier first"}</option>
                                {availableProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} ({product.brand})
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_auto] items-end">
                            <div className="flex-1">
                              <Field label="Description">
                                <Input
                                  value={item.description}
                                  onChange={(e) =>
                                    updateInvoiceItem(index, "description", e.target.value)
                                  }
                                  placeholder="Service or product"
                                />
                              </Field>
                            </div>
                            <div className="w-20">
                              <Field label="Qty">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateInvoiceItem(
                                      index,
                                      "quantity",
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  min="1"
                                />
                              </Field>
                            </div>
                            <div className="w-28">
                              <Field label="Price">
                                <Input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateInvoiceItem(
                                      index,
                                      "unitPrice",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  min="0"
                                  step="0.01"
                                />
                              </Field>
                            </div>
                            <div className="w-20">
                              <Field label="Discount">
                                <Input
                                  type="number"
                                  value={item.discount}
                                  onChange={(e) =>
                                    updateInvoiceItem(
                                      index,
                                      "discount",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  min="0"
                                  step="0.01"
                                />
                              </Field>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeInvoiceItem(index)}
                              disabled={newInvoice.items.length === 1}
                              className="text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Notes">
                    <Textarea
                      value={newInvoice.notes}
                      onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                      rows={2}
                      placeholder="Optional notes for the invoice"
                    />
                  </Field>

                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    {(() => {
                      const subtotal = newInvoice.items.reduce(
                        (sum, item) => sum + item.quantity * item.unitPrice - item.discount,
                        0,
                      );
                      const tax = includeTax ? (subtotal * taxRate) / 100 : 0;
                      return (
                        <div className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1">
                          <span>Subtotal</span>
                          <span className="text-right">
                            {money(subtotal, db.settings.currency)}
                          </span>
                          {includeTax ? (
                            <>
                              <span>
                                {db.settings.taxLabel} ({taxRate}%)
                              </span>
                              <span className="text-right">{money(tax, db.settings.currency)}</span>
                            </>
                          ) : (
                            <>
                              <span>{db.settings.taxLabel}</span>
                              <span className="text-right">{money(0, db.settings.currency)}</span>
                            </>
                          )}
                          <span className="font-semibold">Total</span>
                          <span className="text-right font-semibold">
                            {money(subtotal + tax, db.settings.currency)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving || !user}>
                      {saving ? "Creating..." : "Create invoice"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/patients/new">
                <Plus className="mr-2 size-4" /> Register patient
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoices" value={invoices.length} hint="All recorded invoices" accent="info" />
        <Stat
          label="Collected"
          value={money(collected, db.settings.currency)}
          hint="Confirmed payments"
          accent="accent"
        />
        <Stat
          label="Outstanding"
          value={money(outstanding, db.settings.currency)}
          hint="Remaining balances"
          accent="ink"
        />
        <Stat
          label="Paid"
          value={invoices.filter((invoice) => invoice.status === "paid").length}
          hint="Fully settled invoices"
          accent="brand"
        />
      </div>

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search invoice or patient..."
            aria-label="Search invoices"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {filteredInvoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No invoices found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const patient = db.patients.find((p) => p.id === inv.patientId);
                  const totals = invoiceTotals(inv, db);
                  return (
                    <tr key={inv.id}>
                      <td className="font-mono">{inv.invoiceNumber}</td>
                      <td>
                        <Link
                          to="/patients/$id"
                          params={{ id: inv.patientId }}
                          className="font-semibold hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td>{money(totals.total, db.settings.currency)}</td>
                      <td>{money(totals.paid, db.settings.currency)}</td>
                      <td
                        className={
                          totals.balance > 0 ? "font-semibold text-destructive" : "text-success"
                        }
                      >
                        {money(totals.balance, db.settings.currency)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/invoices/$id" params={{ id: inv.id }}>
                              View
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
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
    </>
  );
}

export function InvoiceDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const db = useDB();
  const { user } = useSession();
  const [savingPayment, setSavingPayment] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mpesa" | "card" | "bank_transfer" | "insurance" | "other"
  >("cash");
  const [paymentReference, setPaymentReference] = useState("");

  const invoice = db.invoices.find((i) => i.id === id);
  if (!invoice) {
    return (
      <>
        <PageHeader title="Invoice not found" />
        <div className="text-center py-8">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button asChild className="mt-4">
            <Link to="/invoices">Back to invoices</Link>
          </Button>
        </div>
      </>
    );
  }

  const patient = db.patients.find((p) => p.id === invoice.patientId);
  const totals = invoiceTotals(invoice, db);
  const payments = db.payments.filter((p) => p.invoiceId === id && p.status === "confirmed");

  const openPaymentDialog = () => {
    setPaymentAmount(String(Math.max(0, totals.balance)));
    setShowPaymentDialog(true);
  };

  const handleAddPayment = async () => {
    const amount = Number(paymentAmount);
    if (!user || !Number.isFinite(amount) || amount <= 0 || amount > totals.balance) {
      toast.error(
        amount > totals.balance
          ? `Payment cannot exceed the balance of ${money(totals.balance, db.settings.currency)}`
          : "Please enter a valid payment amount",
      );
      return;
    }

    if (["cancelled", "refunded"].includes(invoice.status)) {
      toast.error("Reactivate this invoice before recording a payment");
      return;
    }

    setSavingPayment(true);
    try {
      const receiptNumber = nextNumber(
        db.settings.receiptPrefix,
        db.payments.map((p) => p.receiptNumber),
      );
      await createRecord("payments", {
        receiptNumber,
        invoiceId: id,
        patientId: invoice.patientId,
        amount,
        method: paymentMethod,
        reference: paymentReference || undefined,
        date: nowISO(),
        receivedBy: user.id,
        status: "confirmed",
        notes: "",
      });

      // Update invoice status based on payment
      const newTotalPaid = totals.paid + amount;
      await updateRecord("invoices", id, {
        status: newTotalPaid >= totals.total ? "paid" : "partially_paid",
      });

      toast.success("Payment recorded successfully");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentReference("");
    } catch (error) {
      toast.error("Failed to record payment");
      console.error(error);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await updateRecord("invoices", id, { status: newStatus });
      toast.success("Invoice status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${patientName(patient)} • ${new Date(invoice.date).toLocaleDateString()}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
              Back to invoices
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" /> Print
            </Button>
            {totals.balance > 0 && !["cancelled", "refunded"].includes(invoice.status) && (
              <Button
                onClick={openPaymentDialog}
                disabled={!user}
                className="rounded-full"
              >
                <Receipt className="mr-2 size-4" /> Record payment
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Invoice details">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patient:</span>
              <Link
                to="/patients/$id"
                params={{ id: invoice.patientId }}
                className="font-semibold hover:underline"
              >
                {patientName(patient)}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice #:</span>
              <span className="font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span>{new Date(invoice.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge status={invoice.status} />
            </div>
            {invoice.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes:</span>
                <span>{invoice.notes}</span>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Payment summary">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{money(totals.subtotal, db.settings.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {db.settings.taxLabel} ({db.settings.taxRate}%):
              </span>
              <span>{money(totals.tax, db.settings.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>{money(totals.total, db.settings.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid:</span>
              <span className="text-success">{money(totals.paid, db.settings.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>Balance:</span>
              <span className={totals.balance > 0 ? "text-destructive" : "text-success"}>
                {money(totals.balance, db.settings.currency)}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Line items" className="mt-6">
        <table className={tableCls}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Discount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unitPrice, db.settings.currency)}</td>
                <td>{money(item.discount, db.settings.currency)}</td>
                <td>
                  {money(item.quantity * item.unitPrice - item.discount, db.settings.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Payment history" className="mt-6">
        {payments.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No payments recorded</p>
        ) : (
          <table className={tableCls}>
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="font-mono">{payment.receiptNumber}</td>
                  <td>{new Date(payment.date).toLocaleDateString()}</td>
                  <td className="capitalize">{payment.method.replace(/_/g, " ")}</td>
                  <td>{money(payment.amount, db.settings.currency)}</td>
                  <td>{payment.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Actions" className="mt-6">
        <div className="flex flex-wrap gap-3">
          {invoice.status === "unpaid" && (
            <Button variant="outline" onClick={() => handleUpdateStatus("cancelled")}>
              Cancel invoice
            </Button>
          )}
          {invoice.status === "cancelled" && (
            <Button variant="outline" onClick={() => handleUpdateStatus("unpaid")}>
              Reactivate invoice
            </Button>
          )}
        </div>
      </Panel>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount *</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className={selectCls + " mt-1 w-full"}
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Reference (optional)</label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction reference"
                className="mt-1"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPayment}>Record payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
