/**
 * Loads the demonstration dataset the first time the backend runs against an
 * empty database, and always guarantees the `admin` account exists.
 */
import { one, transaction } from "./db.ts";
import { createUser, setPassword, verifyPassword } from "./auth.ts";
import { create, saveSettings, type Entity, type ResourceName } from "./resources.ts";
import * as data from "./seed-data.ts";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "1234";

const count = (table: string) => Number(one(`SELECT COUNT(*) AS n FROM ${table}`)!.n);

function insertAll(name: ResourceName, rows: readonly unknown[]): void {
  for (const row of rows) create(name, row as Entity);
}

export function seedIfEmpty(): void {
  if (count("patients") === 0 && count("roles") === 0) {
    transaction(() => {
      insertAll("roles", data.roles);
      for (const user of data.users) createUser(user as unknown as Entity, ADMIN_PASSWORD);
      insertAll("providers", data.insuranceProviders);
      insertAll("patients", data.patients);
      insertAll("appointments", data.appointments);
      insertAll("visits", data.visits);
      insertAll("prescriptions", data.prescriptions);
      insertAll("suppliers", data.suppliers);
      insertAll("products", data.products);
      insertAll("stock", data.inventoryTransactions);
      insertAll("invoices", data.invoices);
      insertAll("payments", data.payments);
      insertAll("claims", data.claims);
      insertAll("audit", data.auditLogs);
      saveSettings(data.practiceSettings as unknown as Entity);
    });
    console.log("Seeded database with initial data.");
  }

  ensureAdmin();
}

function ensureAdmin(): void {
  const existing = one("SELECT id, passwordHash FROM users WHERE username = ?", ADMIN_USERNAME);
  if (existing) {
    const storedHash = String(existing.passwordHash ?? "");
    if (!storedHash || !verifyPassword(ADMIN_PASSWORD, storedHash)) {
      setPassword(String(existing.id), ADMIN_PASSWORD);
      console.log(`Updated administrator "${ADMIN_USERNAME}" password to "${ADMIN_PASSWORD}".`);
    }
    return;
  }

  createUser(
    {
      id: "u1",
      fullName: "Admin",
      email: "admin@amanieye.co.ke",
      username: ADMIN_USERNAME,
      phone: "0722 145 880",
      role: "administrator",
      status: "active",
      lastLogin: null,
      createdAt: new Date().toISOString(),
    },
    ADMIN_PASSWORD,
  );
  console.log(`Created administrator "${ADMIN_USERNAME}" with password "${ADMIN_PASSWORD}".`);
}
