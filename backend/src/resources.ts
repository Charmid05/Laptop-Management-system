/**
 * Table metadata plus a generic CRUD layer. Every resource maps one row to one
 * object of the matching type in `./types.ts`: scalar fields become columns,
 * nested objects/arrays are stored as JSON text.
 */
import { all, one, run, transaction } from "./db.ts";

export type ColumnKind = "text" | "int" | "real" | "json";
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
  providers: {
    table: "insurance_providers",
    orderBy: "name",
    columns: {
      id: t, name: t, code: t, contactPerson: t, phone: t, email: t,
      coverageNotes: t, status: t,
    },
  },
  patients: {
    table: "patients",
    orderBy: "lastName, firstName",
    columns: {
      id: t, patientNumber: t, firstName: t, middleName: t, lastName: t,
      dateOfBirth: t, gender: t, nationalId: t, phone: t, altPhone: t, email: t,
      county: t, town: t, address: t, emergencyContact: "json", occupation: t,
      referralSource: t, insuranceProviderId: t, insuranceMemberNumber: t,
      notes: t, status: t, registeredAt: t, lastVisitAt: t,
    },
  },
  appointments: {
    table: "appointments",
    orderBy: "date DESC, time",
    columns: {
      id: t, patientId: t, date: t, time: t, clinicianId: t, type: t,
      reason: t, notes: t, status: t, createdAt: t,
    },
  },
  visits: {
    table: "visits",
    orderBy: "date DESC",
    columns: {
      id: t, visitNumber: t, patientId: t, clinicianId: t, date: t, status: t,
      chiefComplaint: "json", medicalHistory: "json", ocularHistory: "json",
      examination: "json", diagnoses: "json", findings: t, assessment: t,
      managementPlan: t, followUpDate: t, clinicalNotes: t, createdAt: t,
    },
  },
  prescriptions: {
    table: "prescriptions",
    orderBy: "date DESC",
    columns: {
      id: t, prescriptionNumber: t, patientId: t, visitId: t, clinicianId: t,
      date: t, eyes: "json", pd: t, lensType: t, lensMaterial: t,
      lensCoating: t, frameInfo: t, contactLens: "json", notes: t, createdAt: t,
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
  products: {
    table: "products",
    orderBy: "name",
    columns: {
      id: t, sku: t, name: t, category: t, brand: t, supplierId: t,
      costPrice: "real", sellingPrice: "real", quantity: "int",
      reorderLevel: "int", location: t, status: t,
    },
  },
  stock: {
    table: "inventory_transactions",
    orderBy: "date DESC",
    columns: {
      id: t, productId: t, type: t, quantity: "int", reason: t, reference: t,
      date: t, recordedBy: t,
    },
  },
  invoices: {
    table: "invoices",
    orderBy: "date DESC",
    columns: {
      id: t, invoiceNumber: t, patientId: t, date: t, taxRate: "real",
      status: t, insuranceClaimId: t, notes: t, createdBy: t, createdAt: t,
    },
    afterWrite: (id, body) => {
      if (!Array.isArray(body.items)) return;
      run("DELETE FROM invoice_items WHERE invoiceId = ?", id);
      body.items.forEach((raw, index) => {
        const item = raw as Entity;
        run(
          `INSERT INTO invoice_items
             (id, invoiceId, position, description, productId, serviceCode, quantity, unitPrice, discount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          String(item.id ?? newId("ii")),
          id,
          index,
          String(item.description ?? ""),
          item.productId == null ? null : String(item.productId),
          item.serviceCode == null ? null : String(item.serviceCode),
          Number(item.quantity ?? 1),
          Number(item.unitPrice ?? 0),
          Number(item.discount ?? 0),
        );
      });
    },
    hydrate: (row) => ({
      ...row,
      items: all(
        "SELECT id, description, productId, serviceCode, quantity, unitPrice, discount FROM invoice_items WHERE invoiceId = ? ORDER BY position",
        String(row.id),
      ).map((item) => {
        const clean: Entity = {};
        for (const [key, value] of Object.entries(item)) if (value !== null) clean[key] = value;
        return clean;
      }),
    }),
  },
  payments: {
    table: "payments",
    orderBy: "date DESC",
    columns: {
      id: t, receiptNumber: t, invoiceId: t, patientId: t, amount: "real",
      method: t, reference: t, date: t, receivedBy: t, status: t, notes: t,
    },
  },
  claims: {
    table: "claims",
    orderBy: "claimNumber DESC",
    columns: {
      id: t, claimNumber: t, providerId: t, patientId: t, invoiceId: t,
      memberNumber: t, policyNumber: t, claimedAmount: "real",
      approvedAmount: "real", patientCopay: "real", status: t,
      submittedAt: t, notes: t,
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
    out[field] = kind === "json" ? JSON.parse(String(value)) : value;
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
