/**
 * HTTP API for the laptop store management system.
 * Node's built-in http server + node:sqlite — no runtime dependencies.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { monthlySeries, weeklySeries } from "./analytics.ts";
import { createUser, setPassword, signIn, signOut, userForToken } from "./auth.ts";
import {
  create,
  createPurchase,
  deleteSale,
  deletePurchase,
  find,
  isResourceName,
  list,
  logAudit,
  remove,
  purchaseSerialNumberError,
  saleSerialNumberError,
  createSale,
  resources,
  saveSettings,
  settings,
  update,
  updatePurchase,
  type Entity,
  type ResourceName,
} from "./resources.ts";
import { ADMIN_PASSWORD, ADMIN_USERNAME, seedIfEmpty } from "./seed.ts";

const PORT = Number(process.env.PORT ?? 4000);
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "*";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Entity> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Entity;
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
}

const bearer = (req: IncomingMessage): string | null =>
  req.headers.authorization?.replace(/^Bearer /i, "") ?? null;

function requireUser(req: IncomingMessage): Entity {
  const user = userForToken(bearer(req));
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

function requireAdmin(req: IncomingMessage): Entity {
  const user = requireUser(req);
  if (user.role !== "administrator") throw new HttpError(403, "Administrators only.");
  return user;
}

/** Everything the client needs to render the app. */
function bootstrap(): Record<string, unknown> {
  const collections: Record<string, unknown> = { settings: settings() };
  for (const name of Object.keys(resources) as ResourceName[]) collections[name] = list(name);
  return collections;
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

  if (method === "OPTIONS") return send(res, 204, undefined);
  if (segments[0] !== "api") throw new HttpError(404, "Not found.");

  const [, section, id, action] = segments;

  if (section === "health") return send(res, 200, { ok: true });

  if (section === "auth") {
    if (id === "login" && method === "POST") {
      const body = await readBody(req);
      const session = signIn(String(body.username ?? ""), String(body.password ?? ""));
      if (!session) throw new HttpError(401, "Incorrect username or password.");
      return send(res, 200, session);
    }
    if (id === "logout" && method === "POST") {
      const token = bearer(req);
      if (token) signOut(token);
      return send(res, 200, { ok: true });
    }
    if (id === "me" && method === "GET") {
      return send(res, 200, { user: requireUser(req) });
    }
    throw new HttpError(404, "Unknown auth endpoint.");
  }

  if (section === "bootstrap" && method === "GET") {
    requireUser(req);
    return send(res, 200, bootstrap());
  }

  if (section === "analytics" && method === "GET") {
    requireUser(req);
    return send(res, 200, { weekly: weeklySeries(), monthly: monthlySeries() });
  }

  if (section === "settings") {
    // Readable without a session so the sign-in screen can show the practice name.
    if (method === "GET") return send(res, 200, settings());
    if (method === "PATCH" || method === "PUT") {
      const user = requireAdmin(req);
      const next = saveSettings(await readBody(req));
      logAudit(String(user.id), "Updated settings", "settings", "practice", "Practice settings updated.");
      return send(res, 200, next);
    }
    throw new HttpError(405, "Method not allowed.");
  }

  if (!section || !isResourceName(section)) throw new HttpError(404, "Unknown resource.");
  const name: ResourceName = section;

  // Users carry credentials, so they get their own write paths.
  if (name === "users" && method === "POST" && !id) {
    const actor = requireAdmin(req);
    const body = await readBody(req);
    const user = createUser(body, String(body.password ?? ADMIN_PASSWORD));
    logAudit(String(actor.id), "Created user", "administration", String(user.username), `${user.fullName} added.`);
    return send(res, 201, user);
  }
  if (name === "users" && id && action === "password" && (method === "POST" || method === "PATCH")) {
    const actor = requireUser(req);
    if (actor.role !== "administrator" && actor.id !== id) throw new HttpError(403, "Administrators only.");
    const body = await readBody(req);
    const password = String(body.password ?? "");
    if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters.");
    if (!find("users", id)) throw new HttpError(404, "User not found.");
    setPassword(id, password);
    logAudit(String(actor.id), "Changed password", "administration", id, "Password updated.");
    return send(res, 200, { ok: true });
  }

  const user = requireUser(req);

  if (name === "invoices" && id === "checkout" && !action && method === "POST") {
    const body = await readBody(req);
    if (String(body.createdBy ?? "") !== String(user.id)) throw new HttpError(403, "Sales must be recorded by the signed-in user.");
    const serialNumberError = saleSerialNumberError(body);
    if (serialNumberError) throw new HttpError(409, serialNumberError);
    const invoice = createSale(body);
    if (!invoice) throw new HttpError(409, "A customer and valid in-stock products are required to complete this sale.");
    logAudit(String(user.id), "Created sale", "invoices", String(invoice.invoiceNumber), "Invoice created and stock deducted.");
    return send(res, 201, invoice);
  }

  if (name === "invoices" && id && !action && method === "DELETE") {
    if (!find("invoices", id)) throw new HttpError(404, "Invoice not found.");
    if (!deleteSale(id)) throw new HttpError(409, "Invoice cannot be deleted because its stock could not be restored.");
    logAudit(String(user.id), "Deleted sale", "invoices", id, "Invoice deleted and supplier stock restored.");
    return send(res, 200, { ok: true });
  }

  if (name === "purchases" && id && !action && (method === "PATCH" || method === "PUT")) {
    const purchase = find("purchases", id);
    if (!purchase) throw new HttpError(404, "Purchase order not found.");
    const updated = updatePurchase(id, await readBody(req), String(user.id));
    if (!updated) throw new HttpError(409, "Purchase could not be updated; the purchase data may be invalid or stock would become negative.");
    logAudit(String(user.id), "Updated purchase order", "purchases", String(updated.purchaseNumber), "Purchase order updated.");
    return send(res, 200, updated);
  }

  if (name === "purchases" && id && !action && method === "DELETE") {
    const purchase = find("purchases", id);
    if (!purchase) throw new HttpError(404, "Purchase order not found.");
    const isAdmin = user.role === "administrator";
    if (!deletePurchase(id, isAdmin)) throw new HttpError(409, "Purchase order cannot be deleted because reversing it would make inventory negative.");
    logAudit(String(user.id), "Deleted purchase order", "purchases", String(purchase.purchaseNumber), isAdmin ? "Purchase order force deleted by administrator." : "Purchase order deleted and received stock reversed.");
    return send(res, 200, { ok: true });
  }

  if (!id) {
    if (method === "GET") return send(res, 200, list(name));
    if (method === "POST") {
      const body = await readBody(req);
      let record: Entity;
      if (name === "purchases") {
        const serialNumberError = purchaseSerialNumberError(body.items);
        if (serialNumberError) throw new HttpError(400, serialNumberError);
        const purchase = createPurchase(body, String(user.id));
        if (!purchase) throw new HttpError(400, "Choose a supplier and valid active products with positive quantities.");
        record = purchase;
      } else {
        record = create(name, body);
      }
      logAudit(String(user.id), "Created record", auditModule(name), String(record.id), `Created ${singular(name)}.`);
      return send(res, 201, record);
    }
    throw new HttpError(405, "Method not allowed.");
  }

  if (method === "GET") {
    const record = find(name, id);
    if (!record) throw new HttpError(404, "Not found.");
    return send(res, 200, record);
  }
  if (method === "PATCH" || method === "PUT") {
    const record = update(name, id, await readBody(req));
    if (!record) throw new HttpError(404, "Not found.");
    logAudit(String(user.id), "Updated record", auditModule(name), id, `Updated ${singular(name)}.`);
    return send(res, 200, record);
  }
  if (method === "DELETE") {
    if (!remove(name, id)) throw new HttpError(404, "Not found.");
    logAudit(String(user.id), "Deleted record", auditModule(name), id, `Deleted ${singular(name)}.`);
    return send(res, 200, { ok: true });
  }
  throw new HttpError(405, "Method not allowed.");
}

const auditModules: Partial<Record<ResourceName, string>> = {
  users: "administration",
  roles: "administration",
  audit: "administration",
  stock: "inventory",
};
const auditModule = (name: ResourceName): string => auditModules[name] ?? name;
const singular = (name: ResourceName): string => name.replace(/ies$/, "y").replace(/s$/, "");

const server = createServer((req, res) => {
  route(req, res).catch((error: unknown) => {
    if (error instanceof HttpError) return send(res, error.status, { error: error.message });
    console.error(error);
    send(res, 500, { error: "Internal server error." });
  });
});

seedIfEmpty();
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Administrator login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});
