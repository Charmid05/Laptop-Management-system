import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("purchases add supplier stock and sales consume only that supplier's balance", async () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "supplier-stock-flow-"));
  process.env.DATABASE_FILE = join(temporaryDirectory, "workflow.db");
  const { db, run, one } = await import("../src/db.ts");
  const { create, createPurchase, createSale, deletePurchase, deleteSale, find, updatePurchase } = await import("../src/resources.ts");

  try {
    run("INSERT INTO roles (id, name, description, modules) VALUES (?, ?, ?, ?)", "role", "Test role", "", "[]");
    run(
      "INSERT INTO users (id, fullName, email, username, role, createdAt, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      "user", "Test user", "stock-test@example.com", "stocktest", "role", new Date().toISOString(), "x",
    );
    for (const id of ["supplier-a", "supplier-b"]) {
      create("suppliers", { id, name: id, contactPerson: "", phone: "", email: "", address: "", productsSupplied: "" });
    }
    create("products", {
      id: "product-a", sku: "SKU-A", name: "Test laptop", hasSerialNumber: false,
      category: "Laptops", brand: "Test", parentProductId: null, variantLabel: null,
      supplierId: null, costPrice: 100, sellingPrice: 200, quantity: 0,
      reorderLevel: 0, location: "", status: "active",
    });
    create("customers", {
      id: "customer-a", customerNumber: "C-0001", name: "Test customer", companyName: null,
      phone: "", email: null, address: null, notes: null, status: "active", registeredAt: new Date().toISOString(),
    });

    const purchaseBody = (purchaseNumber: string, supplierId: string, quantity: number) => ({
      purchaseNumber, supplierId, orderDate: "2026-10-04",
      items: [{
        productId: "product-a", quantity, unitCost: 100, sellingPrice: 200,
        serialNumbers: Array.from({ length: quantity }, (_, index) => `${supplierId}-serial-${index + 1}`),
      }],
      createdBy: "user", createdAt: new Date().toISOString(),
    });
    const purchaseA = createPurchase(purchaseBody("PO-0001", "supplier-a", 10), "user");
    const purchaseB = createPurchase(purchaseBody("PO-0002", "supplier-b", 3), "user");
    assert.equal(purchaseA?.status, "ordered");
    assert.equal(purchaseB?.status, "ordered");

    const supplierBalance = (supplierId: string) => Number(one(
      "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_transactions WHERE supplierId = ? AND productId = ?",
      supplierId,
      "product-a",
    )?.quantity);
    assert.equal(supplierBalance("supplier-a"), 10);
    assert.equal(supplierBalance("supplier-b"), 3);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 13);

    const earlySale = createSale({
      invoiceNumber: "INV-0000", customerId: "customer-a", date: "2026-10-04", taxRate: 0,
      status: "unpaid", createdBy: "user", createdAt: new Date().toISOString(),
      items: [{ description: "Test laptop", productId: "product-a", supplierId: "supplier-a", quantity: 1, unitPrice: 200, discount: 0 }],
    });
    assert.ok(earlySale);
    assert.equal(supplierBalance("supplier-a"), 9);
    assert.equal(deleteSale(earlySale.id), true);
    assert.equal(supplierBalance("supplier-a"), 10);

    const deliveredPurchase = updatePurchase(purchaseA!.id, { status: "delivered" }, "user");
    assert.equal(deliveredPurchase?.status, "delivered");
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 13);
    const editedItems = [{
      productId: "product-a",
      quantity: 12,
      unitCost: 110,
      sellingPrice: 210,
      serialNumbers: Array.from({ length: 12 }, (_, index) => `supplier-a-edited-${index + 1}`),
    }];
    const editedPurchase = updatePurchase(purchaseA!.id, { items: editedItems }, "user");
    assert.equal(editedPurchase?.status, "delivered");
    assert.equal(supplierBalance("supplier-a"), 12);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 15);
    assert.equal(Number(one("SELECT sellingPrice FROM products WHERE id = ?", "product-a")?.sellingPrice), 210);
    const restoredPurchase = updatePurchase(purchaseA!.id, {
      items: [{
        productId: "product-a",
        quantity: 10,
        unitCost: 100,
        sellingPrice: 200,
        serialNumbers: Array.from({ length: 10 }, (_, index) => `supplier-a-serial-${index + 1}`),
      }],
    }, "user");
    assert.equal(restoredPurchase?.status, "delivered");
    assert.equal(supplierBalance("supplier-a"), 10);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 13);
    assert.equal(Number(one("SELECT sellingPrice FROM products WHERE id = ?", "product-a")?.sellingPrice), 200);
    const returnedPurchase = updatePurchase(purchaseB!.id, { status: "returned" }, "user");
    assert.equal(returnedPurchase?.status, "returned");
    assert.equal(supplierBalance("supplier-b"), 0);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 10);
    assert.equal(deletePurchase(purchaseB!.id), true);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 10);

    const saleBody = (invoiceNumber: string, supplierId: string, quantity: number) => ({
      invoiceNumber, customerId: "customer-a", date: "2026-10-04", taxRate: 0,
      status: "unpaid", createdBy: "user", createdAt: new Date().toISOString(),
      items: [{ description: "Test laptop", productId: "product-a", supplierId, quantity, unitPrice: 200, discount: 0 }],
    });
    const saleA = createSale(saleBody("INV-0001", "supplier-a", 10));
    assert.ok(saleA);
    assert.deepEqual(saleA.items[0].serialNumbers, Array.from(
      { length: 10 },
      (_, index) => `supplier-a-serial-${index + 1}`,
    ));
    assert.deepEqual(find("invoices", saleA.id)?.items[0].serialNumbers, saleA.items[0].serialNumbers);
    assert.equal(supplierBalance("supplier-a"), 0);
    assert.equal(supplierBalance("supplier-b"), 0);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 0);
    assert.equal(createSale(saleBody("INV-0002", "supplier-a", 1)), undefined);
    assert.equal(updatePurchase(purchaseA!.id, { status: "returned" }, "user"), undefined);
    assert.equal(updatePurchase(purchaseA!.id, {
      items: [{ productId: "product-a", quantity: 9, unitCost: 100, sellingPrice: 200 }],
    }, "user"), undefined);

    assert.equal(deleteSale(saleA.id), true);
    assert.equal(supplierBalance("supplier-a"), 10);
    const resold = createSale(saleBody("INV-0002", "supplier-a", 1));
    assert.deepEqual(resold?.items[0].serialNumbers, ["supplier-a-serial-1"]);
    assert.ok(resold);
    assert.equal(deleteSale(resold.id), true);
    assert.equal(deletePurchase(purchaseA.id), true);
    assert.equal(supplierBalance("supplier-a"), 0);
    assert.equal(Number(one("SELECT quantity FROM products WHERE id = ?", "product-a")?.quantity), 0);
  } finally {
    db.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
