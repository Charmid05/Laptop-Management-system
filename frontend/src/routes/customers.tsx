import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";
import { customerName, deleteRecord, useDB } from "@/services/store";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  head: () => meta("Customers", "Customer records for the laptop store."),
  component: CustomersRouteView,
});

function CustomersRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/customers" ? (
    <AppShell module="customers"><CustomersList /></AppShell>
  ) : <Outlet />;
}

function CustomersList() {
  const db = useDB();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const customers = db.customers.filter((customer) => {
    const searchable = `${customerName(customer)} ${customer.customerNumber} ${customer.phone} ${customer.email ?? ""}`.toLowerCase();
    return searchable.includes(search.toLowerCase()) && (status === "all" || customer.status === status);
  });

  const removeCustomer = async (id: string, name: string) => {
    if (!confirm(`Delete customer ${name}?`)) return;
    try {
      await deleteRecord("customers", id);
      toast.success("Customer deleted");
    } catch {
      toast.error("This customer has sales records and cannot be deleted");
    }
  };

  return <>
    <PageHeader title="Customers" subtitle={`${db.customers.length} customer records`} actions={
      <Button asChild><Link to="/customers/new"><Plus className="mr-2 size-4" /> Add customer</Link></Button>
    } />
    <Panel>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, number, phone or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className={selectCls} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All status</option><option value="active">Active</option><option value="archived">Archived</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead><tr><th>Customer #</th><th>Name</th><th>Phone</th><th>Email</th><th>Sales</th><th>Status</th><th /></tr></thead>
          <tbody>{customers.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No customers found</td></tr> : customers.map((customer) => (
            <tr key={customer.id}>
              <td className="font-mono">{customer.customerNumber}</td>
              <td><Link to="/customers/$id" params={{ id: customer.id }} className="font-semibold hover:underline">{customerName(customer)}</Link></td>
              <td>{customer.phone || "—"}</td><td>{customer.email || "—"}</td>
              <td>{db.invoices.filter((invoice) => invoice.customerId === customer.id).length}</td>
              <td><StatusBadge status={customer.status} /></td>
              <td><div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm"><Link to="/customers/$id" params={{ id: customer.id }}>Edit</Link></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${customerName(customer)}`} onClick={() => void removeCustomer(customer.id, customerName(customer))}><Trash2 className="size-4" /></Button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  </>;
}