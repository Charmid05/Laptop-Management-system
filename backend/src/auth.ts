import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { one, run } from "./db.ts";
import { find, logAudit, newId, type Entity } from "./resources.ts";

const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export interface Session {
  token: string;
  user: Entity;
}

export function signIn(identifier: string, password: string): Session | null {
  const id = identifier.trim();
  const row = one(
    "SELECT id, passwordHash, status FROM users WHERE username = ? OR email = ?",
    id,
    id,
  );
  if (!row || row.status !== "active") return null;
  if (!verifyPassword(password, String(row.passwordHash))) return null;

  const userId = String(row.id);
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 864e5);
  run(
    "INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)",
    token,
    userId,
    now.toISOString(),
    expires.toISOString(),
  );
  run("UPDATE users SET lastLogin = ? WHERE id = ?", now.toISOString(), userId);

  const user = find("users", userId)!;
  logAudit(userId, "Signed in", "auth", String(user.username), `${user.fullName} signed in.`);
  return { token, user };
}

export function signOut(token: string): void {
  run("DELETE FROM sessions WHERE token = ?", token);
}

export function userForToken(token: string | null): Entity | null {
  if (!token) return null;
  const row = one("SELECT userId, expiresAt FROM sessions WHERE token = ?", token);
  if (!row) return null;
  if (new Date(String(row.expiresAt)) < new Date()) {
    signOut(token);
    return null;
  }
  const user = find("users", String(row.userId));
  return user && user.status === "active" ? user : null;
}

export function setPassword(userId: string, password: string): void {
  run("UPDATE users SET passwordHash = ? WHERE id = ?", hashPassword(password), userId);
  run("DELETE FROM sessions WHERE userId = ?", userId);
}

export function createUser(body: Entity, password: string): Entity {
  const id = typeof body.id === "string" && body.id ? body.id : newId("us");
  run(
    `INSERT INTO users (id, fullName, email, username, phone, role, status, lastLogin, createdAt, passwordHash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    String(body.fullName ?? ""),
    String(body.email ?? ""),
    String(body.username ?? ""),
    String(body.phone ?? ""),
    String(body.role ?? "receptionist"),
    String(body.status ?? "active"),
    body.lastLogin == null ? null : String(body.lastLogin),
    String(body.createdAt ?? new Date().toISOString()),
    hashPassword(password),
  );
  return find("users", id)!;
}
