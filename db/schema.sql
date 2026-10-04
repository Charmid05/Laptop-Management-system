-- Laptop store management system — SQLite schema.
-- Applied by the backend on start (backend/src/db.ts); safe to re-run.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  modules     TEXT NOT NULL DEFAULT '[]' -- JSON array of module keys
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  fullName      TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL REFERENCES roles(id),
  status        TEXT NOT NULL DEFAULT 'active',
  lastLogin     TEXT,
  createdAt     TEXT NOT NULL,
  passwordHash  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token     TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  customerNumber TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  companyName   TEXT,
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  registeredAt  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS suppliers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  contactPerson    TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  address          TEXT NOT NULL DEFAULT '',
  productsSupplied TEXT NOT NULL DEFAULT '',
  notes            TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  sku          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  hasSerialNumber INTEGER NOT NULL DEFAULT 0,
  category     TEXT NOT NULL,
  brand        TEXT NOT NULL DEFAULT '',
  parentProductId TEXT REFERENCES products(id) ON DELETE CASCADE,
  variantLabel TEXT,
  supplierId   TEXT REFERENCES suppliers(id),
  costPrice    REAL NOT NULL DEFAULT 0,
  sellingPrice REAL NOT NULL DEFAULT 0,
  quantity     INTEGER NOT NULL DEFAULT 0,
  reorderLevel INTEGER NOT NULL DEFAULT 0,
  location     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id         TEXT PRIMARY KEY,
  productId  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplierId TEXT REFERENCES suppliers(id),
  type       TEXT NOT NULL,
  quantity   INTEGER NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  reference  TEXT,
  date       TEXT NOT NULL,
  recordedBy TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_product ON inventory_transactions(productId);

CREATE TABLE IF NOT EXISTS purchases (
  id            TEXT PRIMARY KEY,
  purchaseNumber TEXT NOT NULL UNIQUE,
  supplierId    TEXT NOT NULL REFERENCES suppliers(id),
  orderDate     TEXT NOT NULL,
  receivedAt    TEXT,
  status        TEXT NOT NULL DEFAULT 'ordered',
  items         TEXT NOT NULL DEFAULT '[]',
  notes         TEXT,
  createdBy     TEXT NOT NULL REFERENCES users(id),
  createdAt     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_tickets (
  id            TEXT PRIMARY KEY,
  ticketNumber  TEXT NOT NULL UNIQUE,
  customerId    TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  productId     TEXT REFERENCES products(id) ON DELETE SET NULL,
  serialNumber  TEXT NOT NULL DEFAULT '',
  issue         TEXT NOT NULL,
  warrantyUntil TEXT,
  estimatedCost REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'received',
  notes         TEXT,
  receivedAt    TEXT NOT NULL,
  createdBy     TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_service_tickets_customer ON service_tickets(customerId);

CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY,
  invoiceNumber    TEXT NOT NULL UNIQUE,
  customerId       TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  date             TEXT NOT NULL,
  taxRate          REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft',
  notes            TEXT,
  createdBy        TEXT NOT NULL REFERENCES users(id),
  createdAt        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          TEXT PRIMARY KEY,
  invoiceId   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  productId   TEXT REFERENCES products(id),
  supplierId  TEXT REFERENCES suppliers(id),
  serviceCode TEXT,
  quantity    REAL NOT NULL DEFAULT 1,
  unitPrice   REAL NOT NULL DEFAULT 0,
  discount    REAL NOT NULL DEFAULT 0,
  serialNumbers TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoiceId);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  receiptNumber TEXT NOT NULL UNIQUE,
  invoiceId     TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customerId    TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount        REAL NOT NULL DEFAULT 0,
  method        TEXT NOT NULL,
  reference     TEXT,
  date          TEXT NOT NULL,
  receivedBy    TEXT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'confirmed',
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoiceId);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  record      TEXT NOT NULL DEFAULT '',
  timestamp   TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC);

-- Single-row table holding the practice settings document.
CREATE TABLE IF NOT EXISTS practice_settings (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
