import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, Field, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { useDB, createRecord, updateRecord, deleteRecord } from "@/services/store";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/suppliers")({
  head: () => meta("Suppliers", "Suppliers — Amani Eye practice manager."),
  component: () => (
    <AppShell module="suppliers">
      <Suppliers />
    </AppShell>
  ),
});

type SupplierDraft = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  productsSupplied: string;
  notes: string;
};

const emptySupplier = (): SupplierDraft => ({
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  productsSupplied: "",
  notes: "",
});

function Suppliers() {
  const db = useDB();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<SupplierDraft>(emptySupplier);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const suppliers = [...db.suppliers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((supplier) =>
      `${supplier.name} ${supplier.contactPerson} ${supplier.phone} ${supplier.email} ${supplier.productsSupplied}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const suppliedProducts = db.products.length;

  const openNewDialog = () => {
    setEditingId("");
    setDraft(emptySupplier());
    setShowDialog(true);
  };

  const openEditDialog = (id: string) => {
    const supplier = db.suppliers.find((item) => item.id === id);
    if (!supplier) return;
    setEditingId(id);
    setDraft({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      productsSupplied: supplier.productsSupplied,
      notes: supplier.notes ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setSaving(true);
    try {
      const record = { ...draft, name: draft.name.trim(), notes: draft.notes.trim() || undefined };
      if (editingId) {
        await updateRecord("suppliers", editingId, record);
        toast.success("Supplier updated");
      } else {
        await createRecord("suppliers", record);
        toast.success("Supplier added");
      }
      setShowDialog(false);
      setEditingId("");
      setDraft(emptySupplier());
    } catch (error) {
      toast.error(editingId ? "Failed to update supplier" : "Failed to add supplier");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supplier = db.suppliers.find((item) => item.id === id);
    if (!supplier) return;
    const linkedProducts = db.products.filter((product) => product.supplierId === id);
    if (linkedProducts.length > 0) {
      toast.error(
        `Cannot delete ${supplier.name}: ${linkedProducts.length} inventory ${linkedProducts.length === 1 ? "product uses" : "products use"} this supplier`,
      );
      return;
    }
    if (!confirm(`Delete supplier ${supplier.name}?`)) return;
    try {
      await deleteRecord("suppliers", id);
      toast.success("Supplier deleted");
    } catch (error) {
      toast.error("Failed to delete supplier");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={`${db.suppliers.length} suppliers · ${suppliedProducts} inventory products`}
        actions={
          <Button onClick={openNewDialog} className="rounded-full">
            <Plus className="size-4" /> Add supplier
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat
          label="Suppliers"
          value={db.suppliers.length}
          hint="Saved supplier records"
          accent="info"
        />
        <Stat
          label="Linked products"
          value={suppliedProducts}
          hint="Inventory items sourced from suppliers"
          accent="accent"
        />
      </div>
      <Panel>
        <div className="mb-4 max-w-sm">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search suppliers or products..."
            aria-label="Search suppliers"
          />
        </div>
        {suppliers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No suppliers match your search" : "No suppliers recorded"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Products supplied</th>
                  <th>Linked stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const products = db.products.filter(
                    (product) => product.supplierId === supplier.id,
                  );
                  return (
                    <tr key={supplier.id}>
                      <td className="font-semibold">{supplier.name}</td>
                      <td>{supplier.contactPerson || "—"}</td>
                      <td>{supplier.phone || "—"}</td>
                      <td>{supplier.email || "—"}</td>
                      <td>{supplier.productsSupplied || "—"}</td>
                      <td>{products.length}</td>
                      <td>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={`Edit ${supplier.name}`}
                            aria-label={`Edit ${supplier.name}`}
                            onClick={() => openEditDialog(supplier.id)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={`Delete ${supplier.name}`}
                            aria-label={`Delete ${supplier.name}`}
                            className="text-destructive"
                            onClick={() => void handleDelete(supplier.id)}
                          >
                            <Trash2 />
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
          if (!open) setEditingId("");
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
            <Field label="Supplier name *">
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact person">
                <Input
                  value={draft.contactPerson}
                  onChange={(event) => setDraft({ ...draft, contactPerson: event.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </Field>
              <Field label="Products supplied">
                <Input
                  value={draft.productsSupplied}
                  onChange={(event) => setDraft({ ...draft, productsSupplied: event.target.value })}
                  placeholder="Frames, lenses, solutions"
                />
              </Field>
            </div>
            <Field label="Address">
              <Textarea
                rows={2}
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
