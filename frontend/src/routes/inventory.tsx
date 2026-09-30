import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls, Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { useDB, createRecord, updateRecord, deleteRecord, uid, nowISO } from "@/services/store";
import { toast } from "sonner";
import { Plus, Trash2, Box, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => meta("Inventory", "Inventory — Amani Eye practice manager."),
  component: () => <AppShell module="inventory"><Inventory /></AppShell>,
});

function Inventory() {
  const db = useDB();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const products = db.products.sort((a, b) => a.name.localeCompare(b.name));
  const filteredProducts = products.filter((p) => categoryFilter === "all" || p.category === categoryFilter);
  const lowStock = products.filter((p) => p.status === "active" && p.quantity <= p.reorderLevel);

  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    category: "frames" as const,
    brand: "",
    supplierId: "",
    costPrice: 0,
    sellingPrice: 0,
    quantity: 0,
    reorderLevel: 5,
    location: "",
    status: "active" as const,
  });

  const [stockTransaction, setStockTransaction] = useState({
    type: "stock_in" as const,
    quantity: 0,
    reason: "",
    reference: "",
  });

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.sku || !newProduct.category || !newProduct.brand || !newProduct.supplierId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createRecord("products", {
        ...newProduct,
        id: uid("pr"),
      });
      toast.success("Product added successfully");
      setShowNewDialog(false);
      setNewProduct({
        sku: "",
        name: "",
        category: "frames",
        brand: "",
        supplierId: "",
        costPrice: 0,
        sellingPrice: 0,
        quantity: 0,
        reorderLevel: 5,
        location: "",
        status: "active",
      });
    } catch (error) {
      toast.error("Failed to add product");
      console.error(error);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete product ${name}?`)) return;
    try {
      await deleteRecord("products", id);
      toast.success("Product deleted");
    } catch (error) {
      toast.error("Failed to delete product");
      console.error(error);
    }
  };

  const handleStockTransaction = async () => {
    if (!selectedProduct || stockTransaction.quantity <= 0 || !stockTransaction.reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Create stock transaction
      await createRecord("stock", {
        productId: selectedProduct,
        type: stockTransaction.type,
        quantity: stockTransaction.type === "stock_out" ? -stockTransaction.quantity : stockTransaction.quantity,
        reason: stockTransaction.reason,
        reference: stockTransaction.reference,
        date: nowISO(),
        recordedBy: db.users[0]?.id || "",
      });

      // Update product quantity
      const product = db.products.find((p) => p.id === selectedProduct);
      if (product) {
        const newQuantity = stockTransaction.type === "stock_out" 
          ? product.quantity - stockTransaction.quantity 
          : product.quantity + stockTransaction.quantity;
        
        await updateRecord("products", selectedProduct, { quantity: Math.max(0, newQuantity) });
      }

      toast.success("Stock transaction recorded");
      setShowStockDialog(false);
      setStockTransaction({ type: "stock_in", quantity: 0, reason: "", reference: "" });
      setSelectedProduct("");
    } catch (error) {
      toast.error("Failed to record stock transaction");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${products.length} products • ${lowStock.length} low stock alerts`}
        actions={
          <>
            <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full"><Box className="mr-2 size-4" /> Stock transaction</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record stock transaction</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Field label="Product *">
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Transaction type *">
                    <select
                      value={stockTransaction.type}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, type: e.target.value as any })}
                      className={selectCls}
                    >
                      <option value="stock_in">Stock in</option>
                      <option value="stock_out">Stock out</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </Field>
                  <Field label="Quantity *">
                    <Input
                      type="number"
                      value={stockTransaction.quantity}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, quantity: parseInt(e.target.value) || 0 })}
                      min="1"
                    />
                  </Field>
                  <Field label="Reason *">
                    <Input
                      value={stockTransaction.reason}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, reason: e.target.value })}
                      placeholder="Purchase, sale, damage, etc."
                    />
                  </Field>
                  <Field label="Reference (optional)">
                    <Input
                      value={stockTransaction.reference}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, reference: e.target.value })}
                      placeholder="Invoice number, PO number, etc."
                    />
                  </Field>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowStockDialog(false)}>Cancel</Button>
                    <Button onClick={handleStockTransaction}>Record transaction</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="mr-2 size-4" /> Add product</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add new product</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-4 grid-cols-2">
                    <Field label="SKU *">
                      <Input
                        value={newProduct.sku}
                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                        placeholder="FR-001"
                      />
                    </Field>
                    <Field label="Name *">
                      <Input
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="Product name"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 grid-cols-2">
                    <Field label="Category *">
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as any })}
                        className={selectCls}
                      >
                        <option value="frames">Frames</option>
                        <option value="lenses">Lenses</option>
                        <option value="contact_lenses">Contact lenses</option>
                        <option value="accessories">Accessories</option>
                        <option value="eye_care">Eye care</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Brand *">
                      <Input
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                        placeholder="Brand name"
                      />
                    </Field>
                  </div>
                  <Field label="Supplier *">
                    <select
                      value={newProduct.supplierId}
                      onChange={(e) => setNewProduct({ ...newProduct, supplierId: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">Select supplier</option>
                      {db.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 grid-cols-2">
                    <Field label="Cost price">
                      <Input
                        type="number"
                        value={newProduct.costPrice}
                        onChange={(e) => setNewProduct({ ...newProduct, costPrice: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </Field>
                    <Field label="Selling price">
                      <Input
                        type="number"
                        value={newProduct.sellingPrice}
                        onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 grid-cols-3">
                    <Field label="Quantity">
                      <Input
                        type="number"
                        value={newProduct.quantity}
                        onChange={(e) => setNewProduct({ ...newProduct, quantity: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </Field>
                    <Field label="Reorder level">
                      <Input
                        type="number"
                        value={newProduct.reorderLevel}
                        onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </Field>
                    <Field label="Location">
                      <Input
                        value={newProduct.location}
                        onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })}
                        placeholder="Shelf A-1"
                      />
                    </Field>
                  </div>
                  <Field label="Status">
                    <select
                      value={newProduct.status}
                      onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value as any })}
                      className={selectCls}
                    >
                      <option value="active">Active</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </Field>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateProduct}>Add product</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {lowStock.length > 0 && (
        <Panel title="Low stock alerts" className="mb-6 border-warning">
          <div className="space-y-2">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-4 text-warning" />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">({p.sku})</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    <span className={p.quantity === 0 ? "text-destructive font-semibold" : "text-warning font-semibold"}>
                      {p.quantity}
                    </span> / {p.reorderLevel}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelectedProduct(p.id); setShowStockDialog(true); }}
                  >
                    Reorder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium">Filter by category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All categories</option>
            <option value="frames">Frames</option>
            <option value="lenses">Lenses</option>
            <option value="contact_lenses">Contact lenses</option>
            <option value="accessories">Accessories</option>
            <option value="eye_care">Eye care</option>
            <option value="other">Other</option>
          </select>
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No products found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Supplier</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Selling</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const supplier = db.suppliers.find((s) => s.id === product.supplierId);
                  const isLowStock = product.quantity <= product.reorderLevel;
                  return (
                    <tr key={product.id}>
                      <td className="font-mono">{product.sku}</td>
                      <td className="font-semibold">{product.name}</td>
                      <td className="capitalize">{product.category.replace(/_/g, " ")}</td>
                      <td>{product.brand}</td>
                      <td>{supplier?.name || "Unknown"}</td>
                      <td>
                        <span className={isLowStock ? "text-warning font-semibold" : ""}>
                          {product.quantity}
                        </span>
                        {isLowStock && <AlertTriangle className="inline size-3 ml-1 text-warning" />}
                      </td>
                      <td>{db.settings.currency} {product.costPrice.toLocaleString()}</td>
                      <td>{db.settings.currency} {product.sellingPrice.toLocaleString()}</td>
                      <td><StatusBadge status={product.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedProduct(product.id); setShowStockDialog(true); }}
                          >
                            <Box className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
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
