/**
 * Domain models for the practice management system.
 *
 * These interfaces are the contract between the UI and the data layer. A real
 * backend should serve these exact shapes so `src/services/*` can be swapped
 * for HTTP calls without touching components.
 */

export type ISODate = string; // "2026-05-14"
export type ISODateTime = string; // "2026-05-14T09:30:00.000Z"

/* ------------------------------------------------------------------ roles */

export type RoleId =
  | "administrator"
  | "receptionist"
  | "optometrist"
  | "cashier"
  | "store_officer";

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  /** Module keys this role may open. */
  modules: ModuleKey[];
}

export type ModuleKey =
  | "dashboard"
  | "patients"
  | "appointments"
  | "queue"
  | "clinical"
  | "prescriptions"
  | "invoices"
  | "payments"
  | "insurance"
  | "inventory"
  | "suppliers"
  | "reports"
  | "administration"
  | "settings";

export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phone: string;
  role: RoleId;
  status: "active" | "disabled";
  lastLogin: ISODateTime | null;
  createdAt: ISODateTime;
}

/* --------------------------------------------------------------- patients */

export type Gender = "male" | "female" | "other";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface NextOfKin {
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

export interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: ISODate;
  gender: Gender;
  nationalId?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  county: string;
  town: string;
  address?: string;
  emergencyContact: EmergencyContact;
  nextOfKin?: NextOfKin;
  occupation?: string;
  referralSource?: string;
  insuranceProviderId?: string;
  insuranceMemberNumber?: string;
  notes?: string;
  status: "active" | "archived";
  registeredAt: ISODateTime;
  lastVisitAt: ISODateTime | null;
}

/* ----------------------------------------------------------- appointments */

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentType =
  | "new_consultation"
  | "review"
  | "eye_test"
  | "contact_lens_fitting"
  | "spectacle_collection"
  | "follow_up";

export interface Appointment {
  id: string;
  patientId: string;
  date: ISODate;
  time: string; // "09:30"
  clinicianId: string;
  type: AppointmentType;
  reason: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: ISODateTime;
}

export interface QueueEntry {
  id: string;
  patientId: string;
  appointmentId?: string;
  queueNumber: number;
  arrivalTime: string; // "08:52"
  appointmentTime?: string;
  clinicianId: string;
  status: Extract<
    AppointmentStatus,
    "waiting" | "checked_in" | "in_consultation" | "completed" | "no_show"
  >;
  date: ISODate;
}

/* --------------------------------------------------------------- clinical */

export interface EyePair<T> {
  od: T; // right eye
  os: T; // left eye
}

export interface RefractionValues {
  sphere: string;
  cylinder: string;
  axis: string;
  add: string;
  prism: string;
  va: string;
}

export interface RefractionSet {
  unaided: EyePair<RefractionValues>;
  objective: EyePair<RefractionValues>;
  subjective: EyePair<RefractionValues>;
  final: EyePair<RefractionValues>;
}

export interface VisualAcuity {
  unaidedOd: string;
  unaidedOs: string;
  unaidedNear: string;
  aidedOd: string;
  aidedOs: string;
  pinholeOd: string;
  pinholeOs: string;
}

export interface EyeExamination {
  visualAcuity: VisualAcuity;
  refraction: RefractionSet;
  pd: string;
  nearPd: string;
  binocularVision: string;
  colourVision: string;
  ocularMotility: string;
  pupils: string;
  anteriorSegment: string;
  posteriorSegment: string;
  iopOd: string;
  iopOs: string;
  keratometry?: string;
  contactLensNotes?: string;
}

export interface Diagnosis {
  code?: string;
  description: string;
  eye: "od" | "os" | "ou";
}

export interface ClinicalVisit {
  id: string;
  visitNumber: string;
  patientId: string;
  clinicianId: string;
  date: ISODate;
  status: "draft" | "completed";
  chiefComplaint: {
    reason: string;
    symptoms: string;
    duration: string;
    previousEyeProblems: string;
    patientConcerns: string;
  };
  medicalHistory: {
    general: string;
    medications: string;
    allergies: string;
    conditions: string;
    surgeries: string;
    familyHistory: string;
  };
  ocularHistory: {
    conditions: string;
    surgery: string;
    correction: string;
    lastExam: string;
    other: string;
  };
  examination: EyeExamination;
  diagnoses: Diagnosis[];
  findings: string;
  assessment: string;
  managementPlan: string;
  followUpDate: ISODate | null;
  clinicalNotes: string;
  createdAt: ISODateTime;
}

/* ---------------------------------------------------------- prescriptions */

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientId: string;
  visitId?: string;
  clinicianId: string;
  date: ISODate;
  eyes: EyePair<RefractionValues>;
  pd: string;
  lensType: string;
  lensMaterial: string;
  lensCoating: string;
  frameInfo?: string;
  contactLens?: {
    brand: string;
    baseCurve: string;
    diameter: string;
    power: string;
    replacement: string;
  };
  notes?: string;
  createdAt: ISODateTime;
}

/* --------------------------------------------------------------- billing */

export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "refunded";

export interface InvoiceItem {
  id: string;
  description: string;
  productId?: string;
  serviceCode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  date: ISODate;
  items: InvoiceItem[];
  taxRate: number;
  status: InvoiceStatus;
  insuranceClaimId?: string;
  notes?: string;
  createdBy: string;
  createdAt: ISODateTime;
}

export type PaymentMethod =
  | "cash"
  | "mpesa"
  | "card"
  | "bank_transfer"
  | "insurance"
  | "other";

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  patientId: string;
  amount: number;
  method: PaymentMethod;
  /** M-Pesa code, card auth, bank slip etc. Populated by the integration later. */
  reference?: string;
  date: ISODateTime;
  receivedBy: string;
  status: "confirmed" | "voided" | "refunded";
  notes?: string;
}

export interface Receipt {
  payment: Payment;
  invoice: Invoice;
  patient: Patient;
}

/* ------------------------------------------------------------- insurance */

export interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  coverageNotes: string;
  status: "active" | "inactive";
}

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "paid";

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  providerId: string;
  patientId: string;
  invoiceId: string;
  memberNumber: string;
  policyNumber: string;
  claimedAmount: number;
  approvedAmount: number;
  patientCopay: number;
  status: ClaimStatus;
  submittedAt: ISODate | null;
  notes?: string;
}

/* ------------------------------------------------------------- inventory */

export type ProductCategory =
  | "frames"
  | "lenses"
  | "contact_lenses"
  | "accessories"
  | "eye_care"
  | "other";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  brand: string;
  supplierId: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  location: string;
  status: "active" | "discontinued";
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  type: "stock_in" | "stock_out" | "adjustment";
  quantity: number;
  reason: string;
  reference?: string;
  date: ISODateTime;
  recordedBy: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  productsSupplied: string;
  notes?: string;
}

/* ------------------------------------------------------------------ admin */

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  module: ModuleKey | "auth";
  record: string;
  timestamp: ISODateTime;
  description: string;
}

export interface PracticeSettings {
  practiceName: string;
  tagline: string;
  address: string;
  county: string;
  town: string;
  phone: string;
  email: string;
  currency: string;
  taxRate: number;
  taxLabel: string;
  invoicePrefix: string;
  receiptPrefix: string;
  prescriptionPrefix: string;
  registrationNumber: string;
  kraPin: string;
}
