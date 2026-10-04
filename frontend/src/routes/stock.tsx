import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";
import {
  supplierProductSerialNumbers,
  supplierProductStock,
  updateRecord,
  useDB,
} from "@/services/store";
import { Eye, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock")({
  head: () => meta("Stock", "Supplier-specific stock available for sale."),
  component: () => (
    <AppShell module="inventory">
      <Stock />
    </AppShell>
  ),
});

function Stock() {
  const db = useDB();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingStockKey, setViewingStockKey] = useState<string | null>(null);
  const [updatingPurchaseId, setUpdatingPurchaseId] = useState<string | null>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const rows = supplierProductStock(db)
    .filter((balance) => balance.receivedQuantity > 0)
    .flatMap((balance) => {
      const supplier = db.suppliers.find((entry) => entry.id === balance.supplierId);
      const product = db.products.find((entry) => entry.id === balance.productId);
      const serialNumbers = supplierProductSerialNumbers(db, balance.supplierId, balance.productId);
      return supplier && product ? [{ ...balance, supplier, product, serialNumbers }] : [];
    })
    .filter(
      ({ supplier, product, serialNumbers }) =>
        `${supplier.name} ${product.name} ${product.sku} ${product.brand}`
          .toLowerCase()
          .includes(normalizedSearch) ||
        serialNumbers.some((serialNumber) => serialNumber.toLowerCase().includes(normalizedSearch)),
    )
    .sort(
      (left, right) =>
        left.supplier.name.localeCompare(right.supplier.name) ||
        left.product.name.localeCompare(right.product.name),
    );
  const totalAvailable = rows.reduce(
    (total, row) => total + (row.product.status === "active" ? Math.max(0, row.quantity) : 0),
    0,
  );
  const viewingStock = rows.find((row) => `${row.supplierId}-${row.productId}` === viewingStockKey);
  const stockPurchases = viewingStock
    ? db.purchases
        .filter(
          (purchase) =>
            purchase.supplierId === viewingStock.supplierId &&
            purchase.items.some((item) => item.productId === viewingStock.productId),
        )
        .sort((left, right) => right.orderDate.localeCompare(left.orderDate))
    : [];

  const updatePurchaseStatus = async (purchaseId: string, status: "delivered" | "returned") => {
    setUpdatingPurchaseId(purchaseId);
    try {
      await updateRecord("purchases", purchaseId, { status, receivedAt: new Date().toISOString() });
      toast.success(
        status === "delivered"
          ? "Purchase marked as delivered"
          : "Purchase marked as returned and stock reversed",
      );
    } catch {
      toast.error(
        status === "delivered"
          ? "Could not mark purchase as delivered"
          : "Could not mark purchase as returned; available stock may already have been sold",
      );
    } finally {
      setUpdatingPurchaseId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle={`${totalAvailable} units available across ${rows.length} supplier products`}
      />
      <Panel>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search supplier, product, SKU, or serial number"
            aria-label="Search stock"
          />
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {normalizedSearch ? "No stock matches that search" : "No received stock yet"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Serial numbers</th>
                  <th>Purchase status</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status =
                    row.product.status !== "active"
                      ? "discontinued"
                      : row.quantity > 0
                        ? "active"
                        : "out";
                  const purchases = db.purchases
                    .filter(
                      (purchase) =>
                        purchase.supplierId === row.supplierId &&
                        purchase.items.some((item) => item.productId === row.productId),
                    )
                    .sort((left, right) => right.orderDate.localeCompare(left.orderDate));
                  return (
                    <tr key={`${row.supplierId}-${row.productId}`}>
                      <td>{row.supplier.name}</td>
                      <td>{row.product.name}</td>
                      <td className="font-mono text-xs">{row.product.sku}</td>
                      <td className="max-w-xs break-all font-mono text-xs">
                        {row.serialNumbers.join(", ") || "—"}
                      </td>
                      <td>
                        {purchases.length > 0 ? (
                          <div className="max-h-20 space-y-1 overflow-y-auto">
                            {purchases.map((purchase) => (
                              <div
                                key={purchase.id}
                                className="flex items-center gap-2 whitespace-nowrap"
                              >
                                <span className="font-mono text-xs text-muted-foreground">
                                  {purchase.purchaseNumber}
                                </span>
                                <StatusBadge status={purchase.status} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="font-semibold">{Math.max(0, row.quantity)}</td>
                      <td>
                        <StatusBadge
                          status={status}
                          text={
                            status === "active"
                              ? "Available"
                              : status === "out"
                                ? "Sold out"
                                : "Discontinued"
                          }
                        />
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingStockKey(`${row.supplierId}-${row.productId}`)}
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
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
        open={Boolean(viewingStock)}
        onOpenChange={(open) => {
          if (!open) setViewingStockKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingStock?.product.name ?? "Stock details"}</DialogTitle>
          </DialogHeader>
          {viewingStock && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Supplier</span>
                  <p className="font-medium">{viewingStock.supplier.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU</span>
                  <p className="font-mono">{viewingStock.product.sku}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Available</span>
                  <p className="font-semibold">{Math.max(0, viewingStock.quantity)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="capitalize">
                    {viewingStock.product.status === "active" ? "Active" : "Discontinued"}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-medium">Recorded serial numbers</h3>
                {viewingStock.serialNumbers.length > 0 ? (
                  <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-3 font-mono text-xs">
                    {viewingStock.serialNumbers.map((serialNumber) => (
                      <li key={serialNumber}>{serialNumber}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    No serial numbers recorded for this stock.
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-2 font-medium">Purchase orders</h3>
                {stockPurchases.length > 0 ? (
                  <div className="space-y-2">
                    {stockPurchases.map((purchase) => {
                      const itemQuantity = purchase.items
                        .filter((item) => item.productId === viewingStock.productId)
                        .reduce((total, item) => total + item.quantity, 0);
                      const canUpdate = purchase.status === "ordered";
                      return (
                        <div
                          key={purchase.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">{purchase.purchaseNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(purchase.orderDate).toLocaleDateString()} · {itemQuantity}{" "}
                              unit{itemQuantity === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={purchase.status} />
                            {canUpdate && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingPurchaseId === purchase.id}
                                  onClick={() =>
                                    void updatePurchaseStatus(purchase.id, "delivered")
                                  }
                                >
                                  Mark delivered
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingPurchaseId === purchase.id}
                                  onClick={() => void updatePurchaseStatus(purchase.id, "returned")}
                                >
                                  Mark returned
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No purchase orders recorded for this stock.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
