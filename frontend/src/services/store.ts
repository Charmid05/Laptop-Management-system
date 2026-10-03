/**
 * Client-side cache of the backend data set. `useDB()` exposes every
 * collection; mutations go to the API and the affected collection is patched
 * with the record the server returns.
 */
import { useEffect, useSyncExternalStore } from "react";
import { ApiError, api } from "./api";
import type {
  Appointment, AuditLog, ClinicalVisit, EyeExamination, EyePair, InsuranceClaim,
  InsuranceProvider, InventoryTransaction, Invoice, ModuleKey, Patient, Payment,
  PracticeSettings, Prescription, Product, RefractionValues, Role,
  Supplier, User,
} from "@/types";

export interface Collections {
  roles: Role[];
  users: User[];
  providers: InsuranceProvider[];
  patients: Patient[];
  appointments: Appointment[];
  visits: ClinicalVisit[];
  prescriptions: Prescription[];
  suppliers: Supplier[];
  products: Product[];
  stock: InventoryTransaction[];
  invoices: Invoice[];
  payments: Payment[];
  claims: InsuranceClaim[];
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
  practiceName: "Amani Eye Centre",
  tagline: "Clear sight, cared for",
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
  prescriptionPrefix: "RX-",
  registrationNumber: "",
  kraPin: "",
};

const empty = (): DB => ({
  roles: [], users: [], providers: [], patients: [], appointments: [],
  visits: [], prescriptions: [], suppliers: [], products: [], stock: [],
  invoices: [], payments: [], claims: [], audit: [],
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

/** Pulls the whole data set for the signed-in user. */
export async function refresh(): Promise<void> {
  try {
    const data = await api<Omit<DB, "ready">>("/bootstrap");
    publish({ ...data, ready: true });
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
    return await api<PracticeSettings>("/settings");
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
  const snapshot = useSyncExternalStore(subscribe, () => db, () => db);
  useEffect(ensureLoaded, []);
  return snapshot;
}

/* ------------------------------------------------------------- mutations */

const patchCollection = <K extends CollectionName>(name: K, record: Record_<K>) => {
  const rows = db[name] as Record_<K>[];
  const index = rows.findIndex((r) => r.id === record.id);
  const next = index === -1 ? [record, ...rows] : rows.map((r) => (r.id === record.id ? record : r));
  publish({ ...db, [name]: next } as DB);
};

export async function createRecord<K extends CollectionName>(
  name: K,
  body: Omit<Record_<K>, "id"> & { id?: string },
): Promise<Record_<K>> {
  const record = await api<Record_<K>>(`/${name}`, { method: "POST", body });
  patchCollection(name, record);
  return record;
}

export async function updateRecord<K extends CollectionName>(
  name: K,
  id: string,
  patch: Partial<Record_<K>>,
): Promise<Record_<K>> {
  const record = await api<Record_<K>>(`/${name}/${id}`, { method: "PATCH", body: patch });
  patchCollection(name, record);
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
}

export async function saveSettings(patch: Partial<PracticeSettings>): Promise<PracticeSettings> {
  const settings = await api<PracticeSettings>("/settings", { method: "PATCH", body: patch });
  publish({ ...db, settings });
  return settings;
}

export interface SeriesPoint {
  label: string;
  revenue: number;
  visits: number;
  newPatients: number;
  returning: number;
}

export const fetchAnalytics = () =>
  api<{ weekly: SeriesPoint[]; monthly: SeriesPoint[] }>("/analytics");

/* ---------------------------------------------------------------- helpers */

export const uid = (p = "id") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function nextNumber(prefix: string, existing: string[]) {
  const nums = existing.map((s) => parseInt(s.replace(/\D/g, "").slice(-4), 10)).filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export const money = (n: number, cur = "KES") =>
  `${cur} ${Math.round(n).toLocaleString("en-KE")}`;

export const patientName = (p?: Patient) =>
  p ? [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ") : "Unknown";

export const age = (dob: string) =>
  Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));

export function invoiceTotals(inv: Invoice, d: DB = db) {
  const subtotal = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0);
  const tax = (subtotal * inv.taxRate) / 100;
  const total = subtotal + tax;
  const paid = d.payments
    .filter((p) => p.invoiceId === inv.id && p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);
  return { subtotal, tax, total, paid, balance: Math.max(0, total - paid) };
}

export const blankRx = (): RefractionValues => ({ sphere: "", cylinder: "", axis: "", add: "", prism: "", va: "" });
export const blankPair = (): EyePair<RefractionValues> => ({ od: blankRx(), os: blankRx() });
export const blankExam = (): EyeExamination => ({
  visualAcuity: { unaidedOd: "", unaidedOs: "", unaidedNear: "", aidedOd: "", aidedOs: "", pinholeOd: "", pinholeOs: "" },
  refraction: { unaided: blankPair(), objective: blankPair(), subjective: blankPair(), final: blankPair() },
  pd: "", nearPd: "", binocularVision: "", colourVision: "", ocularMotility: "", pupils: "",
  anteriorSegment: "", posteriorSegment: "", iopOd: "", iopOs: "", keratometry: "", contactLensNotes: "",
});

export const canAccess = (roleId: string, m: ModuleKey) =>
  db.roles.find((r) => r.id === roleId)?.modules.includes(m) ?? false;

export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
