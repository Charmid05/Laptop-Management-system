import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");

export const dbFile = process.env.DATABASE_FILE
  ? resolve(process.env.DATABASE_FILE)
  : join(projectRoot, "db", "laptop-store.db");

export const schemaFile = join(projectRoot, "db", "schema.sql");

mkdirSync(dirname(dbFile), { recursive: true });

export const db = new DatabaseSync(dbFile);
db.exec(readFileSync(schemaFile, "utf8"));

const productColumns = db.prepare("PRAGMA table_info(products)").all() as { name: string; notnull: number }[];
if (productColumns.some((column) => column.name === "supplierId" && column.notnull === 1)) {
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE products_migrated (
        id           TEXT PRIMARY KEY,
        sku          TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        category     TEXT NOT NULL,
        brand        TEXT NOT NULL DEFAULT '',
        supplierId   TEXT REFERENCES suppliers(id),
        costPrice    REAL NOT NULL DEFAULT 0,
        sellingPrice REAL NOT NULL DEFAULT 0,
        quantity     INTEGER NOT NULL DEFAULT 0,
        reorderLevel INTEGER NOT NULL DEFAULT 0,
        location     TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'active'
      );
      INSERT INTO products_migrated SELECT * FROM products;
      DROP TABLE products;
      ALTER TABLE products_migrated RENAME TO products;
      COMMIT;
    `);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

const productColumnNames = new Set(
  (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((column) => column.name),
);
if (!productColumnNames.has("parentProductId")) {
  db.exec("ALTER TABLE products ADD COLUMN parentProductId TEXT REFERENCES products(id) ON DELETE CASCADE");
}
if (!productColumnNames.has("variantLabel")) {
  db.exec("ALTER TABLE products ADD COLUMN variantLabel TEXT");
}
if (!productColumnNames.has("hasSerialNumber")) {
  db.exec("ALTER TABLE products ADD COLUMN hasSerialNumber INTEGER NOT NULL DEFAULT 0");
  if (productColumnNames.has("serialNumber")) {
    db.exec("UPDATE products SET hasSerialNumber = 1 WHERE serialNumber IS NOT NULL AND TRIM(serialNumber) <> ''");
  }
}

const inventoryTransactionColumns = new Set(
  (db.prepare("PRAGMA table_info(inventory_transactions)").all() as { name: string }[]).map((column) => column.name),
);
if (!inventoryTransactionColumns.has("supplierId")) {
  db.exec("ALTER TABLE inventory_transactions ADD COLUMN supplierId TEXT REFERENCES suppliers(id)");
}

const invoiceItemColumns = new Set(
  (db.prepare("PRAGMA table_info(invoice_items)").all() as { name: string }[]).map((column) => column.name),
);
if (!invoiceItemColumns.has("supplierId")) {
  db.exec("ALTER TABLE invoice_items ADD COLUMN supplierId TEXT REFERENCES suppliers(id)");
}
if (!invoiceItemColumns.has("serialNumbers")) {
  db.exec("ALTER TABLE invoice_items ADD COLUMN serialNumbers TEXT NOT NULL DEFAULT '[]'");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_stock_supplier_product ON inventory_transactions(supplierId, productId);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_supplier_product ON invoice_items(supplierId, productId);
  UPDATE invoice_items
  SET supplierId = (SELECT supplierId FROM products WHERE products.id = invoice_items.productId)
  WHERE supplierId IS NULL AND productId IS NOT NULL;
  UPDATE inventory_transactions
  SET supplierId = (
    SELECT supplierId FROM purchases
    WHERE purchases.purchaseNumber = inventory_transactions.reference AND (purchases.status = 'received' OR purchases.status = 'delivered')
    LIMIT 1
  )
  WHERE supplierId IS NULL AND type = 'stock_in';
  UPDATE inventory_transactions
  SET supplierId = (
    SELECT invoice_items.supplierId
    FROM invoices
    JOIN invoice_items ON invoice_items.invoiceId = invoices.id
    WHERE invoices.invoiceNumber = inventory_transactions.reference
      AND invoice_items.productId = inventory_transactions.productId
    LIMIT 1
  )
  WHERE supplierId IS NULL AND type = 'stock_out';
  UPDATE inventory_transactions
  SET supplierId = (SELECT supplierId FROM products WHERE products.id = inventory_transactions.productId)
  WHERE supplierId IS NULL;
`);

export type Row = Record<string, string | number | bigint | null | Uint8Array>;

export function all(sql: string, ...params: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function one(sql: string, ...params: (string | number | null)[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function run(sql: string, ...params: (string | number | null)[]): void {
  db.prepare(sql).run(...params);
}

let depth = 0;

/** Re-entrant: nested calls join the outermost transaction. */
export function transaction<T>(fn: () => T): T {
  if (depth > 0) {
    depth += 1;
    try {
      return fn();
    } finally {
      depth -= 1;
    }
  }
  db.exec("BEGIN");
  depth = 1;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    depth = 0;
  }
}
