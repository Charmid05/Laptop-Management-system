import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";
import { useDB, patientName, age, createRecord, deleteRecord } from "@/services/store";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/patients")({
  head: () => meta("Patients", "Patient records — Amani Eye practice manager."),
  component: PatientsRouteView,
});

function PatientsRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return pathname === "/patients"
    ? <AppShell module="patients"><PatientsList /></AppShell>
    : <Outlet />;
}

function PatientsList() {
  const db = useDB();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = db.patients.filter((p) => {
    const matchesSearch = 
      `${patientName(p)} ${p.patientNumber} ${p.phone} ${p.nationalId ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete patient ${name}? This action cannot be undone.`)) return;
    try {
      await deleteRecord("patients", id);
      toast.success("Patient deleted successfully");
    } catch (error) {
      toast.error("Failed to delete patient");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${db.patients.length} total patients`}
        actions={<Button asChild className="rounded-full"><Link to="/patients/new"><Plus className="mr-2 size-4" /> Register patient</Link></Button>}
      />

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, number, phone or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th>Patient #</th>
                <th>Name</th>
                <th>Age/Gender</th>
                <th>Phone</th>
                <th>County</th>
                <th>Status</th>
                <th>Last visit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8">No patients found</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.patientNumber}</td>
                  <td>
                    <Link to="/patients/$id" params={{ id: p.id }} className="font-semibold hover:underline">
                      {patientName(p)}
                    </Link>
                  </td>
                  <td>{age(p.dateOfBirth)}y / {p.gender}</td>
                  <td>{p.phone}</td>
                  <td>{p.county}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.lastVisitAt ? new Date(p.lastVisitAt).toLocaleDateString() : "Never"}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm"><Link to="/patients/$id" params={{ id: p.id }}>View</Link></Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id, patientName(p))}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
