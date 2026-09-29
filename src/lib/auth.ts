import { useEffect, useState, useSyncExternalStore } from "react";
import { getDB, logAudit, update } from "@/services/store";
import type { User } from "@/types";

const KEY = "amani-session";
const listeners = new Set<() => void>();
let current: string | null = null;
let loaded = false;

function load() {
  if (!loaded && typeof window !== "undefined") {
    current = localStorage.getItem(KEY);
    loaded = true;
  }
}

export function login(username: string, password: string): User | null {
  const u = getDB().users.find((x) => x.username === username.trim() || x.email === username.trim());
  if (!u || u.status !== "active" || password.length < 4) return null;
  current = u.id;
  localStorage.setItem(KEY, u.id);
  update((d) => ({ users: d.users.map((x) => (x.id === u.id ? { ...x, lastLogin: new Date().toISOString() } : x)) }));
  logAudit(u.id, "Signed in", "auth", u.username, `${u.fullName} signed in.`);
  listeners.forEach((l) => l());
  return u;
}

export function logout() {
  current = null;
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** Returns { ready, user }. `ready` is false until the browser session is read. */
export function useSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    load();
    setReady(true);
  }, []);
  const id = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => null,
  );
  const user = id ? getDB().users.find((u) => u.id === id) ?? null : null;
  return { ready, user };
}
