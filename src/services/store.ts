/**
 * In-memory mock data store. Swap these functions for API calls when a real
 * backend exists; shapes match `src/types`.
 */
import { useSyncExternalStore } from "react";
import * as seed from "@/data/seed";
import type {
  AuditLog, EyeExamination, EyePair, Invoice, ModuleKey, Patient, RefractionValues,
} from "@/types";

const initial = () => ({
  users: structuredClone(seed.users),
  roles: structuredClone(seed.roles),
  providers: structuredClone(seed.insuranceProviders),
  patients: structuredClone(seed.patients),
  appointments: structuredClone(seed.appointments),
  queue: structuredClone(seed.queue),
  visits: structuredClone(seed.visits),
  prescriptions: structuredClone(seed.prescriptions),
  invoices: structuredClone(seed.invoices),
  payments: structuredClone(seed.payments),
  claims: structuredClone(seed.claims),
  suppliers: structuredClone(seed.suppliers),
  products: structuredClone(seed.products),
  stock: structuredClone(seed.inventoryTransactions),
  audit: structuredClone(seed.auditLogs),
  settings: structuredClone(seed.practiceSettings),
});
export type DB = ReturnType<typeof initial>;

let db: DB = initial();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db, () => db);
}
export function getDB() {
  return db;
}
export function update(fn: (d: DB) => Partial<DB>) {
  db = { ...db, ...fn(db) };
  listeners.forEach((l) => l());
}

export const uid = (p = "id") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function nextNumber(prefix: string, existing: string[]) {
  const nums = existing.map((s) => parseInt(s.replace(/\D/g, "").slice(-4), 10)).filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function logAudit(userId: string, action: string, module: AuditLog["module"], record: string, description: string) {
  update((d) => ({
    audit: [{ id: uid("al"), userId, action, module, record, description, timestamp: nowISO() }, ...d.audit],
  }));
}

/* ---------------------------------------------------------------- helpers */

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
