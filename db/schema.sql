-- Optometry practice management system — SQLite schema.
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

CREATE TABLE IF NOT EXISTS insurance_providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  contactPerson TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  coverageNotes TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS patients (
  id                    TEXT PRIMARY KEY,
  patientNumber         TEXT NOT NULL UNIQUE,
  firstName             TEXT NOT NULL,
  middleName            TEXT,
  lastName              TEXT NOT NULL,
  dateOfBirth           TEXT NOT NULL,
  gender                TEXT NOT NULL,
  nationalId            TEXT,
  phone                 TEXT NOT NULL,
  altPhone              TEXT,
  email                 TEXT,
  county                TEXT NOT NULL DEFAULT '',
  town                  TEXT NOT NULL DEFAULT '',
  address               TEXT,
  emergencyContact      TEXT NOT NULL DEFAULT '{}', -- JSON
  nextOfKin             TEXT DEFAULT '{}', -- JSON
  occupation            TEXT,
  referralSource        TEXT,
  insuranceProviderId   TEXT REFERENCES insurance_providers(id),
  insuranceMemberNumber TEXT,
  notes                 TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  registeredAt          TEXT NOT NULL,
  lastVisitAt           TEXT
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(lastName, firstName);

CREATE TABLE IF NOT EXISTS appointments (
  id          TEXT PRIMARY KEY,
  patientId   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  clinicianId TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  reason      TEXT NOT NULL DEFAULT '',
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'scheduled',
  createdAt   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

CREATE TABLE IF NOT EXISTS queue (
  id              TEXT PRIMARY KEY,
  patientId       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointmentId   TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  queueNumber     INTEGER NOT NULL,
  arrivalTime     TEXT NOT NULL,
  appointmentTime TEXT,
  clinicianId     TEXT NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'waiting',
  date            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_date ON queue(date);

CREATE TABLE IF NOT EXISTS visits (
  id              TEXT PRIMARY KEY,
  visitNumber     TEXT NOT NULL UNIQUE,
  patientId       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinicianId     TEXT NOT NULL REFERENCES users(id),
  date            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  chiefComplaint  TEXT NOT NULL DEFAULT '{}', -- JSON
  medicalHistory  TEXT NOT NULL DEFAULT '{}', -- JSON
  ocularHistory   TEXT NOT NULL DEFAULT '{}', -- JSON
  examination     TEXT NOT NULL DEFAULT '{}', -- JSON
  diagnoses       TEXT NOT NULL DEFAULT '[]', -- JSON
  findings        TEXT NOT NULL DEFAULT '',
  assessment      TEXT NOT NULL DEFAULT '',
  managementPlan  TEXT NOT NULL DEFAULT '',
  followUpDate    TEXT,
  clinicalNotes   TEXT NOT NULL DEFAULT '',
  createdAt       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patientId);

CREATE TABLE IF NOT EXISTS prescriptions (
  id                 TEXT PRIMARY KEY,
  prescriptionNumber TEXT NOT NULL UNIQUE,
  patientId          TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visitId            TEXT REFERENCES visits(id) ON DELETE SET NULL,
  clinicianId        TEXT NOT NULL REFERENCES users(id),
  date               TEXT NOT NULL,
  eyes               TEXT NOT NULL DEFAULT '{}', -- JSON
  pd                 TEXT NOT NULL DEFAULT '',
  lensType           TEXT NOT NULL DEFAULT '',
  lensMaterial       TEXT NOT NULL DEFAULT '',
  lensCoating        TEXT NOT NULL DEFAULT '',
  frameInfo          TEXT,
  contactLens        TEXT, -- JSON
  notes              TEXT,
  createdAt          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patientId);

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
  category     TEXT NOT NULL,
  brand        TEXT NOT NULL DEFAULT '',
  supplierId   TEXT NOT NULL REFERENCES suppliers(id),
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
  type       TEXT NOT NULL,
  quantity   INTEGER NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  reference  TEXT,
  date       TEXT NOT NULL,
  recordedBy TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_product ON inventory_transactions(productId);

CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY,
  invoiceNumber    TEXT NOT NULL UNIQUE,
  patientId        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  taxRate          REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft',
  insuranceClaimId TEXT,
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
  serviceCode TEXT,
  quantity    REAL NOT NULL DEFAULT 1,
  unitPrice   REAL NOT NULL DEFAULT 0,
  discount    REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoiceId);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  receiptNumber TEXT NOT NULL UNIQUE,
  invoiceId     TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patientId     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  amount        REAL NOT NULL DEFAULT 0,
  method        TEXT NOT NULL,
  reference     TEXT,
  date          TEXT NOT NULL,
  receivedBy    TEXT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'confirmed',
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoiceId);

CREATE TABLE IF NOT EXISTS claims (
  id             TEXT PRIMARY KEY,
  claimNumber    TEXT NOT NULL UNIQUE,
  providerId     TEXT NOT NULL REFERENCES insurance_providers(id),
  patientId      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoiceId      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  memberNumber   TEXT NOT NULL DEFAULT '',
  policyNumber   TEXT NOT NULL DEFAULT '',
  claimedAmount  REAL NOT NULL DEFAULT 0,
  approvedAmount REAL NOT NULL DEFAULT 0,
  patientCopay   REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  submittedAt    TEXT,
  notes          TEXT
);

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
