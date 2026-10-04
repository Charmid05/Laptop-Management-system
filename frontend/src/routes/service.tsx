import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  Eye,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Field, PageHeader, Panel, Stat, StatusBadge, tableCls, selectCls } from "@/components/kit";
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
  createRecord,
  customerName,
  deleteRecord,
  label,
  money,
  nextNumber,
  nowISO,
  todayISO,
  updateRecord,
  useDB,
} from "@/services/store";
import { useSession } from "@/lib/auth";
import type { ServiceStatus, ServiceTicket } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/service")({
  head: () =>
    meta("Repairs & warranty", "Laptop repair intake, warranty checks, and service status."),
  component: () => (
    <AppShell module="service">
      <ServiceDesk />
    </AppShell>
  ),
});

const statuses: ServiceStatus[] = [
  "received",
  "diagnosing",
  "waiting_parts",
  "ready",
  "returned",
  "cancelled",
];
type TicketFilter = "all" | ServiceStatus | "warranty_active" | "warranty_expired";

const formatDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString();
const escapeHtml = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const escapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escapes[character] ?? character;
  });

type TicketForm = {
  customerId: string;
  productId: string;
  serialNumber: string;
  issue: string;
  warrantyUntil: string;
  estimatedCost: string;
  notes: string;
};

const emptyTicketForm = (): TicketForm => ({
  customerId: "",
  productId: "",
  serialNumber: "",
  issue: "",
  warrantyUntil: "",
  estimatedCost: "0",
  notes: "",
});

function warrantyState(ticket: ServiceTicket, today: string) {
  if (!ticket.warrantyUntil) return "unknown";
  return ticket.warrantyUntil >= today ? "active" : "expired";
}

function ServiceDesk() {
  const db = useDB();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketFilter>("all");
  const [viewingTicketId, setViewingTicketId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState<TicketForm>(emptyTicketForm);
  const [editForm, setEditForm] = useState<TicketForm>(emptyTicketForm);
  const today = todayISO();
  const tickets = useMemo(
    () =>
      [...db.serviceTickets].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)),
    [db.serviceTickets],
  );
  const editingTicket = tickets.find((ticket) => ticket.id === editingTicketId);
  const activeTickets = tickets.filter(
    (ticket) => !["returned", "cancelled"].includes(ticket.status),
  );
  const waitingTickets = tickets.filter((ticket) => ticket.status === "waiting_parts");
  const readyTickets = tickets.filter((ticket) => ticket.status === "ready");
  const coveredTickets = tickets.filter((ticket) => warrantyState(ticket, today) === "active");
  const expiredTickets = tickets.filter((ticket) => warrantyState(ticket, today) === "expired");
  const viewingTicket = tickets.find((ticket) => ticket.id === viewingTicketId);
  const selectedProduct = db.products.find((product) => product.id === form.productId);

  const customerSerialNumbers = useMemo(() => {
    if (!form.customerId || !form.productId) return [];
    return [
      ...new Set(
        db.invoices
          .filter(
            (invoice) =>
              invoice.customerId === form.customerId &&
              invoice.status !== "draft" &&
              invoice.status !== "cancelled" &&
              invoice.status !== "refunded",
          )
          .flatMap((invoice) => invoice.items)
          .filter((item) => item.productId === form.productId)
          .flatMap((item) => item.serialNumbers ?? [])
          .map((serialNumber) => serialNumber.trim())
          .filter(Boolean),
      ),
    ];
  }, [db.invoices, form.customerId, form.productId]);

  const linkedSale = useMemo(() => {
    const serialNumber = form.serialNumber.trim().toLowerCase();
    if (!form.customerId || !form.productId || !serialNumber) return undefined;
    return db.invoices
      .filter(
        (invoice) =>
          invoice.customerId === form.customerId &&
          invoice.status !== "draft" &&
          invoice.status !== "cancelled" &&
          invoice.status !== "refunded",
      )
      .sort((left, right) => right.date.localeCompare(left.date))
      .find((invoice) =>
        invoice.items.some(
          (item) =>
            item.productId === form.productId &&
            item.serialNumbers?.some((serial) => serial.trim().toLowerCase() === serialNumber),
        ),
      );
  }, [db.invoices, form.customerId, form.productId, form.serialNumber]);

  const filteredTickets = tickets.filter((ticket) => {
    const customer = db.customers.find((entry) => entry.id === ticket.customerId);
    const product = db.products.find((entry) => entry.id === ticket.productId);
    const searchable = [
      ticket.ticketNumber,
      ticket.serialNumber,
      ticket.issue,
      ticket.notes ?? "",
      customerName(customer),
      customer?.customerNumber ?? "",
      customer?.phone ?? "",
      product?.name ?? "",
      product?.sku ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchable.includes(search.trim().toLowerCase());
    const coverage = warrantyState(ticket, today);
    const matchesFilter =
      filter === "all" ||
      (filter === "warranty_active" && coverage === "active") ||
      (filter === "warranty_expired" && coverage === "expired") ||
      (statuses.includes(filter as ServiceStatus) && ticket.status === filter);
    return matchesSearch && matchesFilter;
  });

  const reset = () => setForm(emptyTicketForm());

  const startEditing = (ticket: ServiceTicket) => {
    setEditForm({
      customerId: ticket.customerId,
      productId: ticket.productId ?? "",
      serialNumber: ticket.serialNumber,
      issue: ticket.issue,
      warrantyUntil: ticket.warrantyUntil ?? "",
      estimatedCost: String(ticket.estimatedCost),
      notes: ticket.notes ?? "",
    });
    setEditingTicketId(ticket.id);
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticket = tickets.find((item) => item.id === editingTicketId);
    const estimatedCost = Number(editForm.estimatedCost);
    if (
      !ticket ||
      !editForm.customerId ||
      !editForm.issue.trim() ||
      !Number.isFinite(estimatedCost) ||
      estimatedCost < 0
    ) {
      toast.error("Choose a customer, describe the issue and enter a valid estimate");
      return;
    }

    setSavingEdit(true);
    try {
      await updateRecord("serviceTickets", ticket.id, {
        customerId: editForm.customerId,
        productId: editForm.productId,
        serialNumber: editForm.serialNumber.trim(),
        issue: editForm.issue.trim(),
        warrantyUntil: editForm.warrantyUntil,
        estimatedCost,
        notes: editForm.notes.trim(),
      });
      toast.success(`Ticket ${ticket.ticketNumber} updated`);
      setEditingTicketId(null);
    } catch (error) {
      toast.error("Could not update repair ticket");
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteTicket = async (ticket: ServiceTicket) => {
    if (!confirm(`Delete repair ticket ${ticket.ticketNumber}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteRecord("serviceTickets", ticket.id);
      toast.success(`Ticket ${ticket.ticketNumber} deleted`);
      if (viewingTicketId === ticket.id) setViewingTicketId(null);
    } catch (error) {
      toast.error("Could not delete repair ticket");
      console.error(error);
    }
  };

  const printTicket = (ticket: ServiceTicket) => {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      toast.error("Your browser blocked the print window. Please allow pop-ups and try again.");
      return;
    }
    const customer = db.customers.find((entry) => entry.id === ticket.customerId);
    const product = db.products.find((entry) => entry.id === ticket.productId);
    const warranty = ticket.warrantyUntil
      ? formatDate(ticket.warrantyUntil)
      : "Expiry not recorded";
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html><head><meta charset="UTF-8"><title>Repair ${escapeHtml(ticket.ticketNumber)}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;padding:36px;background:#f5f7fa;color:#172033;font:14px Arial,sans-serif}
        main{max-width:700px;margin:auto;background:#fff;border:1px solid #dfe5ec;border-radius:16px;overflow:hidden}
        header{padding:28px 32px;background:linear-gradient(120deg,#172033,#245b79);color:white}
        header small{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
        h1{margin:9px 0 0;font-size:25px}section{padding:26px 32px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px}
        .item{padding:13px;border:1px solid #e3e8ef;border-radius:10px;background:#fafbfd}
        .label{display:block;margin-bottom:6px;color:#637083;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
        .value{font-weight:700;white-space:pre-wrap;overflow-wrap:anywhere}
        .wide{margin-top:18px}.footer{margin-top:26px;padding-top:16px;border-top:1px solid #e3e8ef;color:#637083;font-size:11px}
        @media print{body{padding:0;background:white}main{border:0;border-radius:0}}
      </style></head><body><main>
      <header><small>Repairs & warranty</small><h1>Ticket ${escapeHtml(ticket.ticketNumber)}</h1></header>
      <section><div class="grid">
        <div class="item"><span class="label">Customer</span><span class="value">${escapeHtml(customerName(customer))}</span>${customer?.phone ? `<div>${escapeHtml(customer.phone)}</div>` : ""}</div>
        <div class="item"><span class="label">Device / serial</span><span class="value">${escapeHtml(product?.name ?? "Other device")} · ${escapeHtml(ticket.serialNumber || "No serial number")}</span></div>
        <div class="item"><span class="label">Received</span><span class="value">${escapeHtml(new Date(ticket.receivedAt).toLocaleString())}</span></div>
        <div class="item"><span class="label">Status</span><span class="value">${escapeHtml(label(ticket.status))}</span></div>
        <div class="item"><span class="label">Warranty valid through</span><span class="value">${escapeHtml(warranty)}</span></div>
        <div class="item"><span class="label">Estimated repair cost</span><span class="value">${escapeHtml(money(ticket.estimatedCost, db.settings.currency))}</span></div>
      </div>
      <div class="item wide"><span class="label">Reported issue</span><span class="value">${escapeHtml(ticket.issue)}</span></div>
      <div class="item wide"><span class="label">Technician notes</span><span class="value">${escapeHtml(ticket.notes || "No notes recorded.")}</span></div>
      <div class="footer">Printed ${escapeHtml(new Date().toLocaleString())}</div>
      </section></main><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
    printWindow.document.close();
  };

  const downloadTicket = (ticket: ServiceTicket) => {
    const customer = db.customers.find((entry) => entry.id === ticket.customerId);
    const product = db.products.find((entry) => entry.id === ticket.productId);
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 52;
    doc.setFillColor(23, 32, 51);
    doc.rect(0, 0, pageWidth, 88, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.text(`Repair ${ticket.ticketNumber}`, margin, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Repairs & warranty service ticket", margin, 65);
    doc.setTextColor(23, 32, 51);
    y = 126;
    const details: [string, string][] = [
      ["Customer", customerName(customer)],
      ["Phone", customer?.phone || "No phone recorded"],
      ["Device", product?.name ?? "Other device"],
      ["Serial number", ticket.serialNumber || "No serial number"],
      ["Received", new Date(ticket.receivedAt).toLocaleString()],
      ["Status", label(ticket.status)],
      [
        "Warranty valid through",
        ticket.warrantyUntil ? formatDate(ticket.warrantyUntil) : "Expiry not recorded",
      ],
      ["Estimated repair cost", money(ticket.estimatedCost, db.settings.currency)],
    ];
    doc.setFontSize(11);
    for (const [name, value] of details) {
      if (y > 760) {
        doc.addPage();
        y = 52;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${name}:`, margin, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, pageWidth - margin * 2 - 130);
      doc.text(lines, margin + 130, y);
      y += Math.max(20, lines.length * 14);
    }
    for (const [heading, value] of [
      ["Reported issue", ticket.issue],
      ["Technician notes", ticket.notes || "No notes recorded."],
    ]) {
      if (y + 32 > 760) {
        doc.addPage();
        y = 52;
      }
      y += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(heading, margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(value, pageWidth - margin * 2);
      for (const line of lines) {
        if (y > 760) {
          doc.addPage();
          y = 52;
        }
        doc.text(line, margin, y);
        y += 15;
      }
    }
    doc.save(`${ticket.ticketNumber}.pdf`);
    toast.success(`Ticket ${ticket.ticketNumber} downloaded`);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const estimatedCost = Number(form.estimatedCost);
    if (
      !user ||
      !form.customerId ||
      !form.issue.trim() ||
      !Number.isFinite(estimatedCost) ||
      estimatedCost < 0
    ) {
      toast.error("Choose a customer, describe the issue and enter a valid estimate");
      return;
    }
    setSaving(true);
    try {
      await createRecord("serviceTickets", {
        ticketNumber: nextNumber(
          "SRV-",
          db.serviceTickets.map((ticket) => ticket.ticketNumber),
        ),
        customerId: form.customerId,
        ...(form.productId ? { productId: form.productId } : {}),
        serialNumber: form.serialNumber.trim(),
        issue: form.issue.trim(),
        ...(form.warrantyUntil ? { warrantyUntil: form.warrantyUntil } : {}),
        estimatedCost,
        status: "received",
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        receivedAt: nowISO(),
        createdBy: user.id,
      });
      toast.success("Repair ticket opened");
      setOpen(false);
      reset();
    } catch {
      toast.error("Could not open repair ticket");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: ServiceStatus) => {
    try {
      await updateRecord("serviceTickets", id, { status });
      toast.success("Repair status updated");
    } catch {
      toast.error("Could not update repair status");
    }
  };

  const openForm = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  return (
    <>
      <PageHeader
        title="Repairs & warranty"
        subtitle={`${activeTickets.length} active repair${activeTickets.length === 1 ? "" : "s"} · ${tickets.length} total tickets`}
        actions={
          <Dialog open={open} onOpenChange={openForm}>
            <DialogTrigger asChild>
              <Button
                disabled={!user || !db.customers.some((customer) => customer.status === "active")}
              >
                <Plus className="mr-2 size-4" /> New repair ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Open repair ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={(event) => void submit(event)} className="space-y-4">
                <Field label="Customer *">
                  <select
                    required
                    className={selectCls}
                    value={form.customerId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customerId: event.target.value,
                        productId: "",
                        serialNumber: "",
                      })
                    }
                  >
                    <option value="">Select customer</option>
                    {db.customers
                      .filter((customer) => customer.status === "active")
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customerName(customer)}
                          {customer.phone ? ` · ${customer.phone}` : ""}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Product">
                  <select
                    className={selectCls}
                    value={form.productId}
                    onChange={(event) =>
                      setForm({ ...form, productId: event.target.value, serialNumber: "" })
                    }
                  >
                    <option value="">Other / not in catalog</option>
                    {db.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.sku}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Serial number">
                  <Input
                    list="customer-device-serials"
                    value={form.serialNumber}
                    onChange={(event) => setForm({ ...form, serialNumber: event.target.value })}
                    placeholder={
                      customerSerialNumbers.length
                        ? "Select or enter serial number"
                        : "Enter serial number"
                    }
                  />
                  <datalist id="customer-device-serials">
                    {customerSerialNumbers.map((serialNumber) => (
                      <option key={serialNumber} value={serialNumber} />
                    ))}
                  </datalist>
                  {linkedSale && (
                    <span className="text-xs text-success">
                      Matched to {linkedSale.invoiceNumber}, sold {formatDate(linkedSale.date)}.
                    </span>
                  )}
                </Field>
                <Field label="Reported issue *">
                  <Textarea
                    required
                    rows={3}
                    value={form.issue}
                    onChange={(event) => setForm({ ...form, issue: event.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Warranty valid through">
                    <Input
                      type="date"
                      value={form.warrantyUntil}
                      onChange={(event) => setForm({ ...form, warrantyUntil: event.target.value })}
                    />
                  </Field>
                  <Field label="Estimated repair cost">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.estimatedCost}
                      onChange={(event) => setForm({ ...form, estimatedCost: event.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  {linkedSale
                    ? `${selectedProduct?.name ?? "This device"} is linked to a recorded sale. Enter the warranty expiry from the customer's proof of purchase.`
                    : "Warranty expiry is recorded from the customer's proof of purchase; no warranty duration is assumed."}
                </p>
                <Field label="Technician notes">
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => openForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !user}>
                    {saving ? "Saving..." : "Open ticket"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active repairs"
          value={activeTickets.length}
          hint="Not yet returned or cancelled"
          accent="brand"
        />
        <Stat
          label="Waiting for parts"
          value={waitingTickets.length}
          hint="Repairs currently blocked"
          accent="accent"
        />
        <Stat
          label="Ready for pickup"
          value={readyTickets.length}
          hint="Completed and awaiting customer"
          accent="info"
        />
        <Stat
          label="In warranty"
          value={coveredTickets.length}
          hint={`${expiredTickets.length} ticket warranties expired`}
          accent="ink"
        />
      </div>

      <Panel
        title="Repair queue"
        action={
          <span className="text-sm text-muted-foreground">
            {filteredTickets.length} ticket{filteredTickets.length === 1 ? "" : "s"}
          </span>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ticket, customer, product, serial or issue"
              aria-label="Search repair tickets"
            />
          </div>
          <select
            className={selectCls}
            aria-label="Filter repair tickets"
            value={filter}
            onChange={(event) => setFilter(event.target.value as TicketFilter)}
          >
            <option value="all">All tickets</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
            <option value="warranty_active">In warranty</option>
            <option value="warranty_expired">Warranty expired</option>
          </select>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="py-12 text-center">
            <Wrench className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {tickets.length === 0
                ? "No repair tickets yet. Open a ticket when a device is received."
                : "No repair tickets match these filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Ticket / received</th>
                  <th>Customer</th>
                  <th>Device / serial</th>
                  <th>Reported issue</th>
                  <th>Warranty</th>
                  <th>Estimate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const customer = db.customers.find((entry) => entry.id === ticket.customerId);
                  const product = db.products.find((entry) => entry.id === ticket.productId);
                  const coverage = warrantyState(ticket, today);
                  return (
                    <tr key={ticket.id}>
                      <td className="whitespace-nowrap">
                        <span className="block font-mono">{ticket.ticketNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(ticket.receivedAt)}
                        </span>
                      </td>
                      <td>
                        <span className="block">{customerName(customer)}</span>
                        {customer?.phone && (
                          <span className="text-xs text-muted-foreground">{customer.phone}</span>
                        )}
                      </td>
                      <td>
                        <span className="block">{product?.name ?? "Other device"}</span>
                        {ticket.serialNumber && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {ticket.serialNumber}
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs">
                        <span className="block truncate" title={ticket.issue}>
                          {ticket.issue}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {coverage === "active" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <ShieldCheck className="size-3.5" /> Until{" "}
                            {formatDate(ticket.warrantyUntil!)}
                          </span>
                        ) : coverage === "expired" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <AlertTriangle className="size-3.5" /> Expired{" "}
                            {formatDate(ticket.warrantyUntil!)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {money(ticket.estimatedCost, db.settings.currency)}
                      </td>
                      <td>
                        <select
                          aria-label={`Status for ${ticket.ticketNumber}`}
                          className="h-9 rounded-md border bg-background px-2 text-sm capitalize"
                          value={ticket.status}
                          onChange={(event) =>
                            void updateStatus(ticket.id, event.target.value as ServiceStatus)
                          }
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {label(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Edit ticket"
                            aria-label={`Edit ticket ${ticket.ticketNumber}`}
                            onClick={() => startEditing(ticket)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Download ticket PDF"
                            aria-label={`Download ticket ${ticket.ticketNumber}`}
                            onClick={() => downloadTicket(ticket)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Print ticket"
                            aria-label={`Print ticket ${ticket.ticketNumber}`}
                            onClick={() => printTicket(ticket)}
                          >
                            <Printer className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Delete ticket"
                            aria-label={`Delete ticket ${ticket.ticketNumber}`}
                            className="text-destructive"
                            onClick={() => void deleteTicket(ticket)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingTicketId(ticket.id)}
                          >
                            <Eye className="size-3.5" />
                            <span className="ml-1">View</span>
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
        open={Boolean(editingTicket)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTicketId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTicket ? `Edit ${editingTicket.ticketNumber}` : "Edit repair ticket"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void saveEdit(event)} className="space-y-4">
            <Field label="Customer *">
              <select
                required
                className={selectCls}
                value={editForm.customerId}
                onChange={(event) => setEditForm({ ...editForm, customerId: event.target.value })}
              >
                <option value="">Select customer</option>
                {db.customers
                  .filter(
                    (customer) =>
                      customer.status === "active" || customer.id === editingTicket?.customerId,
                  )
                  .map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerName(customer)}
                      {customer.phone ? ` · ${customer.phone}` : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Product">
              <select
                className={selectCls}
                value={editForm.productId}
                onChange={(event) => setEditForm({ ...editForm, productId: event.target.value })}
              >
                <option value="">Other / not in catalog</option>
                {db.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serial number">
              <Input
                value={editForm.serialNumber}
                onChange={(event) => setEditForm({ ...editForm, serialNumber: event.target.value })}
              />
            </Field>
            <Field label="Reported issue *">
              <Textarea
                required
                rows={3}
                value={editForm.issue}
                onChange={(event) => setEditForm({ ...editForm, issue: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Warranty valid through">
                <Input
                  type="date"
                  value={editForm.warrantyUntil}
                  onChange={(event) =>
                    setEditForm({ ...editForm, warrantyUntil: event.target.value })
                  }
                />
              </Field>
              <Field label="Estimated repair cost">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.estimatedCost}
                  onChange={(event) =>
                    setEditForm({ ...editForm, estimatedCost: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Technician notes">
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingTicketId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit || !editingTicket}>
                {savingEdit ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingTicket)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setViewingTicketId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {viewingTicket ? `Repair ${viewingTicket.ticketNumber}` : "Repair details"}
            </DialogTitle>
          </DialogHeader>
          {viewingTicket &&
            (() => {
              const customer = db.customers.find((entry) => entry.id === viewingTicket.customerId);
              const product = db.products.find((entry) => entry.id === viewingTicket.productId);
              const coverage = warrantyState(viewingTicket, today);
              const creator = db.users.find((entry) => entry.id === viewingTicket.createdBy);
              return (
                <div className="space-y-5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={viewingTicket.status} />
                    {coverage === "active" && <StatusBadge status="active" text="In warranty" />}
                    {coverage === "expired" && (
                      <StatusBadge status="expired" text="Warranty expired" />
                    )}
                  </div>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{customerName(customer)}</p>
                      <p>{customer?.phone || "No phone recorded"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Device</p>
                      <p className="font-medium">{product?.name ?? "Other device"}</p>
                      <p className="font-mono text-xs">
                        {viewingTicket.serialNumber || "No serial number"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Received</p>
                      <p className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {new Date(viewingTicket.receivedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Warranty</p>
                      <p>
                        {viewingTicket.warrantyUntil
                          ? `${coverage === "active" ? "Valid through" : "Expired"} ${formatDate(viewingTicket.warrantyUntil)}`
                          : "Expiry not recorded"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estimated repair cost</p>
                      <p className="font-medium">
                        {money(viewingTicket.estimatedCost, db.settings.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ticket opened by</p>
                      <p>{creator?.fullName ?? "Unknown user"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Reported issue</p>
                    <p className="whitespace-pre-wrap">{viewingTicket.issue}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Technician notes</p>
                    <p className="whitespace-pre-wrap">
                      {viewingTicket.notes || "No notes recorded."}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setViewingTicketId(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
