/**
 * Table metadata plus a generic CRUD layer. Every resource maps one row to one
 * object of the matching type in `./types.ts`: scalar fields become columns,
 * nested objects/arrays are stored as JSON text.
 */
import { all, one, run, transaction } from "./db.ts";

export type ColumnKind = "text" | "int" | "real" | "json" | "bool";
export type Entity = Record<string, unknown>;

export interface Resource {
  table: string;
  columns: Record<string, ColumnKind>;
  orderBy: string;
  /** Extra work after the main row is written (e.g. invoice line items). */
  afterWrite?: (id: string, body: Entity) => void;
  /** Extra fields merged into the object that is read back. */
  hydrate?: (row: Entity) => Entity;
}

const t = "text" as const;

export const resources = {
  roles: {
    table: "roles",
    orderBy: "name",
    columns: { id: t, name: t, description: t, modules: "json" },
  },
  users: {
    table: "users",
    orderBy: "fullName",
    columns: {
      id: t, fullName: t, email: t, username: t, phone: t, role: t,
      status: t, lastLogin: t, createdAt: t,
    },
  },
  customers: {
    table: "customers",
    orderBy: "name",
    columns: {
      id: t, customerNumber: t, name: t, companyName: t, phone: t,
      email: t, address: t, notes: t, status: t, registeredAt: t,
    },
  },
  suppliers: {
    table: "suppliers",
    orderBy: "name",
    columns: {
      id: t, name: t, contactPerson: t, phone: t, email: t, address: t,
      productsSupplied: t, notes: t,
    },
  },
  purchases: {
    table: "purchases",
    orderBy: "orderDate DESC",
    columns: {
      id: t, purchaseNumber: t, supplierId: t, orderDate: t, receivedAt: t,
      status: t, items: "json", notes: t, createdBy: t, createdAt: t,
    },
  },
  serviceTickets: {
    table: "service_tickets",
    orderBy: "receivedAt DESC",
    columns: {
      id: t, ticketNumber: t, customerId: t, productId: t, serialNumber: t,
      issue: t, warrantyUntil: t, estimatedCost: "real", status: t,
      notes: t, receivedAt: t, createdBy: t,
    },
  },
  products: {
    table: "products",
    orderBy: "name",
    columns: {
      id: t, sku: t, name: t, hasSerialNumber: "bool", category: t, brand: t, parentProductId: t,
      variantLabel: t, supplierId: t,
      costPrice: "real", sellingPrice: "real", quantity: "int",
      reorderLevel: "int", location: t, status: t,
    },
  },
  stock: {
    table: "inventory_transactions",
    orderBy: "date DESC",
    columns: {
      id: t, productId: t, supplierId: t, type: t, quantity: "int", reason: t, reference: t,
      date: t, recordedBy: t,
    },
  },
  invoices: {
    table: "invoices",
    orderBy: "date DESC",
    columns: {
      id: t, invoiceNumber: t, customerId: t, date: t, taxRate: "real",
      status: t, notes: t, createdBy: t, createdAt: t,
    },
    afterWrite: (id, body) => {
      if (!Array.isArray(body.items)) return;
      run("DELETE FROM invoice_items WHERE invoiceId = ?", id);
      body.items.forEach((raw, index) => {
        const item = raw as Entity;
        run(
          `INSERT INTO invoice_items
             (id, invoiceId, position, description, productId, supplierId, serviceCode, quantity, unitPrice, discount, serialNumbers)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          String(item.id ?? newId("ii")),
          id,
          index,
          String(item.description ?? ""),
          item.productId == null ? null : String(item.productId),
          item.supplierId == null ? null : String(item.supplierId),
          item.serviceCode == null ? null : String(item.serviceCode),
          Number(item.quantity ?? 1),
          Number(item.unitPrice ?? 0),
          Number(item.discount ?? 0),
          JSON.stringify(Array.isArray(item.serialNumbers) ? item.serialNumbers : []),
        );
      });
    },
    hydrate: (row) => ({
      ...row,
      items: all(
        "SELECT id, description, productId, supplierId, serviceCode, quantity, unitPrice, discount, serialNumbers FROM invoice_items WHERE invoiceId = ? ORDER BY position",
        String(row.id),
      ).map((item) => {
        const clean: Entity = {};
        for (const [key, value] of Object.entries(item)) {
          if (key === "serialNumbers") {
            clean[key] = JSON.parse(String(value ?? "[]"));
          } else if (value !== null) {
            clean[key] = value;
          }
        }
        return clean;
      }),
    }),
  },
  payments: {
    table: "payments",
    orderBy: "date DESC",
    columns: {
      id: t, receiptNumber: t, invoiceId: t, customerId: t, amount: "real",
      method: t, reference: t, date: t, receivedBy: t, status: t, notes: t,
    },
  },
  audit: {
    table: "audit_logs",
    orderBy: "timestamp DESC",
    columns: {
      id: t, userId: t, action: t, module: t, record: t, timestamp: t,
      description: t,
    },
  },
} satisfies Record<string, Resource>;

export type ResourceName = keyof typeof resources;

export const isResourceName = (name: string): name is ResourceName =>
  Object.hasOwn(resources, name);

export const newId = (prefix = "id") =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function toColumn(kind: ColumnKind, value: unknown): string | number | null {
  if (kind === "bool") return value === true || value === 1 || value === "true" || value === "1" ? 1 : 0;
  if (value === undefined || value === null) return null;
  if (kind === "json") return JSON.stringify(value);
  if (kind === "int") return Math.trunc(Number(value));
  if (kind === "real") return Number(value);
  return typeof value === "string" ? value : String(value);
}

function fromRow(resource: Resource, row: Entity): Entity {
  const out: Entity = {};
  for (const [field, kind] of Object.entries(resource.columns)) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    out[field] = kind === "json" ? JSON.parse(String(value)) : kind === "bool" ? Boolean(value) : value;
  }
  return resource.hydrate ? resource.hydrate(out) : out;
}

export function list(name: ResourceName): Entity[] {
  const resource: Resource = resources[name];
  const fields = Object.keys(resource.columns).join(", ");
  return all(`SELECT ${fields} FROM ${resource.table} ORDER BY ${resource.orderBy}`)
    .map((row) => fromRow(resource, row as Entity));
}

export function find(name: ResourceName, id: string): Entity | undefined {
  const resource: Resource = resources[name];
  const fields = Object.keys(resource.columns).join(", ");
  const row = one(`SELECT ${fields} FROM ${resource.table} WHERE id = ?`, id);
  return row ? fromRow(resource, row as Entity) : undefined;
}

export function purchaseSerialNumberError(items: unknown, excludingPurchaseId?: string): string | undefined {
  if (!Array.isArray(items)) return undefined;

  const submittedSerialNumbers = new Set<string>();
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Entity;
    const serialNumbers = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];

    if (serialNumbers.length > 0 && serialNumbers.length !== Number(item.quantity)) {
      return "Enter one serial number for each unit when serial numbers are enabled.";
    }

    for (const rawSerialNumber of serialNumbers) {
      if (typeof rawSerialNumber !== "string" || !rawSerialNumber.trim()) {
        return "Serial numbers cannot be blank.";
      }
      const serialNumber = rawSerialNumber.trim().toLowerCase();
      if (submittedSerialNumbers.has(serialNumber)) {
        return "Serial numbers must be unique within the purchase.";
      }
      submittedSerialNumbers.add(serialNumber);
    }
  }

  const existingSerialNumbers = new Set(
    list("purchases")
      .filter((purchase) => purchase.id !== excludingPurchaseId && purchase.status !== "cancelled")
      .flatMap((purchase) => (purchase.items as Entity[]).flatMap((item) =>
        Array.isArray(item.serialNumbers) ? item.serialNumbers : [],
      ))
      .filter((serialNumber): serialNumber is string => typeof serialNumber === "string")
      .map((serialNumber) => serialNumber.trim().toLowerCase()),
  );
  if ([...submittedSerialNumbers].some((serialNumber) => existingSerialNumbers.has(serialNumber))) {
    return "A serial number is already used on another purchase.";
  }
  return undefined;
}

function supplierInventoryQuantity(supplierId: string, productId: string): number {
  const row = one(
    "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_transactions WHERE supplierId = ? AND productId = ?",
    supplierId,
    productId,
  );
  return Number(row?.quantity ?? 0);
}

function supplierAvailableSerialNumbers(supplierId: string, productId: string): string[] {
  const soldSerialNumbers = new Set(
    list("invoices")
      .flatMap((invoice) => invoice.items as Entity[])
      .flatMap((item) => Array.isArray(item.serialNumbers) ? item.serialNumbers : [])
      .filter((serialNumber): serialNumber is string => typeof serialNumber === "string")
      .map((serialNumber) => serialNumber.trim().toLowerCase()),
  );

  return list("purchases")
    .filter((purchase) => (purchase.status === "ordered" || purchase.status === "received" || purchase.status === "delivered") && purchase.supplierId === supplierId)
    .sort((left, right) =>
      String(left.receivedAt ?? left.orderDate).localeCompare(String(right.receivedAt ?? right.orderDate)),
    )
    .flatMap((purchase) => purchase.items as Entity[])
    .filter((item) => String(item.productId) === productId)
    .flatMap((item) => Array.isArray(item.serialNumbers) ? item.serialNumbers : [])
    .filter((serialNumber): serialNumber is string => typeof serialNumber === "string" && Boolean(serialNumber.trim()))
    .map((serialNumber) => serialNumber.trim())
    .filter((serialNumber) => !soldSerialNumbers.has(serialNumber.toLowerCase()));
}

export function saleSerialNumberError(body: Entity): string | undefined {
  if (!Array.isArray(body.items)) return undefined;
  const offsets = new Map<string, number>();
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Entity;
    if (!item.productId) continue;
    const productId = String(item.productId);
    const supplierId = String(item.supplierId ?? "");
    const quantity = Number(item.quantity);
    const product = find("products", productId);
    if (!product || !Number.isInteger(quantity) || quantity < 1) continue;

    const availableSerialNumbers = supplierAvailableSerialNumbers(supplierId, productId);
    const key = JSON.stringify([supplierId, productId]);
    const offset = offsets.get(key) ?? 0;
    const assignedCount = availableSerialNumbers.slice(offset, offset + quantity).length;
    if (availableSerialNumbers.length > 0 && assignedCount !== quantity) {
      return "Not enough serial-numbered stock is available for one or more products.";
    }
    offsets.set(key, offset + assignedCount);
  }
  return undefined;
}

export function create(name: ResourceName, body: Entity): Entity {
  const resource: Resource = resources[name];
  const id = typeof body.id === "string" && body.id ? body.id : newId(name.slice(0, 2));
  const fields = Object.keys(resource.columns);
  const values = fields.map((field) =>
    toColumn(resource.columns[field], field === "id" ? id : body[field]),
  );
  return transaction(() => {
    run(
      `INSERT INTO ${resource.table} (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
      ...values,
    );
    resource.afterWrite?.(id, body);
    return find(name, id)!;
  });
}

export function update(name: ResourceName, id: string, patch: Entity): Entity | undefined {
  const resource: Resource = resources[name];
  if (!find(name, id)) return undefined;
  const fields = Object.keys(resource.columns).filter(
    (field) => field !== "id" && Object.hasOwn(patch, field),
  );
  return transaction(() => {
    if (fields.length > 0) {
      run(
        `UPDATE ${resource.table} SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ?`,
        ...fields.map((field) => toColumn(resource.columns[field], patch[field])),
        id,
      );
    }
    resource.afterWrite?.(id, patch);
    return find(name, id);
  });
}

export function remove(name: ResourceName, id: string): boolean {
  const resource: Resource = resources[name];
  if (!find(name, id)) return false;
  run(`DELETE FROM ${resource.table} WHERE id = ?`, id);
  return true;
}

export function updatePurchase(id: string, patch: Entity, updatedBy: string): Entity | undefined {
  const purchase = find("purchases", id);
  if (!purchase || !["ordered", "delivered", "returned", "cancelled"].includes(String(purchase.status))) return undefined;

  // Handle status transitions
  if (Object.hasOwn(patch, "status") && patch.status !== purchase.status) {
    const newStatus = String(patch.status);
    const oldStatus = String(purchase.status);

    // Stock is added when the purchase is created; delivery only changes its status.
    if (oldStatus === "ordered" && newStatus === "delivered") {
      return update("purchases", id, {
        status: "delivered",
        receivedAt: Object.hasOwn(patch, "receivedAt") ? patch.receivedAt : new Date().toISOString(),
      });
    }

    // Returning a purchase removes its still-available units from inventory.
    if (oldStatus === "ordered" && newStatus === "returned") {
      const items = Array.isArray(purchase.items) ? purchase.items as Entity[] : [];
      if (items.length === 0) return undefined;
      const quantities = new Map<string, number>();
      for (const item of items) {
        const productId = String(item.productId);
        const quantity = Number(item.quantity);
        quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
      }
      for (const [productId, quantity] of quantities) {
        const product = find("products", productId);
        if (
          !product ||
          Number(product.quantity) < quantity ||
          supplierInventoryQuantity(String(purchase.supplierId), productId) < quantity
        ) return undefined;
      }

      const returnedAt = Object.hasOwn(patch, "receivedAt") ? String(patch.receivedAt) : new Date().toISOString();
      return transaction(() => {
        for (const [productId, quantity] of quantities) {
          const product = find("products", productId)!;
          update("products", productId, { quantity: Number(product.quantity) - quantity });
          create("stock", {
            productId,
            supplierId: String(purchase.supplierId),
            type: "stock_out",
            quantity: -quantity,
            reason: `Purchase ${purchase.purchaseNumber} returned`,
            reference: String(purchase.purchaseNumber),
            date: returnedAt,
            recordedBy: updatedBy,
          });
        }
        return update("purchases", id, { status: "returned", receivedAt: returnedAt });
      });
    }

    // Other status changes not allowed
    return undefined;
  }

  const oldItems = Array.isArray(purchase.items) ? purchase.items as Entity[] : [];
  const nextItems = Object.hasOwn(patch, "items") ? patch.items : oldItems;
  if (!Array.isArray(nextItems) || nextItems.length === 0 || nextItems.some((item) => {
    const productId = String(item.productId ?? "");
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const sellingPrice = item.sellingPrice == null ? 0 : Number(item.sellingPrice);
    return !find("products", productId) || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0;
  })) return undefined;
  if (Object.hasOwn(patch, "items") && purchaseSerialNumberError(nextItems, id)) return undefined;

  const nextSupplierId = String(patch.supplierId ?? purchase.supplierId);
  if (!nextSupplierId) return undefined;
  const nextPatch = { ...patch, supplierId: nextSupplierId, status: purchase.status };
  const reconcileReceivedStock = (purchase.status === "ordered" || purchase.status === "received" || purchase.status === "delivered") && (
    Object.hasOwn(patch, "items") || nextSupplierId !== String(purchase.supplierId)
  );
  if (!reconcileReceivedStock) return update("purchases", id, nextPatch);

  const supplierDeltas = new Map<string, { productId: string; supplierId: string; quantity: number }>();
  const addSupplierDelta = (supplierId: string, item: Entity, quantity: number) => {
    const productId = String(item.productId);
    const key = JSON.stringify([supplierId, productId]);
    const delta = supplierDeltas.get(key) ?? { productId, supplierId, quantity: 0 };
    delta.quantity += quantity;
    supplierDeltas.set(key, delta);
  };
  for (const item of oldItems) addSupplierDelta(String(purchase.supplierId), item, -Number(item.quantity));
  for (const item of nextItems) addSupplierDelta(nextSupplierId, item, Number(item.quantity));
  for (const delta of supplierDeltas.values()) {
    if (supplierInventoryQuantity(delta.supplierId, delta.productId) + delta.quantity < 0) return undefined;
  }

  const oldQuantities = new Map<string, number>();
  const nextQuantities = new Map<string, number>();
  const oldSellingPrices = new Map<string, number>();
  const nextSellingPrices = new Map<string, number>();
  for (const item of oldItems) {
    const productId = String(item.productId);
    oldQuantities.set(productId, (oldQuantities.get(productId) ?? 0) + Number(item.quantity));
    if (item.sellingPrice != null && Number.isFinite(Number(item.sellingPrice))) oldSellingPrices.set(productId, Number(item.sellingPrice));
  }
  for (const item of nextItems) {
    const productId = String(item.productId);
    nextQuantities.set(productId, (nextQuantities.get(productId) ?? 0) + Number(item.quantity));
    if (item.sellingPrice != null && Number.isFinite(Number(item.sellingPrice))) nextSellingPrices.set(productId, Number(item.sellingPrice));
  }

  const productIds = new Set([...oldQuantities.keys(), ...nextQuantities.keys()]);
  const productUpdates = new Map<string, { product: Entity; quantity: number }>();
  for (const productId of productIds) {
    const product = find("products", productId);
    if (!product) return undefined;
    const quantity = Number(product.quantity) + (nextQuantities.get(productId) ?? 0) - (oldQuantities.get(productId) ?? 0);
    if (quantity < 0) return undefined;
    productUpdates.set(productId, { product, quantity });
  }

  return transaction(() => {
    for (const [productId, { product, quantity }] of productUpdates) {
      const productPatch: Entity = { quantity };
      const previousPrice = oldSellingPrices.get(productId);
      const nextPrice = nextSellingPrices.get(productId);
      if (nextPrice !== undefined && (previousPrice === undefined || Number(product.sellingPrice) === previousPrice)) {
        productPatch.sellingPrice = nextPrice;
      }
      if (product.supplierId == null || String(product.supplierId) === String(purchase.supplierId)) {
        productPatch.supplierId = nextSupplierId;
      }
      update("products", productId, productPatch);
    }

    const purchaseNumber = String(purchase.purchaseNumber);
    const receiptReason = `Purchase ${purchaseNumber} received`;
    run("DELETE FROM inventory_transactions WHERE type = 'stock_in' AND reference = ? AND reason = ?", purchaseNumber, receiptReason);
    const receivedAt = String(purchase.receivedAt ?? new Date().toISOString());
    for (const item of nextItems) {
      create("stock", {
        productId: String(item.productId),
        supplierId: nextSupplierId,
        type: "stock_in",
        quantity: Number(item.quantity),
        reason: receiptReason,
        reference: purchaseNumber,
        date: receivedAt,
        recordedBy: updatedBy,
      });
    }

    return update("purchases", id, nextPatch);
  });
}

export function deletePurchase(id: string, force: boolean = false): boolean {
  const purchase = find("purchases", id);
  if (!purchase) return false;
  if (purchase.status === "returned") {
    return transaction(() => {
      run("DELETE FROM inventory_transactions WHERE reference = ? AND reason IN (?, ?)",
        String(purchase.purchaseNumber),
        `Purchase ${purchase.purchaseNumber} received`,
        `Purchase ${purchase.purchaseNumber} returned`,
      );
      return remove("purchases", id);
    });
  }
  if (purchase.status !== "ordered" && purchase.status !== "received" && purchase.status !== "delivered") return remove("purchases", id);
  if (!Array.isArray(purchase.items) || purchase.items.length === 0) return false;

  const quantities = new Map<string, number>();
  for (const item of purchase.items as Entity[]) {
    const productId = String(item.productId);
    quantities.set(productId, (quantities.get(productId) ?? 0) + Number(item.quantity));
  }

  // Only check inventory if not forcing deletion
  if (!force) {
    for (const [productId, quantity] of quantities) {
      const product = find("products", productId);
      if (!product || Number(product.quantity) < quantity || supplierInventoryQuantity(String(purchase.supplierId), productId) < quantity) return false;
    }
  }

  return transaction(() => {
    for (const [productId, quantity] of quantities) {
      const product = find("products", productId)!;
      // Force update quantity even if it would go negative
      const newQuantity = Math.max(0, Number(product.quantity) - quantity);
      update("products", productId, { quantity: newQuantity });
    }
    const purchaseNumber = String(purchase.purchaseNumber);
    run(
      "DELETE FROM inventory_transactions WHERE type = 'stock_in' AND reference = ? AND reason = ?",
      purchaseNumber,
      `Purchase ${purchaseNumber} received`,
    );
    return remove("purchases", id);
  });
}

export function createPurchase(body: Entity, recordedBy: string): Entity | undefined {
  if (!find("suppliers", String(body.supplierId ?? "")) || !Array.isArray(body.items) || body.items.length === 0) {
    return undefined;
  }
  const items = body.items as Entity[];
  if (items.some((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const sellingPrice = item.sellingPrice == null ? 0 : Number(item.sellingPrice);
    const product = find("products", String(item.productId ?? ""));
    return !product || product.status !== "active" || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0;
  }) || purchaseSerialNumberError(items)) return undefined;

  return transaction(() => {
    const purchase = create("purchases", { ...body, status: "ordered" });
    const stockAddedAt = new Date().toISOString();
    for (const item of items) {
      const productId = String(item.productId);
      const quantity = Number(item.quantity);
      const product = find("products", productId)!;
      const productPatch: Entity = {
        quantity: Number(product.quantity) + quantity,
        supplierId: String(purchase.supplierId),
      };
      const sellingPrice = Number(item.sellingPrice);
      if (Number.isFinite(sellingPrice) && sellingPrice >= 0) productPatch.sellingPrice = sellingPrice;
      update("products", productId, productPatch);
      create("stock", {
        productId,
        supplierId: String(purchase.supplierId),
        type: "stock_in",
        quantity,
        reason: `Purchase ${purchase.purchaseNumber} received`,
        reference: String(purchase.purchaseNumber),
        date: stockAddedAt,
        recordedBy,
      });
    }
    return find("purchases", purchase.id)!;
  });
}

export function createSale(body: Entity): Entity | undefined {
  if (!find("customers", String(body.customerId ?? "")) || !Array.isArray(body.items) || body.items.length === 0) {
    return undefined;
  }

  const items = body.items as Entity[];
  const quantities = new Map<string, number>();
  const supplierQuantities = new Map<string, { productId: string; supplierId: string; quantity: number }>();
  for (const item of items) {
    if (!item.productId) continue;
    const productId = String(item.productId);
    const supplierId = String(item.supplierId ?? "");
    const quantity = Number(item.quantity);
    const product = find("products", productId);
    if (!product || product.status !== "active" || !find("suppliers", supplierId) || !Number.isInteger(quantity) || quantity < 1) return undefined;
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    const key = JSON.stringify([supplierId, productId]);
    const supplierQuantity = supplierQuantities.get(key) ?? { productId, supplierId, quantity: 0 };
    supplierQuantity.quantity += quantity;
    supplierQuantities.set(key, supplierQuantity);
  }
  for (const { productId, supplierId, quantity } of supplierQuantities.values()) {
    if (supplierInventoryQuantity(supplierId, productId) < quantity) return undefined;
  }
  for (const [productId, quantity] of quantities) {
    const product = find("products", productId)!;
    if (Number(product.quantity) < quantity) return undefined;
  }
  if (saleSerialNumberError(body)) return undefined;

  return transaction(() => {
    const serialOffsets = new Map<string, number>();
    const invoiceItems: Entity[] = [];
    for (const item of items) {
      if (!item.productId) {
        invoiceItems.push(item);
        continue;
      }

      const productId = String(item.productId);
      const supplierId = String(item.supplierId);
      const quantity = Number(item.quantity);
      const availableSerialNumbers = supplierAvailableSerialNumbers(supplierId, productId);
      const key = JSON.stringify([supplierId, productId]);
      const offset = serialOffsets.get(key) ?? 0;
      const assignedSerialNumbers = availableSerialNumbers.slice(offset, offset + quantity);
      const requiresSerialNumbers = availableSerialNumbers.length > 0;
      if (requiresSerialNumbers && assignedSerialNumbers.length !== quantity) return undefined;
      serialOffsets.set(key, offset + assignedSerialNumbers.length);
      invoiceItems.push({
        ...item,
        serialNumbers: requiresSerialNumbers ? assignedSerialNumbers : [],
      });
    }

    const invoice = create("invoices", { ...body, items: invoiceItems });
    const recordedAt = new Date().toISOString();
    for (const [productId, quantity] of quantities) {
      const product = find("products", productId)!;
      update("products", productId, { quantity: Number(product.quantity) - quantity });
    }
    for (const { productId, supplierId, quantity } of supplierQuantities.values()) {
      create("stock", {
        productId,
        supplierId,
        type: "stock_out",
        quantity: -quantity,
        reason: `Sale ${String(invoice.invoiceNumber)} recorded`,
        reference: String(invoice.invoiceNumber),
        date: recordedAt,
        recordedBy: String(body.createdBy),
      });
    }
    return invoice;
  });
}

export function deleteSale(id: string): boolean {
  const invoice = find("invoices", id);
  if (!invoice || !Array.isArray(invoice.items)) return false;

  const productQuantities = new Map<string, number>();
  const supplierQuantities = new Map<string, { productId: string; supplierId: string; quantity: number }>();
  for (const rawItem of invoice.items as Entity[]) {
    if (!rawItem.productId) continue;
    const productId = String(rawItem.productId);
    const product = find("products", productId);
    const supplierId = String(rawItem.supplierId ?? product?.supplierId ?? "");
    const quantity = Number(rawItem.quantity);
    if (!product || !supplierId || !Number.isInteger(quantity) || quantity < 1) return false;
    productQuantities.set(productId, (productQuantities.get(productId) ?? 0) + quantity);
    const key = JSON.stringify([supplierId, productId]);
    const supplierQuantity = supplierQuantities.get(key) ?? { productId, supplierId, quantity: 0 };
    supplierQuantity.quantity += quantity;
    supplierQuantities.set(key, supplierQuantity);
  }

  return transaction(() => {
    for (const [productId, quantity] of productQuantities) {
      const product = find("products", productId)!;
      update("products", productId, { quantity: Number(product.quantity) + quantity });
    }
    const reversedAt = new Date().toISOString();
    for (const { productId, supplierId, quantity } of supplierQuantities.values()) {
      create("stock", {
        productId,
        supplierId,
        type: "stock_in",
        quantity,
        reason: `Sale ${String(invoice.invoiceNumber)} reversed`,
        reference: String(invoice.invoiceNumber),
        date: reversedAt,
        recordedBy: String(invoice.createdBy),
      });
    }
    return remove("invoices", id);
  });
}

export function settings(): Entity {
  const row = one("SELECT data FROM practice_settings WHERE id = 1");
  return row ? (JSON.parse(String(row.data)) as Entity) : {};
}

export function saveSettings(patch: Entity): Entity {
  const next = { ...settings(), ...patch };
  run(
    "INSERT INTO practice_settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    JSON.stringify(next),
  );
  return next;
}

export function logAudit(
  userId: string,
  action: string,
  module: string,
  record: string,
  description: string,
): void {
  run(
    "INSERT INTO audit_logs (id, userId, action, module, record, timestamp, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("al"),
    userId,
    action,
    module,
    record,
    new Date().toISOString(),
    description,
  );
}
