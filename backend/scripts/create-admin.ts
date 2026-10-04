/**
 * Script to create an admin user after database initialization
 * Run with: npx tsx backend/scripts/create-admin.ts
 */

import { createUser } from "../src/auth.ts";
import { one } from "../src/db.ts";

const username = "admin";
const password = "1234";

console.log("Creating admin user...");

// Check if admin already exists
const existing = one("SELECT id FROM users WHERE username = ?", username);
if (existing) {
  console.log("Admin user already exists. Skipping creation.");
  process.exit(0);
}

createUser(
  {
    id: "u1",
    fullName: "Admin",
    email: "admin@laptopstore.local",
    username: username,
    phone: "0722 145 880",
    role: "administrator",
    status: "active",
    lastLogin: null,
    createdAt: new Date().toISOString(),
  },
  password,
);

console.log("✓ Admin user created successfully");
console.log(`  Username: ${username}`);
console.log(`  Password: ${password}`);
console.log("\nYou can now log in with these credentials.");
