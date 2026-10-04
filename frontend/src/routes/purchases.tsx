import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownLeft,
  Boxes,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Field, Panel, StatusBadge, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { deleteRecord, money, updateRecord, useDB } from "@/services/store";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases")({
  head: () => meta("Purchases", "Supplier purchase orders and stock receiving."),
  component: PurchasesRouteView,
});

function PurchasesRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/purchases" ? (
    <AppShell module="purchases">
      <Purchases />
    </AppShell>
  ) : (
    <Outlet />
  );
}

function Purchases() {
  const db = useDB();
  const { user } = useSession();
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    supplierId: "",
    productId: "",
    quantity: "1",
    unitCost: "",
    sellingPrice: "",
    serialNumbersEnabled: false,
    serialNumbers: "",
    notes: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const ordered = [...db.purchases].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPurchases = ordered.filter((purchase) => {
    const supplier = db.suppliers.find((entry) => entry.id === purchase.supplierId);
    const searchable = [
      purchase.purchaseNumber,
      supplier?.name ?? "",
      ...purchase.items.flatMap((item) => {
        const product = db.products.find((entry) => entry.id === item.productId);
        return [product?.name ?? "", product?.sku ?? "", ...(item.serialNumbers ?? [])];
      }),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const totalPurchaseSpend = ordered.reduce(
    (sum, purchase) =>
      sum + purchase.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitCost, 0),
    0,
  );
  const totalUnitsOrdered = ordered.reduce(
    (sum, purchase) => sum + purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const supplierCount = new Set(ordered.map((purchase) => purchase.supplierId)).size;

  const editableProducts = db.products.filter(
    (product) =>
      (product.status === "active" &&
        !db.products.some((variant) => variant.parentProductId === product.id)) ||
      product.id === editForm.productId,
  );

  const startEditing = (purchaseId: string) => {
    const purchase = db.purchases.find((item) => item.id === purchaseId);
    const item = purchase?.items[0];
    if (!purchase || !item) return;
    const product = db.products.find((entry) => entry.id === item.productId);
    const productParent = product?.parentProductId
      ? db.products.find((entry) => entry.id === product.parentProductId)
      : undefined;
    setEditingPurchaseId(purchaseId);
    setEditForm({
      supplierId: purchase.supplierId,
      productId: item.productId,
      quantity: String(item.quantity),
      unitCost: String(item.unitCost),
      sellingPrice: String(item.sellingPrice ?? ""),
      serialNumbersEnabled: Boolean(
        item.serialNumbers?.length || product?.hasSerialNumber || productParent?.hasSerialNumber,
      ),
      serialNumbers: (item.serialNumbers ?? []).join("\n"),
      notes: purchase.notes ?? "",
    });
    setEditDialogOpen(true);
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const purchase = db.purchases.find((item) => item.id === editingPurchaseId);
    const item = purchase?.items[0];
    const quantity = Number(editForm.quantity);
    const unitCost = Number(editForm.unitCost);
    const sellingPrice = Number(editForm.sellingPrice);
    const serialNumbers = editForm.serialNumbers
      .split(/\r?\n/)
      .map((serialNumber) => serialNumber.trim())
      .filter(Boolean);
    if (
      !purchase ||
      !item ||
      !editForm.supplierId ||
      !editForm.productId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0
    ) {
      toast.error("Choose a supplier and product, then enter a valid quantity and prices");
      return;
    }
    if (
      editForm.serialNumbersEnabled &&
      (serialNumbers.length !== quantity ||
        new Set(serialNumbers.map((serialNumber) => serialNumber.toLowerCase())).size !==
          serialNumbers.length)
    ) {
      toast.error(
        `Enter ${quantity} unique serial number${quantity === 1 ? "" : "s"}, one per unit`,
      );
      return;
    }
    const usedSerialNumbers = new Set(
      db.purchases
        .filter(
          (entry) =>
            entry.id !== purchase.id && entry.status !== "cancelled" && entry.status !== "returned",
        )
        .flatMap((entry) => entry.items.flatMap((purchaseItem) => purchaseItem.serialNumbers ?? []))
        .map((serialNumber) => serialNumber.toLowerCase()),
    );
    if (serialNumbers.some((serialNumber) => usedSerialNumbers.has(serialNumber.toLowerCase()))) {
      toast.error("A serial number is already used on another purchase");
      return;
    }

    setSavingEdit(true);
    try {
      await updateRecord("purchases", purchase.id, {
        supplierId: editForm.supplierId,
        notes: editForm.notes.trim(),
        items: [
          {
            ...item,
            productId: editForm.productId,
            quantity,
            unitCost,
            sellingPrice,
            ...(editForm.serialNumbersEnabled ? { serialNumbers } : { serialNumbers: [] }),
          },
          ...purchase.items.slice(1),
        ],
      });
      toast.success("Purchase updated and stock adjusted");
      setEditDialogOpen(false);
      setEditingPurchaseId(null);
    } catch {
      toast.error("Could not update purchase; stock may already have been used");
    } finally {
      setSavingEdit(false);
    }
  };

  const removePurchase = async (purchaseId: string, purchaseNumber: string) => {
    const purchase = db.purchases.find((item) => item.id === purchaseId);
    if (!purchase) return;
    if (!confirm(`Delete purchase order ${purchaseNumber}? This action cannot be undone.`)) return;
    try {
      await deleteRecord("purchases", purchaseId);
      toast.success("Purchase order deleted");
    } catch {
      toast.error("Could not delete purchase order; stock may already have been used");
    }
  };

  return (
    <>
      <div className="purchases-page space-y-5">
        <section className="purchases-hero">
          <div className="purchases-hero-content">
            <div className="purchases-eyebrow">
              <span className="purchases-eyebrow-icon">
                <ShoppingCart className="size-4" />
              </span>
              PROCUREMENT OVERVIEW
            </div>
            <h1>Purchases</h1>
            <p>Track supplier orders and keep incoming stock organized.</p>
            <div className="purchases-hero-meta">
              <span>
                <PackageCheck className="size-3.5" /> {db.purchases.length} supplier orders
              </span>
              <span className="purchases-meta-divider" />
              <span>
                <Boxes className="size-3.5" /> {totalUnitsOrdered} units ordered
              </span>
            </div>
          </div>
          <div className="purchases-hero-side">
            <div className="purchases-hero-orbit purchases-orbit-one" />
            <div className="purchases-hero-orbit purchases-orbit-two" />
            <div className="purchases-hero-card">
              <div className="purchases-hero-card-icon">
                <Truck className="size-5" />
              </div>
              <span>Supplier network</span>
              <strong>{supplierCount}</strong>
              <small>
                {supplierCount === 1 ? "supplier represented" : "suppliers represented"}
              </small>
            </div>
          </div>
          <div className="purchases-hero-action">
            <Button asChild disabled={!user}>
              <Link to="/purchases/new">
                <Plus className="size-4" /> New purchase order
              </Link>
            </Button>
          </div>
        </section>
        <div className="purchases-stats">
          <article className="purchases-stat-card purchases-stat-count">
            <div className="purchases-stat-top">
              <span className="purchases-stat-icon">
                <PackageCheck className="size-5" />
              </span>
              <span className="purchases-stat-label">Purchase orders</span>
            </div>
            <p className="purchases-stat-value">{db.purchases.length}</p>
            <p className="purchases-stat-hint">Supplier orders on record</p>
          </article>
          <article className="purchases-stat-card purchases-stat-spend">
            <div className="purchases-stat-top">
              <span className="purchases-stat-icon">
                <ArrowDownLeft className="size-5" />
              </span>
              <span className="purchases-stat-label">Purchase spend</span>
            </div>
            <p className="purchases-stat-value">
              {money(totalPurchaseSpend, db.settings.currency)}
            </p>
            <p className="purchases-stat-hint">Total value across all orders</p>
          </article>
          <article className="purchases-stat-card purchases-stat-units">
            <div className="purchases-stat-top">
              <span className="purchases-stat-icon">
                <Boxes className="size-5" />
              </span>
              <span className="purchases-stat-label">Units ordered</span>
            </div>
            <p className="purchases-stat-value">{totalUnitsOrdered}</p>
            <p className="purchases-stat-hint">
              {supplierCount} {supplierCount === 1 ? "supplier" : "suppliers"}
            </p>
          </article>
        </div>
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingPurchaseId(null);
          }}
        >
          <DialogContent className="purchases-edit-dialog max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader className="purchases-edit-header">
              <span className="purchases-edit-icon">
                <Pencil className="size-4" />
              </span>
              <div>
                <DialogTitle>Edit purchase order</DialogTitle>
                <p>Update supplier, product, and pricing details.</p>
              </div>
            </DialogHeader>
            <form onSubmit={(event) => void saveEdit(event)} className="purchases-edit-form">
              <div className="purchases-edit-selects">
                <Field label="Supplier *">
                  <select
                    required
                    className={selectCls}
                    value={editForm.supplierId}
                    onChange={(event) =>
                      setEditForm({ ...editForm, supplierId: event.target.value })
                    }
                  >
                    <option value="">Select supplier</option>
                    {db.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Product *">
                  <select
                    required
                    className={selectCls}
                    value={editForm.productId}
                    onChange={(event) => {
                      const product = db.products.find((entry) => entry.id === event.target.value);
                      const parent = product?.parentProductId
                        ? db.products.find((entry) => entry.id === product.parentProductId)
                        : undefined;
                      setEditForm({
                        ...editForm,
                        productId: event.target.value,
                        unitCost: product ? String(product.costPrice) : "",
                        sellingPrice: product ? String(product.sellingPrice) : "",
                        serialNumbersEnabled: Boolean(
                          product?.hasSerialNumber || parent?.hasSerialNumber,
                        ),
                        serialNumbers: "",
                      });
                    }}
                  >
                    <option value="">Select product</option>
                    {editableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.parentProductId
                          ? `${db.products.find((entry) => entry.id === product.parentProductId)?.name ?? "Product"} - ${product.variantLabel || product.name}`
                          : product.name}{" "}
                        · {product.sku}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="purchases-edit-serial-toggle">
                <Checkbox
                  id="edit-purchase-serial-numbers"
                  checked={editForm.serialNumbersEnabled}
                  onCheckedChange={(checked) =>
                    setEditForm({
                      ...editForm,
                      serialNumbersEnabled: checked === true,
                      serialNumbers: checked === true ? editForm.serialNumbers : "",
                    })
                  }
                />
                <label
                  htmlFor="edit-purchase-serial-numbers"
                  className="cursor-pointer text-sm font-medium"
                >
                  Track serial numbers
                </label>
              </div>
              {editForm.serialNumbersEnabled && (
                <div className="purchases-edit-serial-field">
                  <Field label="Serial numbers">
                    {Number(editForm.quantity) === 1 ? (
                      <Input
                        required
                        value={editForm.serialNumbers}
                        onChange={(event) =>
                          setEditForm({ ...editForm, serialNumbers: event.target.value })
                        }
                        placeholder="Enter serial number"
                      />
                    ) : (
                      <Textarea
                        required
                        rows={3}
                        value={editForm.serialNumbers}
                        onChange={(event) =>
                          setEditForm({ ...editForm, serialNumbers: event.target.value })
                        }
                        placeholder="Enter one serial number per line"
                      />
                    )}
                    {Number(editForm.quantity) > 1 && (
                      <span className="text-xs text-muted-foreground">
                        Enter one unique serial number per unit.
                      </span>
                    )}
                  </Field>
                </div>
              )}
              <div className="purchases-edit-prices">
                <Field label="Quantity *">
                  <Input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={editForm.quantity}
                    onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })}
                  />
                </Field>
                <Field label="Unit cost *">
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.unitCost}
                    onChange={(event) => setEditForm({ ...editForm, unitCost: event.target.value })}
                  />
                </Field>
                <Field label="Selling price *">
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.sellingPrice}
                    onChange={(event) =>
                      setEditForm({ ...editForm, sellingPrice: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes" className="purchases-edit-notes">
                <Textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
              </Field>
              <p className="purchases-edit-hint">
                Saving changes will update the purchase details and reconcile available stock.
              </p>
              <div className="purchases-edit-actions">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Panel className="purchases-ledger-panel !p-0">
          {ordered.length === 0 ? (
            <div className="purchases-empty">
              <span className="purchases-empty-icon">
                <ShoppingCart className="size-5" />
              </span>
              <p>No purchase orders yet</p>
              <span>Create a supplier order to start tracking procurement.</span>
            </div>
          ) : (
            <>
              <div className="purchases-toolbar">
                <label className="purchases-search">
                  <Search className="size-4" aria-hidden="true" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search order, supplier, product, or serial number"
                    aria-label="Search purchase orders"
                  />
                </label>
              </div>
              {filteredPurchases.length === 0 ? (
                <div className="purchases-empty purchases-empty-compact">
                  <span className="purchases-empty-icon">
                    <Search className="size-5" />
                  </span>
                  <p>No purchase orders match that search</p>
                  <span>Try another order number, supplier, product, or serial number.</span>
                </div>
              ) : (
                <div className="purchases-table-wrap overflow-x-auto">
                  <table className={`${tableCls} purchases-table`}>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Order cost</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map((purchase) => {
                        const supplier = db.suppliers.find(
                          (entry) => entry.id === purchase.supplierId,
                        );
                        const product = db.products.find(
                          (entry) => entry.id === purchase.items[0]?.productId,
                        );
                        const total = purchase.items.reduce(
                          (sum, item) => sum + item.quantity * item.unitCost,
                          0,
                        );
                        const serialNumbers = purchase.items.flatMap(
                          (item) => item.serialNumbers ?? [],
                        );
                        return (
                          <tr key={purchase.id}>
                            <td className="font-mono">{purchase.purchaseNumber}</td>
                            <td>{new Date(purchase.orderDate).toLocaleDateString()}</td>
                            <td>{supplier?.name ?? "Unknown supplier"}</td>
                            <td>
                              {product?.name ?? "Unknown product"}
                              {serialNumbers.length > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  Serials: {serialNumbers.join(", ")}
                                </span>
                              )}
                            </td>
                            <td>{purchase.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td className="purchases-amount">
                              {money(total, db.settings.currency)}
                            </td>
                            <td>
                              <StatusBadge status={purchase.status} />
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-1">
                                {(purchase.status === "ordered" ||
                                  purchase.status === "delivered") && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Edit purchase order ${purchase.purchaseNumber}`}
                                    title="Edit purchase order"
                                    onClick={() => startEditing(purchase.id)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete purchase order ${purchase.purchaseNumber}`}
                                  title="Delete purchase order"
                                  className="text-destructive"
                                  onClick={() =>
                                    void removePurchase(purchase.id, purchase.purchaseNumber)
                                  }
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
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
