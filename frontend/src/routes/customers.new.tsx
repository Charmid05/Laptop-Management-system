import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Field, PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { meta } from "@/lib/meta";
import { createRecord, nextNumber, nowISO, useDB } from "@/services/store";
import { toast } from "sonner";

export const Route = createFileRoute("/customers/new")({
  head: () => meta("Add customer", "Add a customer to the laptop store."),
  component: () => <AppShell module="customers"><NewCustomer /></AppShell>,
});

function NewCustomer() {
  const navigate = useNavigate();
  const db = useDB();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", companyName: "", phone: "", email: "", address: "", notes: "" });
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createRecord("customers", {
        customerNumber: nextNumber("CUS-", db.customers.map((customer) => customer.customerNumber)),
        name: form.name.trim(), companyName: form.companyName.trim() || undefined,
        phone: form.phone.trim(), email: form.email.trim() || undefined,
        address: form.address.trim() || undefined, notes: form.notes.trim() || undefined,
        status: "active", registeredAt: nowISO(),
      });
      toast.success("Customer added");
      navigate({ to: "/customers" });
    } catch {
      toast.error("Could not add customer");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageHeader title="Add customer" subtitle="Save contact details for sales and service." actions={<Button variant="outline" onClick={() => navigate({ to: "/customers" })}>Cancel</Button>} />
    <form onSubmit={(event) => void submit(event)} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name *"><Input required value={form.name} onChange={(event) => change("name", event.target.value)} /></Field>
        <Field label="Business name"><Input value={form.companyName} onChange={(event) => change("companyName", event.target.value)} /></Field>
        <Field label="Phone *"><Input required value={form.phone} onChange={(event) => change("phone", event.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(event) => change("email", event.target.value)} /></Field>
      </div>
      <Field label="Address"><Input value={form.address} onChange={(event) => change("address", event.target.value)} /></Field>
      <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(event) => change("notes", event.target.value)} /></Field>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save customer"}</Button>
    </form>
  </>;
}