import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Field, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { meta } from "@/lib/meta";
import { useSession } from "@/lib/auth";
import { createRecord, nextNumber, nowISO, todayISO, useDB } from "@/services/store";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

export const Route = createFileRoute("/purchases/new")({
  head: () => meta("New purchase order", "Create a supplier purchase order."),
  component: () => (
    <AppShell module="purchases">
      <NewPurchaseOrder />
    </AppShell>
  ),
});

function NewPurchaseOrder() {
  const db = useDB();
  const { user } = useSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [form, setForm] = useState({
    supplierId: "",
    productId: "",
    variantId: "",
    quantity: "1",
    unitCost: "",
    sellingPrice: "",
    serialNumbersEnabled: false,
    serialNumbers: "",
    notes: "",
  });
  const products = db.products.filter(
    (product) => product.status === "active" && !product.parentProductId,
  );
  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedProductVariants = db.products.filter(
    (product) => product.parentProductId === form.productId,
  );
  const activeVariants = selectedProductVariants.filter((product) => product.status === "active");
  const selectedVariant = activeVariants.find((product) => product.id === form.variantId);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);
    const sellingPrice = Number(form.sellingPrice);
    const productId = selectedProductVariants.length > 0 ? form.variantId : form.productId;
    const serialNumbers = form.serialNumbers
      .split(/\r?\n/)
      .map((serialNumber) => serialNumber.trim())
      .filter(Boolean);
    if (
      !user ||
      !form.supplierId ||
      !productId ||
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
      form.serialNumbersEnabled &&
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
        .filter((purchase) => purchase.status !== "cancelled" && purchase.status !== "returned")
        .flatMap((purchase) => purchase.items.flatMap((item) => item.serialNumbers ?? []))
        .map((serialNumber) => serialNumber.toLowerCase()),
    );
    if (serialNumbers.some((serialNumber) => usedSerialNumbers.has(serialNumber.toLowerCase()))) {
      toast.error("A serial number is already used on another purchase");
      return;
    }

    setSaving(true);
    try {
      await createRecord("purchases", {
        purchaseNumber: nextNumber(
          "PO-",
          db.purchases.map((purchase) => purchase.purchaseNumber),
        ),
        supplierId: form.supplierId,
        orderDate: todayISO(),
        status: "ordered",
        items: [
          {
            productId,
            quantity,
            unitCost,
            sellingPrice,
            ...(form.serialNumbersEnabled ? { serialNumbers } : {}),
          },
        ],
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        createdBy: user.id,
        createdAt: nowISO(),
      });
      toast.success("Purchase order created and stock added to inventory");
      navigate({ to: "/purchases" });
    } catch {
      toast.error("Could not create purchase order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="purchases-new-page">
      <form onSubmit={(event) => void submit(event)} className="purchases-new-form">
        <header className="purchases-new-header">
          <span className="purchases-new-icon">
            <PackagePlus className="size-5" />
          </span>
          <div>
            <h1>New purchase order</h1>
            <p>Choose a supplier and the product being ordered.</p>
          </div>
        </header>
        <div className="purchases-new-body">
          <div className="purchases-new-fields">
            <Field label="Supplier *">
              <select
                required
                className={selectCls}
                value={form.supplierId}
                onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
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
              <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={productPickerOpen}
                    className="purchases-new-product-picker w-full justify-between font-normal"
                  >
                    {selectedProduct
                      ? `${selectedProduct.name} · ${selectedProduct.sku}`
                      : "Search or select a product"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search product name or SKU..." />
                    <CommandList>
                      <CommandEmpty>No active products found.</CommandEmpty>
                      <CommandGroup>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.name} ${product.sku} ${product.category} ${product.brand}`}
                            className="data-[selected=true]:bg-info-soft data-[selected=true]:text-info"
                            onSelect={() => {
                              const hasVariants = db.products.some(
                                (item) => item.parentProductId === product.id,
                              );
                              setForm({
                                ...form,
                                productId: product.id,
                                variantId: "",
                                unitCost: hasVariants ? "" : String(product.costPrice),
                                sellingPrice: hasVariants ? "" : String(product.sellingPrice),
                                serialNumbersEnabled: Boolean(product.hasSerialNumber),
                                serialNumbers: "",
                              });
                              setProductPickerOpen(false);
                            }}
                          >
                            <span>{product.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {product.sku}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>
            {selectedProductVariants.length > 0 && (
              <Field label="Variant *" className="purchases-new-variant">
                <select
                  required
                  className={selectCls}
                  value={form.variantId}
                  onChange={(event) => {
                    const variant = activeVariants.find((item) => item.id === event.target.value);
                    setForm({
                      ...form,
                      variantId: event.target.value,
                      unitCost: variant ? String(variant.costPrice) : "",
                      sellingPrice: variant ? String(variant.sellingPrice) : "",
                      serialNumbersEnabled: Boolean(
                        variant?.hasSerialNumber || selectedProduct?.hasSerialNumber,
                      ),
                      serialNumbers: "",
                    });
                  }}
                >
                  <option value="">Select variant</option>
                  {activeVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.variantLabel} · {variant.sku}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="purchases-new-prices">
            <Field label="Quantity *">
              <Input
                required
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
            </Field>
            <Field label="Unit cost *">
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
              />
            </Field>
            <Field label="Selling price *">
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
              />
            </Field>
          </div>
          {selectedProduct && (
            <div className="purchases-new-serial-section">
              <div className="purchases-edit-serial-toggle">
                <Checkbox
                  id="purchase-serial-number"
                  checked={form.serialNumbersEnabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      serialNumbersEnabled: checked === true,
                      serialNumbers: checked === true ? form.serialNumbers : "",
                    })
                  }
                />
                <label
                  htmlFor="purchase-serial-number"
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  Track serial numbers
                </label>
              </div>
              {form.serialNumbersEnabled && (
                <div className="purchases-edit-serial-field">
                  <Field label="Serial numbers">
                    {Number(form.quantity) === 1 ? (
                      <Input
                        required
                        aria-label="Serial number"
                        value={form.serialNumbers}
                        onChange={(event) =>
                          setForm({ ...form, serialNumbers: event.target.value })
                        }
                        placeholder="Enter serial number"
                      />
                    ) : (
                      <Textarea
                        required
                        aria-label="Serial number"
                        rows={3}
                        value={form.serialNumbers}
                        onChange={(event) =>
                          setForm({ ...form, serialNumbers: event.target.value })
                        }
                        placeholder="Enter one serial number per line"
                      />
                    )}
                    {Number(form.quantity) > 1 && (
                      <span className="text-xs text-muted-foreground">
                        Enter one serial number per unit, one per line.
                      </span>
                    )}
                  </Field>
                </div>
              )}
            </div>
          )}
          <Field label="Notes" className="purchases-new-notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
          <div className="purchases-edit-actions">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/purchases" })}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                !user ||
                db.suppliers.length === 0 ||
                products.length === 0 ||
                (selectedProductVariants.length > 0 && activeVariants.length === 0)
              }
            >
              {saving ? "Saving..." : "Create order"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
