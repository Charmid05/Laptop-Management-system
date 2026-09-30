/**
 * Demonstration data loaded into SQLite the first time the backend starts
 * against an empty database (see `./seed.ts`). Shapes match `./types.ts`.
 */

import type {
  Appointment,
  AuditLog,
  ClinicalVisit,
  EyeExamination,
  InsuranceClaim,
  InsuranceProvider,
  InventoryTransaction,
  Invoice,
  Patient,
  Payment,
  PracticeSettings,
  Prescription,
  Product,
  QueueEntry,
  RefractionValues,
  Role,
  Supplier,
  User,
} from "./types.ts";

export const today = (): string => new Date().toISOString().slice(0, 10);

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const isoDaysAgo = (n: number, hour = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

export const roles: Role[] = [
  {
    id: "administrator",
    name: "Administrator",
    description: "Full access to every module including users and settings.",
    modules: [
      "dashboard",
      "patients",
      "appointments",
      "queue",
      "clinical",
      "prescriptions",
      "invoices",
      "payments",
      "insurance",
      "inventory",
      "suppliers",
      "reports",
      "administration",
      "settings",
    ],
  },
  {
    id: "receptionist",
    name: "Receptionist / Front Desk",
    description: "Registers patients, books appointments and manages the queue.",
    modules: ["dashboard", "patients", "appointments", "queue", "invoices"],
  },
  {
    id: "optometrist",
    name: "Optometrist / Clinician",
    description: "Runs eye examinations and issues prescriptions.",
    modules: [
      "dashboard",
      "patients",
      "appointments",
      "queue",
      "clinical",
      "prescriptions",
      "reports",
    ],
  },
  {
    id: "cashier",
    name: "Cashier / Accounts",
    description: "Handles invoicing, payments, receipts and insurance claims.",
    modules: ["dashboard", "patients", "invoices", "payments", "insurance", "reports"],
  },
  {
    id: "store_officer",
    name: "Inventory / Store Officer",
    description: "Manages optical stock, suppliers and stock movements.",
    modules: ["dashboard", "inventory", "suppliers", "reports"],
  },
];

export const users: User[] = [];

export const clinicians = users.filter(
  (u) => u.role === "optometrist" || u.role === "administrator",
);

export const insuranceProviders: InsuranceProvider[] = [];

export const patients: Patient[] = [];

const t = today();

export const appointments: Appointment[] = [];

export const queue: QueueEntry[] = [];

const rx = (
  sphere: string,
  cylinder: string,
  axis: string,
  add = "0.00",
  va = "6/6",
): RefractionValues => ({ sphere, cylinder, axis, add, prism: "", va });

const examFor = (
  odS: string,
  osS: string,
  odC: string,
  osC: string,
): EyeExamination => ({
  visualAcuity: {
    unaidedOd: "6/18",
    unaidedOs: "6/24",
    unaidedNear: "N8",
    aidedOd: "6/6",
    aidedOs: "6/6",
    pinholeOd: "6/9",
    pinholeOs: "6/9",
  },
  refraction: {
    unaided: { od: rx("", "", "", "0.00", "6/18"), os: rx("", "", "", "0.00", "6/24") },
    objective: { od: rx(odS, odC, "175"), os: rx(osS, osC, "008") },
    subjective: { od: rx(odS, odC, "178"), os: rx(osS, osC, "008") },
    final: { od: rx(odS, odC, "178"), os: rx(osS, osC, "008") },
  },
  pd: "62",
  nearPd: "59",
  binocularVision: "Orthophoric at distance, 4 exophoria at near",
  colourVision: "Normal (Ishihara 12/12)",
  ocularMotility: "Full, smooth and comitant",
  pupils: "PERRLA, no RAPD",
  anteriorSegment: "Clear cornea, quiet anterior chamber, lens clear",
  posteriorSegment: "Healthy discs, CD ratio 0.3, flat maculae",
  iopOd: "14",
  iopOs: "15",
  keratometry: "43.25 / 44.00 @ 175",
  contactLensNotes: "",
});

export const visits: ClinicalVisit[] = [];

export const prescriptions: Prescription[] = [];

export const invoices: Invoice[] = [];

export const payments: Payment[] = [];

export const claims: InsuranceClaim[] = [];

export const suppliers: Supplier[] = [];

export const products: Product[] = [];

export const inventoryTransactions: InventoryTransaction[] = [];

export const auditLogs: AuditLog[] = [];

export const practiceSettings: PracticeSettings = {
  practiceName: "My Practice",
  tagline: "Your tagline here",
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
