import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls, Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { useDB, createRecord, updateRecord, deleteRecord, uid } from "@/services/store";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, Search, Pencil } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => meta("Inventory", "Laptop and accessory inventory."),
  component: () => <AppShell module="inventory"><Inventory /></AppShell>,
});

function Inventory() {
  const db = useDB();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    hasSerialNumber: false,
    category: "",
    brand: "",
    costPrice: "0",
    sellingPrice: "0",
    status: "active" as "active" | "discontinued",
  });
  const [editVariants, setEditVariants] = useState<Array<{ id?: string; label: string; costPrice: number; sellingPrice: number }>>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set());

  const productCategories = (db.settings.productCategories?.length ? db.settings.productCategories : ["Laptops", "Components", "Peripherals", "Accessories", "Other"]).filter(Boolean);
  const productBrands = (db.settings.productBrands?.length ? db.settings.productBrands : ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "MSI", "Samsung", "Other"]).filter(Boolean);
  const generateSku = (name: string, brand: string) => {
    const cleanName = name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toUpperCase();
    const cleanBrand = brand.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toUpperCase();
    const base = [cleanName || "PRD", cleanBrand || "GEN"].filter(Boolean).join("-");
    return base ? `${base}-${Date.now().toString(36).slice(-4).toUpperCase()}` : `PRD-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  };
  const newVariant = () => ({ id: uid("variant"), label: "", costPrice: 0, sellingPrice: 0 });

  const products = [...db.products].sort((a, b) => a.name.localeCompare(b.name));
  const topLevelProducts = products.filter((product) => !product.parentProductId);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredProducts = topLevelProducts.filter((product) => {
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const variantDetails = db.products
      .filter((item) => item.parentProductId === product.id)
      .flatMap((variant) => [variant.name, variant.sku, variant.variantLabel ?? "", variant.hasSerialNumber ? "serial tracked" : ""]);
    const searchable = [product.name, product.sku, product.hasSerialNumber ? "serial tracked" : "", product.category, product.brand, ...variantDetails]
      .join(" ")
      .toLowerCase();
    return matchesCategory && searchable.includes(normalizedSearch);
  });
  const editingProduct = db.products.find((product) => product.id === editingProductId);
  const editingProductHasVariants = !!editingProduct && !editingProduct.parentProductId && editVariants.length > 0;

  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    hasSerialNumber: false,
    category: productCategories[0] ?? "Other",
    brand: productBrands[0] ?? "",
    costPrice: 0,
    sellingPrice: 0,
    status: "active" as const,
  });
  const [isVariable, setIsVariable] = useState(false);
  const [variants, setVariants] = useState([newVariant()]);
  const [savingProduct, setSavingProduct] = useState(false);

  const toggleProduct = (id: string) => setExpandedProducts((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const handleCreateProduct = async () => {
    const variantLabels = variants.map((variant) => variant.label.trim());
    if (!newProduct.name || !newProduct.category || !newProduct.brand || (isVariable && (variantLabels.length === 0 || variantLabels.some((label) => !label)))) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isVariable && new Set(variantLabels.map((label) => label.toLowerCase())).size !== variantLabels.length) {
      toast.error("Variant names must be unique");
      return;
    }

    setSavingProduct(true);
    try {
      const parent = await createRecord("products", {
        ...newProduct,
        sku: generateSku(newProduct.name, newProduct.brand),
        id: uid("pr"),
        supplierId: undefined,
        quantity: 0,
        reorderLevel: 5,
        location: "",
      });
      for (const variant of isVariable ? variants : []) {
        const label = variant.label.trim();
        await createRecord("products", {
          id: uid("pr"),
          sku: generateSku(`${newProduct.name}-${label}`, newProduct.brand),
          name: `${newProduct.name} - ${label}`,
          hasSerialNumber: newProduct.hasSerialNumber,
          category: newProduct.category,
          brand: newProduct.brand,
          parentProductId: parent.id,
          variantLabel: label,
          supplierId: undefined,
          costPrice: variant.costPrice,
          sellingPrice: variant.sellingPrice,
          quantity: 0,
          reorderLevel: 5,
          location: "",
          status: newProduct.status,
        });
      }
      toast.success("Product added successfully");
      setShowNewDialog(false);
      setNewProduct({
        sku: "",
        name: "",
        hasSerialNumber: false,
        category: productCategories[0] ?? "Other",
        brand: productBrands[0] ?? "",
        costPrice: 0,
        sellingPrice: 0,
        status: "active",
      });
      setIsVariable(false);
      setVariants([newVariant()]);
    } catch (error) {
      toast.error("Failed to add product");
      console.error(error);
    } finally {
      setSavingProduct(false);
    }
  };

  const startEditingProduct = (product: (typeof products)[number]) => {
    setEditingProductId(product.id);
    setEditProductForm({
      name: product.parentProductId ? product.variantLabel || product.name : product.name,
      hasSerialNumber: Boolean(product.hasSerialNumber),
      category: product.category,
      brand: product.brand,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      status: product.status,
    });
    setEditVariants(product.parentProductId ? [] : db.products
      .filter((variant) => variant.parentProductId === product.id)
      .map((variant) => ({
        id: variant.id,
        label: variant.variantLabel || variant.name,
        costPrice: variant.costPrice,
        sellingPrice: variant.sellingPrice,
      })));
    setShowEditDialog(true);
  };

  const handleUpdateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const variantLabels = editVariants.map((variant) => variant.label.trim());
    if (!editingProduct || !editProductForm.name.trim() || !editProductForm.category || !editProductForm.brand || (!editingProduct.parentProductId && variantLabels.some((label) => !label))) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!editingProduct?.parentProductId && new Set(variantLabels.map((label) => label.toLowerCase())).size !== variantLabels.length) {
      toast.error("Variant names must be unique");
      return;
    }

    setSavingEdit(true);
    try {
      const isVariant = Boolean(editingProduct.parentProductId);
      const parent = isVariant
        ? db.products.find((product) => product.id === editingProduct.parentProductId)
        : undefined;
      const updatedName = isVariant && parent
        ? `${parent.name} - ${editProductForm.name.trim()}`
        : editProductForm.name.trim();
      if (!isVariant) {
        const currentVariants = db.products.filter((product) => product.parentProductId === editingProduct.id);
        const retainedVariantIds = new Set(editVariants.flatMap((variant) => variant.id ? [variant.id] : []));
        for (const variant of currentVariants) {
          if (!retainedVariantIds.has(variant.id)) await deleteRecord("products", variant.id);
        }
      }
      await updateRecord("products", editingProduct.id, {
        name: updatedName,
        ...(isVariant ? { variantLabel: editProductForm.name.trim() } : {}),
        hasSerialNumber: isVariant ? Boolean(parent?.hasSerialNumber ?? editingProduct.hasSerialNumber) : editProductForm.hasSerialNumber,
        category: editProductForm.category,
        brand: editProductForm.brand,
        costPrice: !isVariant && editVariants.length > 0 ? editingProduct.costPrice : Number(editProductForm.costPrice) || 0,
        sellingPrice: !isVariant && editVariants.length > 0 ? editingProduct.sellingPrice : Number(editProductForm.sellingPrice) || 0,
        status: editProductForm.status,
      });
      if (!isVariant) {
        for (const variant of editVariants) {
          const label = variant.label.trim();
          const variantData = {
            name: `${editProductForm.name.trim()} - ${label}`,
            variantLabel: label,
            hasSerialNumber: editProductForm.hasSerialNumber,
            category: editProductForm.category,
            brand: editProductForm.brand,
            costPrice: variant.costPrice,
            sellingPrice: variant.sellingPrice,
            status: editProductForm.status,
          };
          if (variant.id) {
            await updateRecord("products", variant.id, variantData);
          } else {
            await createRecord("products", {
              ...variantData,
              id: uid("pr"),
              sku: generateSku(`${editProductForm.name}-${label}`, editProductForm.brand),
              parentProductId: editingProduct.id,
              supplierId: undefined,
              quantity: 0,
              reorderLevel: 5,
              location: "",
            });
          }
        }
      }
      toast.success("Product updated");
      setShowEditDialog(false);
      setEditingProductId(null);
    } catch (error) {
      toast.error("Failed to update product");
      console.error(error);
    } finally {
      setSavingEdit(false);
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

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${topLevelProducts.length} products`}
        actions={
          <>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="mr-2 size-4" /> Add product</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add new product</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Field label="Name *">
                    <Input
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Product name"
                    />
                  </Field>
                  <div className="grid gap-4 grid-cols-2">
                    <Field label="Category *">
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        className={selectCls}
                      >
                        {productCategories.length === 0 ? <option value="">No categories</option> : productCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Brand *">
                      <select
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                        className={selectCls}
                      >
                        {productBrands.length === 0 ? <option value="">No brands</option> : productBrands.map((brand) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={isVariable} onChange={(event) => setIsVariable(event.target.checked)} />
                    This product has variants
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={newProduct.hasSerialNumber} onChange={(event) => setNewProduct({ ...newProduct, hasSerialNumber: event.target.checked })} />
                    Track serial numbers for this product
                  </label>
                  {isVariable && <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Product variants *</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setVariants([...variants, newVariant()])}>
                        <Plus className="mr-2 size-4" /> Add variant
                      </Button>
                    </div>
                    {variants.map((variant, index) => (
                      <div key={variant.id} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]">
                        <Field label={`Variant ${index + 1} *`}>
                          <Input
                            value={variant.label}
                            onChange={(event) => setVariants(variants.map((item) => item.id === variant.id ? { ...item, label: event.target.value } : item))}
                            placeholder="8GB RAM / 256GB storage"
                            required={isVariable}
                          />
                        </Field>
                        <Field label="Cost price *">
                          <Input
                            required={isVariable}
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.costPrice}
                            onChange={(event) => setVariants(variants.map((item) => item.id === variant.id ? { ...item, costPrice: parseFloat(event.target.value) || 0 } : item))}
                          />
                        </Field>
                        <Field label="Selling price *">
                          <Input
                            required={isVariable}
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.sellingPrice}
                            onChange={(event) => setVariants(variants.map((item) => item.id === variant.id ? { ...item, sellingPrice: parseFloat(event.target.value) || 0 } : item))}
                          />
                        </Field>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove variant ${index + 1}`} disabled={variants.length === 1} onClick={() => setVariants(variants.filter((item) => item.id !== variant.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>}
                  {!isVariable && <div className="grid gap-4 grid-cols-2">
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
                  </div>}
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
                    <Button onClick={() => void handleCreateProduct()} disabled={savingProduct}>{savingProduct ? "Saving..." : "Add product"}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingProductId(null);
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleUpdateProduct(event)} className="space-y-4">
            <Field label={editingProduct?.parentProductId ? "Variant name *" : "Name *"}>
              <Input required value={editProductForm.name} onChange={(event) => setEditProductForm({ ...editProductForm, name: event.target.value })} />
            </Field>
            {!editingProduct?.parentProductId && <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={editProductForm.hasSerialNumber} onChange={(event) => setEditProductForm({ ...editProductForm, hasSerialNumber: event.target.checked })} />
              Track serial numbers for this product
            </label>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category *">
                <select required value={editProductForm.category} onChange={(event) => setEditProductForm({ ...editProductForm, category: event.target.value })} className={selectCls}>
                  {!productCategories.includes(editProductForm.category) && <option value={editProductForm.category}>{editProductForm.category}</option>}
                  {productCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </Field>
              <Field label="Brand *">
                <select required value={editProductForm.brand} onChange={(event) => setEditProductForm({ ...editProductForm, brand: event.target.value })} className={selectCls}>
                  {!productBrands.includes(editProductForm.brand) && <option value={editProductForm.brand}>{editProductForm.brand}</option>}
                  {productBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </Field>
            </div>
            {(!editingProductHasVariants || editingProduct?.parentProductId) && <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cost price">
                <Input type="number" min="0" step="0.01" value={editProductForm.costPrice} onChange={(event) => setEditProductForm({ ...editProductForm, costPrice: event.target.value })} />
              </Field>
              <Field label="Selling price">
                <Input type="number" min="0" step="0.01" value={editProductForm.sellingPrice} onChange={(event) => setEditProductForm({ ...editProductForm, sellingPrice: event.target.value })} />
              </Field>
            </div>}
            {editingProduct && !editingProduct.parentProductId && <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Product variants</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditVariants([...editVariants, { label: "", costPrice: 0, sellingPrice: 0 }])}>
                  <Plus className="size-4" /> Add variant
                </Button>
              </div>
              {editVariants.map((variant, index) => (
                <div key={variant.id ?? index} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]">
                  <Field label={`Variant ${index + 1} *`}>
                    <Input required value={variant.label} onChange={(event) => setEditVariants(editVariants.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                  </Field>
                  <Field label="Cost price *">
                    <Input required type="number" min="0" step="0.01" value={variant.costPrice} onChange={(event) => setEditVariants(editVariants.map((item, itemIndex) => itemIndex === index ? { ...item, costPrice: parseFloat(event.target.value) || 0 } : item))} />
                  </Field>
                  <Field label="Selling price *">
                    <Input required type="number" min="0" step="0.01" value={variant.sellingPrice} onChange={(event) => setEditVariants(editVariants.map((item, itemIndex) => itemIndex === index ? { ...item, sellingPrice: parseFloat(event.target.value) || 0 } : item))} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove variant ${index + 1}`} onClick={() => setEditVariants(editVariants.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>}
            <Field label="Status">
              <select value={editProductForm.status} onChange={(event) => setEditProductForm({ ...editProductForm, status: event.target.value as "active" | "discontinued" })} className={selectCls}>
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save changes"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products by name, SKU, category or brand"
              aria-label="Search inventory products"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={selectCls}
            aria-label="Filter products by category"
          >
            <option value="all">All categories</option>
            {productCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
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
                  <th>Cost</th>
                  <th>Selling</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const variants = db.products.filter((item) => item.parentProductId === product.id);
                  const hasVariants = variants.length > 0;
                  const expanded = expandedProducts.has(product.id);
                  return <Fragment key={product.id}>
                    <tr>
                      <td className="font-mono">{product.sku}</td>
                      <td className="font-semibold">
                        <div className="flex items-center gap-1">
                          {hasVariants ? <Button type="button" variant="ghost" size="icon" aria-label={`${expanded ? "Collapse" : "Expand"} ${product.name} variants`} aria-expanded={expanded} onClick={() => toggleProduct(product.id)}>
                            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </Button> : <span className="size-9" />}
                          <div className="flex min-w-0 flex-col">
                            <span>{product.name}</span>
                            {product.hasSerialNumber && <span className="text-xs font-normal text-muted-foreground">Serial numbers tracked</span>}
                          </div>
                          {hasVariants && <span className="ml-2 text-xs font-normal text-muted-foreground">{variants.length} variants</span>}
                        </div>
                      </td>
                      <td className="capitalize">{product.category.replace(/_/g, " ")}</td>
                      <td>{product.brand}</td>
                      <td>{hasVariants ? "—" : `${db.settings.currency} ${product.costPrice.toLocaleString()}`}</td>
                      <td>{hasVariants ? "—" : `${db.settings.currency} ${product.sellingPrice.toLocaleString()}`}</td>
                      <td><StatusBadge status={product.status} /></td>
                      <td><div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${product.name}`} onClick={() => startEditingProduct(product)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${product.name}`} onClick={() => handleDeleteProduct(product.id, product.name)} className="text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div></td>
                    </tr>
                    {hasVariants && expanded && <tr>
                      <td colSpan={8} className="!p-0">
                        <div className="border-t bg-muted/20 py-1 sm:pl-12">
                          {variants.map((variant) => (
                            <div key={variant.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{variant.variantLabel || variant.name}</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">{variant.sku}</p>
                                {variant.hasSerialNumber && <p className="truncate text-xs text-muted-foreground">Serial numbers tracked</p>}
                              </div>
                              <span className="whitespace-nowrap text-muted-foreground">Cost {db.settings.currency} {variant.costPrice.toLocaleString()}</span>
                              <span className="whitespace-nowrap font-medium">Sell {db.settings.currency} {variant.sellingPrice.toLocaleString()}</span>
                              <StatusBadge status={variant.status} />
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${variant.name}`} onClick={() => startEditingProduct(variant)}>
                                  <Pencil className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label={`Delete ${variant.name}`} onClick={() => handleDeleteProduct(variant.id, variant.name)} className="text-destructive">
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>}
                  </Fragment>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
