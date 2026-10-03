# Amani Eye — Optometry Practice Manager

Full-stack practice management system: React frontend, Node HTTP API, SQLite database.

```
frontend/   React + TanStack Start UI (Vite)
backend/    Node API server (node:http + node:sqlite), seeding, analytics
db/         schema.sql and the generated practice.db SQLite file
```

This project was built with [Lovable](https://lovable.dev) and can still be edited in the
[Lovable editor](https://lovable.dev/projects/f176822e-5ae4-447a-b8c1-f5a6b8bf52d1).

---

## Requirements

- Node.js >= 24 (the backend uses the built-in `node:sqlite` module and runs TypeScript directly)
- npm or bun for the frontend

---

## Running the System

Backend (port 4000) — creates and seeds `db/practice.db` on first start:

```sh
cd backend && npm start
```

Frontend (port 8080):

```sh
cd frontend && npm install && npm run dev
```

Open http://localhost:8080 and sign in.

| Account | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `1234` |
| Demo staff (e.g. `jkariuki`) | see Users page | `demo1234` |

---

## Configuration

| Variable | Where | Default |
| --- | --- | --- |
| `PORT` | backend | `4000` |
| `DATABASE_FILE` | backend | `db/practice.db` |
| `FRONTEND_ORIGIN` | backend (CORS) | `*` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | backend seed | `admin` / `1234` |
| `VITE_API_URL` | frontend | `http://localhost:4000` |

---

## Database

`db/schema.sql` holds the full relational schema and is applied on every backend start.
To wipe and reseed:

```sh
cd backend && npm run reset
```

---

## 🏥 How the System Works — Patient Journey

The Amani Eye practice management system follows a standard optometry clinic workflow.
Below is the complete patient journey from booking to receipt.

---

### Step 1 — Patient Registration

**Module:** Patients (`/patients/new`)  
**Who:** Receptionist or Administrator

Before any appointment can be booked, the patient must be registered in the system.

1. Navigate to **Patients → Register patient**.
2. Fill in all required fields:
   - First name, Last name
   - Date of birth (must be a valid past date; minimum age check enforced)
   - Gender, Phone number
   - County and Town (location)
   - Emergency contact (name, relationship, phone) — **required**
3. Optionally fill in:
   - Middle name, National ID, Alternative phone, Email, Address
   - **Next of Kin** (name, relationship, phone, address)
   - **Insurance provider** and member number (if the patient has medical cover)
   - Occupation, Referral source, Notes
4. Click **Register patient**.

> **Date of birth rules:** The system enforces that DOB cannot be in the future and cannot exceed 120 years in the past. A warning is shown if the patient appears to be under 18.

---

### Step 2 — Book an Appointment

**Module:** Appointments (`/appointments`)  
**Who:** Receptionist

1. Navigate to **Appointments** and click **Schedule appointment**.
2. **Search and select a patient:**
   - Type the patient's name, patient number, or phone in the search box.
   - Results appear in a dropdown — click a result to select them.
   - The selected patient's name appears as a "chip" — click **Change** to re-search.
3. Fill in:
   - **Date** (cannot be in the past — minimum date is today)
   - **Time**
   - **Clinician** (assigned optometrist)
   - **Appointment type** (New consultation, Review, Eye test, Contact lens fitting, Spectacle collection, Follow-up)
   - **Reason for visit** (required)
   - Optional notes
4. Click **Schedule**.

The appointment status starts as **Scheduled** and can be updated to: Confirmed → Checked in → Waiting → In consultation → Completed (or Cancelled / No show).

---

### Step 3 — Patient Arrival & Queue Management

**Module:** Queue (`/queue`)  
**Who:** Receptionist / Front desk

When the patient arrives at the clinic:

1. Navigate to **Queue** (filtered to today's date by default).
2. Find the patient's queue entry (populated from their appointment).
3. Update queue status:
   - **Check in** — patient has arrived and is waiting.
   - **Start consultation** — patient is being seen by the clinician.
   - **Complete** — consultation finished.
   - **No show** — patient did not arrive.

Queue entries show the patient's queue number, arrival time, appointment time, and assigned clinician.

---

### Step 4 — Clinical Visit (Examination)

**Module:** Clinical (`/clinical`)  
**Who:** Optometrist / Clinician

1. Navigate to **Clinical visits** and click **New visit**.
2. **Search and select a patient** — same chip-based search as appointments.
3. Click **Start visit** — this opens the full clinical examination form.
4. The visit is organised into tabs:

   | Tab | Contents |
   |-----|----------|
   | **Chief complaint** | Reason for visit, symptoms, duration, previous eye problems, patient concerns |
   | **History** | Medical history (general, medications, allergies, conditions, surgeries, family history), Ocular history |
   | **Examination** | Visual acuity (OD/OS, unaided/aided/pinhole), Refraction (subjective/objective/final), PD, Binocular vision, Colour vision, Ocular motility, Pupils, Anterior/posterior segment, IOP, Keratometry, Contact lens notes |
   | **Diagnosis** | ICD-10 codes and descriptions, eye affected (OD/OS/OU) |
   | **Management plan** | Findings, assessment, management plan, follow-up date, clinical notes |

5. Click **Save draft** to save progress, or **Complete visit** when the examination is done.

> Completing a visit automatically updates the patient's `lastVisitAt` timestamp.

---

### Step 5 — Prescription (Optional)

**Module:** Prescriptions (`/prescriptions`)  
**Who:** Optometrist / Clinician

After the examination, if the patient requires spectacles or contact lenses:

1. Navigate to **Prescriptions** and click **New prescription**.
2. Select the **patient** and optionally link to the **clinical visit** (auto-fills refraction data from the visit).
3. Select the **clinician** and **prescription date**.
4. Fill in the refraction table (OD/OS: Sphere, Cylinder, Axis, Add, Prism, VA).
5. Choose **lens type** (Single vision, Bifocal, Progressive, Contact lenses, Other), material, and coating.
6. For contact lenses, fill in: brand, base curve, diameter, power, replacement schedule.
7. Add frame information and notes.
8. Click **Save prescription**.

Prescriptions are linked to the patient record and can be viewed later on the patient profile.

---

### Step 6 — Create an Invoice

**Module:** Invoices (`/invoices`)  
**Who:** Receptionist / Cashier

1. Navigate to **Invoices** and click **New invoice**.
2. **Search and select a patient** — chip-based search (type name, ID or phone).
3. Add **line items**:
   - Description (e.g., "Comprehensive eye exam", "Single vision lenses", "Frame")
   - Quantity, Unit price, Discount (per item)
4. Add optional notes.
5. The system shows a live subtotal, VAT (configured in Settings), and total.
6. Click **Create invoice** — the invoice is created with status **Unpaid** and you are taken directly to the invoice detail page.

> **Invoice statuses:** Draft → Unpaid → Partially Paid → Paid | Cancelled | Refunded

---

### Step 7 — Record Payment & Generate Receipt

**Module:** Invoices / Payments  
**Who:** Cashier / Receptionist

#### Option A — From the Invoice Detail page (`/invoices/:id`)

1. Open the invoice and click **Record payment**.
2. Enter the payment **amount** (cannot exceed the outstanding balance).
3. Select **payment method**: Cash, M-Pesa, Card, Bank transfer, Insurance, Other.
4. Enter an optional **reference** (e.g., M-Pesa transaction code, card auth code).
5. Click **Record payment**.
6. The invoice status automatically updates to **Paid** or **Partially Paid** based on the amount received.
7. A receipt number is generated (e.g., `RCP-0001`).

#### Option B — From the Payments page (`/payments`)

1. Navigate to **Payments** and click **Record payment**.
2. Select the **invoice** from the dropdown (shows invoice number, patient name, and outstanding balance).
3. Fill in amount, method, reference, and notes.
4. Click **Record payment**.

> **Receipt** — Every confirmed payment generates a receipt with a unique receipt number that can be used for audit purposes.

---

### Step 8 — Print Invoice / Receipt

**Module:** Invoice detail page (`/invoices/:id`)  
**Who:** Cashier / Receptionist

- Click **Print** on the invoice detail page to print/save as PDF.
- The print view shows: practice name, invoice number, patient details, line items, tax breakdown, total, payment history, and receipt numbers.

---

### Insurance Claims (Optional)

**Module:** Insurance (`/insurance`)  
**Who:** Receptionist / Administrator

For patients with medical cover:

1. The patient's **insurance provider** and **member number** are set during registration.
2. After creating an invoice, an insurance claim can be submitted:
   - Claimed amount, approved amount, patient copay are tracked separately.
3. Claim statuses: Draft → Submitted → Approved / Partially Approved / Rejected → Paid.

---

## 📊 Dashboard & Reports

- **Dashboard (`/`)** — Real-time statistics: today's appointments, patients in queue, recent invoices, revenue overview.
- **Reports (`/reports`)** — Weekly and monthly revenue trends, visit counts, new vs returning patients.

---

## ⚙️ System Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/` | Practice overview, key metrics |
| Patients | `/patients` | Patient registry and profiles |
| Appointments | `/appointments` | Scheduling and status management |
| Queue | `/queue` | Daily patient flow management |
| Clinical | `/clinical` | Eye examination records |
| Prescriptions | `/prescriptions` | Spectacle and contact lens Rx |
| Invoices | `/invoices` | Billing and invoice management |
| Payments | `/payments` | Payment collection and receipts |
| Insurance | `/insurance` | Provider management and claims |
| Inventory | `/inventory` | Stock management (frames, lenses, accessories) |
| Suppliers | `/suppliers` | Supplier directory |
| Reports | `/reports` | Revenue and patient analytics |
| Administration | `/admin` | User management, roles, audit log |
| Settings | `/settings` | Practice details, currency, tax, prefixes |

---

## 🔐 Roles & Access Control

| Role | Key Access |
|------|-----------|
| **Administrator** | All modules |
| **Receptionist** | Patients, Appointments, Queue, Invoices, Payments |
| **Optometrist** | Clinical, Prescriptions, Patients (view) |
| **Cashier** | Payments, Invoices |
| **Store Officer** | Inventory, Suppliers |

---

## 📅 Date Logic & Validation Rules

- **Appointment dates** — Cannot be in the past. The date picker enforces a minimum of today.
- **Date of birth** — Cannot be in the future. Cannot be more than 120 years ago. Warning shown for patients under 18.
- **Follow-up dates** (Clinical) — Free text entry, no restriction (allows clinical judgment).
- **Payment dates** — Automatically set to the current timestamp when recorded.
- **Invoice dates** — Automatically set to today when created.

---

## 🔢 Number Sequences

All numbers are auto-generated using configurable prefixes (set in **Settings**):

| Document | Prefix (default) | Example |
|----------|-----------------|---------|
| Patient | `PT-` | `PT-0001` |
| Invoice | `INV-` | `INV-0001` |
| Receipt | `RCP-` | `RCP-0001` |
| Prescription | `RX-` | `RX-0001` |
| Visit | `VS-` | `VS-0001` |
