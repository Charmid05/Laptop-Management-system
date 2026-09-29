import { useEffect, useState, useSyncExternalStore } from "react";
import { api, getToken, setToken } from "@/services/api";
import { refresh, reset } from "@/services/store";
import type { User } from "@/types";

const listeners = new Set<() => void>();
let current: User | null = null;
let restoring: Promise<void> | null = null;

const notify = () => listeners.forEach((l) => l());

export async function login(username: string, password: string): Promise<User> {
  const { token, user } = await api<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  setToken(token);
  current = user;
  await refresh();
  notify();
  return user;
}

export function logout(): void {
  void api("/auth/logout", { method: "POST" }).catch(() => undefined);
  setToken(null);
  current = null;
  reset();
  notify();
}

/** Re-reads the stored token once per page load. */
function restore(): Promise<void> {
  restoring ??= restoreOnce();
  return restoring;
}

async function restoreOnce(): Promise<void> {
  if (!getToken()) return;
  try {
    const { user } = await api<{ user: User }>("/auth/me");
    current = user;
  } catch {
    setToken(null);
    current = null;
  }
  notify();
}

/** Returns { ready, user }. `ready` is false until the stored session is checked. */
export function useSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void restore().finally(() => setReady(true));
  }, []);
  const user = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => current,
    () => null,
  );
  return { ready, user };
}
