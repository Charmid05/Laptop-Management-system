/**
 * Client-side cache of the backend data set. `useDB()` exposes every
 * collection; mutations go to the API and the affected collection is patched
 * with the record the server returns.
 */
import { useEffect, useSyncExternalStore } from "react";
import { ApiError, api } from "./api";
import type {
  AuditLog,
  Customer,
  InventoryTransaction,
  Invoice,
  ModuleKey,
  Payment,
  PracticeSettings,
  Product,
  PurchaseOrder,
  Role,
  ServiceTicket,
  Supplier,
  User,
} from "@/types";

export interface Collections {
  roles: Role[];
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  serviceTickets: ServiceTicket[];
  products: Product[];
  stock: InventoryTransaction[];
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditLog[];
}

export type CollectionName = keyof Collections;
export type Record_<K extends CollectionName> = Collections[K][number];

export interface DB extends Collections {
  settings: PracticeSettings;
  /** True once the signed-in user's data set has been loaded. */
  ready: boolean;
}

export const defaultSettings: PracticeSettings = {
  storeName: "Laptop Store",
  tagline: "Technology, ready for work",
  address: "",
  county: "",
  town: "",
  phone: "",
  email: "",
  currency: "KES",
  taxRate: 16,
  taxLabel: "VAT",
  invoicePrefix: "INV-",
  receiptPrefix: "RCP-",
  registrationNumber: "",
  kraPin: "",
  productCategories: ["Laptops", "Components", "Peripherals", "Accessories", "Other"],
  productBrands: ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "MSI", "Samsung", "Other"],
};

const empty = (): DB => ({
  roles: [],
  users: [],
  customers: [],
  suppliers: [],
  purchases: [],
  serviceTickets: [],
  products: [],
  stock: [],
  invoices: [],
  payments: [],
  audit: [],
  settings: defaultSettings,
  ready: false,
});

let db: DB = empty();
const listeners = new Set<() => void>();

function publish(next: DB) {
  db = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function getDB(): DB {
  return db;
}

export interface SupplierProductBalance {
  supplierId: string;
  productId: string;
  quantity: number;
  receivedQuantity: number;
}

export function supplierProductStock(source: Pick<DB, "stock"> = db): SupplierProductBalance[] {
  const balances = new Map<string, SupplierProductBalance>();
  for (const movement of source.stock) {
    if (!movement.supplierId) continue;
    const key = JSON.stringify([movement.supplierId, movement.productId]);
    const balance = balances.get(key) ?? {
      supplierId: movement.supplierId,
      productId: movement.productId,
      quantity: 0,
      receivedQuantity: 0,
    };
    balance.quantity += movement.quantity;
    if (
      movement.type === "stock_in" &&
      movement.quantity > 0 &&
      movement.reason.startsWith("Purchase ") &&
      movement.reason.endsWith(" received")
    ) {
      balance.receivedQuantity += movement.quantity;
    }
    balances.set(key, balance);
  }
  return [...balances.values()];
}

export function supplierProductSerialNumbers(
  source: Pick<DB, "purchases">,
  supplierId: string,
  productId: string,
): string[] {
  return source.purchases
    .filter(
      (purchase) =>
        (purchase.status === "ordered" || purchase.status === "delivered") &&
        purchase.supplierId === supplierId,
    )
    .sort((left, right) =>
      (left.receivedAt ?? left.orderDate).localeCompare(right.receivedAt ?? right.orderDate),
    )
    .flatMap((purchase) => purchase.items)
    .filter((item) => item.productId === productId)
    .flatMap((item) => item.serialNumbers ?? [])
    .map((serialNumber) => serialNumber.trim());
}

/** Pulls the whole data set for the signed-in user. */
export async function refresh(): Promise<void> {
  try {
    const data = await api<Omit<DB, "ready">>("/bootstrap");
    publish({
      ...data,
      settings: { ...defaultSettings, ...(data.settings ?? {}) },
      ready: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      publish({ ...empty(), settings: await publicSettings() });
      return;
    }
    throw error;
  }
}

async function publicSettings(): Promise<PracticeSettings> {
  try {
    const settings = await api<PracticeSettings>("/settings");
    return { ...defaultSettings, ...settings };
  } catch {
    return defaultSettings;
  }
}

export function reset(): void {
  publish(empty());
}

let loading: Promise<void> | null = null;

/** Loads the data set once per signed-in session. */
export function ensureLoaded(): void {
  if (db.ready || loading) return;
  loading = refresh()
    .catch((error: unknown) => console.error(error))
    .finally(() => {
      loading = null;
    });
}

export function useDB(): DB {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => db,
    () => db,
  );
  useEffect(ensureLoaded, []);
  return snapshot;
}

/* ------------------------------------------------------------- mutations */

const patchCollection = <K extends CollectionName>(name: K, record: Record_<K>) => {
  const rows = db[name] as Record_<K>[];
  const index = rows.findIndex((r) => r.id === record.id);
  const next =
    index === -1 ? [record, ...rows] : rows.map((r) => (r.id === record.id ? record : r));
  publish({ ...db, [name]: next } as DB);
};

async function refreshInventorySnapshot(): Promise<void> {
  try {
    const [products, stock] = await Promise.all([
      api<Product[]>("/products"),
      api<InventoryTransaction[]>("/stock"),
    ]);
    publish({ ...db, products, stock });
  } catch (error) {
    console.error("Could not refresh inventory after a stock mutation", error);
  }
}

export async function createRecord<K extends CollectionName>(
  name: K,
  body: Omit<Record_<K>, "id"> & { id?: string },
): Promise<Record_<K>> {
  const record = await api<Record_<K>>(`/${name}`, { method: "POST", body });
  patchCollection(name, record);
  if (name === "purchases") await refreshInventorySnapshot();
  return record;
}

export async function createSale(body: Omit<Invoice, "id"> & { id?: string }): Promise<Invoice> {
  const record = await api<Invoice>("/invoices/checkout", { method: "POST", body });
  patchCollection("invoices", record);
  await refreshInventorySnapshot();
  return record;
}

export async function updateRecord<K extends CollectionName>(
  name: K,
  id: string,
  patch: Partial<Record_<K>>,
): Promise<Record_<K>> {
  const record = await api<Record_<K>>(`/${name}/${id}`, { method: "PATCH", body: patch });
  patchCollection(name, record);
  if (name === "purchases") await refreshInventorySnapshot();
  return record;
}

export async function deleteRecord(name: CollectionName, id: string): Promise<void> {
  if (!id) return;

  try {
    await api(`/${name}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  publish({ ...db, [name]: (db[name] as { id?: string }[]).filter((r) => r.id !== id) } as DB);
  if (name === "purchases" || name === "invoices") await refreshInventorySnapshot();
}

export async function saveSettings(patch: Partial<PracticeSettings>): Promise<PracticeSettings> {
  const settings = await api<PracticeSettings>("/settings", { method: "PATCH", body: patch });
  publish({ ...db, settings });
  return settings;
}

export interface SeriesPoint {
  label: string;
  revenue: number;
  sales: number;
  newCustomers: number;
}

export const fetchAnalytics = () =>
  api<{ weekly: SeriesPoint[]; monthly: SeriesPoint[] }>("/analytics");

/* ---------------------------------------------------------------- helpers */

export const uid = (p = "id") =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function nextNumber(prefix: string, existing: string[]) {
  const nums = existing
    .map((s) => parseInt(s.replace(/\D/g, "").slice(-4), 10))
    .filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export const money = (n: number, cur = "KES") => `${cur} ${Math.round(n).toLocaleString("en-KE")}`;

export const customerName = (customer?: Customer) =>
  customer?.companyName || customer?.name || "Walk-in customer";

export function invoiceTotals(inv: Invoice, d: DB = db) {
  const subtotal = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0);
  const tax = (subtotal * inv.taxRate) / 100;
  const total = subtotal + tax;
  const paid = d.payments
    .filter((p) => p.invoiceId === inv.id && p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);
  return { subtotal, tax, total, paid, balance: Math.max(0, total - paid) };
}

export const canAccess = (roleId: string, m: ModuleKey) =>
  db.roles.find((r) => r.id === roleId)?.modules.includes(m) ?? false;

export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
