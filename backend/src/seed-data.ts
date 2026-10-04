/**
 * Demonstration data loaded into SQLite the first time the backend starts
 * against an empty database (see `./seed.ts`). Shapes match `./types.ts`.
 */

import type {
  AuditLog,
  Customer,
  InventoryTransaction,
  Invoice,
  Payment,
  PracticeSettings,
  Product,
  Role,
  Supplier,
  User,
} from "./types.ts";

export const roles: Role[] = [
  {
    id: "administrator",
    name: "Administrator",
    description: "Full access to every module including users and settings.",
    modules: [
      "dashboard",
      "customers",
      "invoices",
      "payments",
      "inventory",
      "suppliers",
      "purchases",
      "service",
      "reports",
      "administration",
      "settings",
    ],
  },
  {
    id: "sales_associate",
    name: "Sales Associate",
    description: "Registers customers and processes sales.",
    modules: ["dashboard", "customers", "invoices", "payments", "inventory", "service"],
  },
  {
    id: "cashier",
    name: "Cashier / Accounts",
    description: "Handles sales, payments and receipts.",
    modules: ["dashboard", "invoices", "payments", "reports"],
  },
  {
    id: "store_officer",
    name: "Inventory / Store Officer",
    description: "Manages laptop stock, suppliers and stock movements.",
    modules: ["dashboard", "inventory", "suppliers", "purchases", "reports"],
  },
];

export const users: User[] = [];

export const customers: Customer[] = [];

export const invoices: Invoice[] = [];

export const payments: Payment[] = [];

export const suppliers: Supplier[] = [];

export const products: Product[] = [];

export const inventoryTransactions: InventoryTransaction[] = [];

export const auditLogs: AuditLog[] = [];

export const practiceSettings: PracticeSettings = {
  storeName: "Laptop Store",
  tagline: "Laptops, accessories and service",
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
