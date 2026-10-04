import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Field, PageHeader, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { meta } from "@/lib/meta";
import { updateRecord, useDB } from "@/services/store";
import { toast } from "sonner";

export const Route = createFileRoute("/customers/$id")({
  head: () => meta("Edit customer", "Update customer details."),
  component: () => <AppShell module="customers"><EditCustomer /></AppShell>,
});

function EditCustomer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const db = useDB();
  const customer = db.customers.find((item) => item.id === id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    status: "active" as "active" | "archived",
  });

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name,
      companyName: customer.companyName ?? "",
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      status: customer.status,
    });
  }, [customer]);

  const change = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    setSaving(true);
    try {
      await updateRecord("customers", customer.id, {
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: form.status,
      });
      toast.success("Customer updated");
      navigate({ to: "/customers" });
    } catch {
      toast.error("Could not update customer");
    } finally {
      setSaving(false);
    }
  };

  if (!customer && db.ready) {
    return <PageHeader title="Customer not found" actions={<Button variant="outline" onClick={() => navigate({ to: "/customers" })}>Back to customers</Button>} />;
  }

  return <>
    <PageHeader
      title={customer ? `Edit ${customer.name}` : "Edit customer"}
      subtitle={customer ? `Customer ${customer.customerNumber}` : "Loading customer details..."}
      actions={<Button variant="outline" onClick={() => navigate({ to: "/customers" })}>Cancel</Button>}
    />
    <form onSubmit={(event) => void submit(event)} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name *"><Input required value={form.name} onChange={(event) => change("name", event.target.value)} /></Field>
        <Field label="Business name"><Input value={form.companyName} onChange={(event) => change("companyName", event.target.value)} /></Field>
        <Field label="Phone *"><Input required value={form.phone} onChange={(event) => change("phone", event.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(event) => change("email", event.target.value)} /></Field>
      </div>
      <Field label="Address"><Input value={form.address} onChange={(event) => change("address", event.target.value)} /></Field>
      <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(event) => change("notes", event.target.value)} /></Field>
      <Field label="Status">
        <select className={selectCls} value={form.status} onChange={(event) => change("status", event.target.value)}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <Button type="submit" disabled={saving || !customer}>{saving ? "Saving..." : "Save changes"}</Button>
    </form>
  </>;
}
