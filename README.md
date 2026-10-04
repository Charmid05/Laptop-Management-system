# Laptop Store Manager

A laptop retail operations system for customer records, sales, stock, suppliers, purchasing, service tickets, and payments.

## Modules

| Module | Purpose |
| --- | --- |
| Dashboard | Daily sales, revenue, customer activity, and low-stock products |
| Customers | Contact records, customer search, and sales history |
| Sales | Product invoices, balances, payment capture, and stock deduction |
| Payments | Receipt history, print/PDF receipts, and payment tracking |
| Inventory | Product catalog, categories, reorder thresholds, and stock movements |
| Suppliers | Supplier contact and product information |
| Purchases | Supplier orders; receiving adds stock and records movements atomically |
| Repairs & warranty | Customer service tickets, serial numbers, warranty dates, estimates, and status |
| Reports | Revenue, sales, customers, stock valuation, and CSV export |
| Administration | Staff access, audit history, and store settings |

## Requirements

- Node.js 24 or newer
- npm

## Run Locally

Install frontend dependencies:

```powershell
cd frontend
npm install
```

Start the API in one terminal from the repository root:

```powershell
node backend/src/index.ts
```

Start the frontend in a second terminal:

```powershell
npm run dev
```

Vite prints the frontend URL (normally `http://localhost:5173`). The API listens on `http://localhost:4000`.

SQLite creates `db/laptop-store.db` automatically. Set `DATABASE_FILE` to use another database file, and `PORT` to change the API port.

## First Sign-In

The initial administrator is `admin` with password `1234`. Set `ADMIN_PASSWORD` before the first API start to choose a different password. Change the default before using the system with real customer or sales data.

## Stock Rules

- Completing a sale checks available quantity, decreases stock, and records a stock-out movement in one transaction.
- A purchase order can be received only once. Receiving it increases product quantities and records stock-in movements in one transaction.
- Serial numbers recorded on a purchase remain visible on available stock and are assigned to the sold units on invoices and payment receipts.
- The Stock module shows remaining serial numbers by supplier and product, with a View action for stock details.
- Repair tickets track customer devices and serial numbers independently from inventory counts.

## Access Roles

- **Administrator:** all modules, users, and settings
- **Sales Associate:** customers, sales, payments, inventory, and service tickets
- **Cashier / Accounts:** sales, payments, and reports
- **Inventory / Store Officer:** inventory, suppliers, purchases, and reports

## Build

```powershell
cd frontend
npm run build
npm run lint
```