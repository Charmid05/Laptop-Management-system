import { all } from "./db.ts";

interface Point {
  label: string;
  revenue: number;
  visits: number;
  newPatients: number;
  returning: number;
}

const revenueBetween = (from: string, to: string): number =>
  Number(
    all(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'confirmed' AND date >= ? AND date < ?",
      from,
      to,
    )[0].total,
  );

const countBetween = (table: string, column: string, from: string, to: string): number =>
  Number(
    all(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} >= ? AND ${column} < ?`, from, to)[0].n,
  );

function point(label: string, from: Date, to: Date): Point {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const visits = countBetween("visits", "date", fromISO.slice(0, 10), toISO.slice(0, 10));
  const newPatients = countBetween("patients", "registeredAt", fromISO, toISO);
  return {
    label,
    revenue: revenueBetween(fromISO, toISO),
    visits,
    newPatients,
    returning: Math.max(0, visits - newPatients),
  };
}

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Last 7 days, oldest first. */
export function weeklySeries(): Point[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const from = new Date(today);
    from.setDate(from.getDate() - (6 - i));
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return point(from.toLocaleDateString("en-KE", { weekday: "short" }), from, to);
  });
}

/** Last 6 calendar months, oldest first. */
export function monthlySeries(): Point[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return point(from.toLocaleDateString("en-KE", { month: "short" }), from, to);
  });
}
