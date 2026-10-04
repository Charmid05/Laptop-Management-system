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
  | "customers"
  | "invoices"
  | "payments"
  | "inventory"
  | "purchases"
  | "service"
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

/* -------------------------------------------------------------- customers */

export interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  status: "active" | "archived";
  registeredAt: ISODateTime;
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
  supplierId?: string;
  serviceCode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  serialNumbers?: string[];
}

export interface PurchaseItem {
  productId: string;
  quantity: number;
  unitCost: number;
  sellingPrice?: number;
  serialNumbers?: string[];
}

export interface PurchaseOrder {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  orderDate: ISODate;
  receivedAt?: ISODateTime;
  status: "ordered" | "delivered" | "returned" | "cancelled";
  items: PurchaseItem[];
  notes?: string;
  createdBy: string;
  createdAt: ISODateTime;
}

export type ServiceStatus =
  | "received"
  | "diagnosing"
  | "waiting_parts"
  | "ready"
  | "returned"
  | "cancelled";

export interface ServiceTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  productId?: string;
  serialNumber: string;
  issue: string;
  warrantyUntil?: ISODate;
  estimatedCost: number;
  status: ServiceStatus;
  notes?: string;
  receivedAt: ISODateTime;
  createdBy: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: ISODate;
  items: InvoiceItem[];
  taxRate: number;
  status: InvoiceStatus;
  notes?: string;
  createdBy: string;
  createdAt: ISODateTime;
}

export type PaymentMethod =
  | "cash"
  | "mpesa"
  | "card"
  | "bank_transfer"
  | "other";

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  customerId: string;
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
}

/* ------------------------------------------------------------- inventory */

export type ProductCategory = string;

export interface Product {
  id: string;
  sku: string;
  name: string;
  hasSerialNumber?: boolean;
  category: ProductCategory;
  brand: string;
  parentProductId?: string;
  variantLabel?: string;
  supplierId?: string;
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
  supplierId?: string;
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
  storeName: string;
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
  registrationNumber: string;
  kraPin: string;
  productCategories: string[];
  productBrands: string[];
}
