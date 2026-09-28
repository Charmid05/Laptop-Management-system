# Optometry Practice Management System — roadmap

Frontend-first build. All data comes from an in-memory mock service layer
(`src/services/`) that a backend can replace without touching the UI.

## Foundation
- [x] Design system tokens (clinical pop direction: green/amber/sky on ink + cream)
- [x] TypeScript entity models (`src/types`)
- [x] Mock seed data + service abstraction layer
- [x] Mock auth with roles + role-aware navigation
- [x] App shell (sidebar, top bar, global patient search)

## Modules
- [x] Login
- [x] Dashboard (KPIs, charts, queue)
- [x] Patients (list, registration, profile tabs)
- [x] Front office: appointments + queue
- [x] Clinical: visit + eye examination + refraction
- [x] Prescriptions
- [x] Billing: invoices, payments, receipts
- [x] Insurance claims
- [x] Inventory + suppliers
- [x] Reports
- [x] Administration: users, roles, audit log
- [x] Practice settings

## Left for the backend developer
- Real authentication, permissions enforcement, persistence
- M-Pesa / card payment integration (UI + data shapes ready)
- PDF generation for invoices, receipts, prescriptions (buttons wired to print)
- Automatic stock decrement when invoice items are products
