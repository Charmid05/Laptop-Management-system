import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls, Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { useDB, patientName, createRecord, updateRecord, deleteRecord, todayISO, nowISO } from "@/services/store";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/appointments")({
  head: () => meta("Appointments", "Appointments — Amani Eye practice manager."),
  component: () => <AppShell module="appointments"><Appointments /></AppShell>,
});

function Appointments() {
  const navigate = useNavigate();
  const db = useDB();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const appointments = db.appointments.sort((a, b) => b.date.localeCompare(a.date));
  const filteredAppointments = appointments.filter((a) => statusFilter === "all" || a.status === statusFilter);

  const [newAppointment, setNewAppointment] = useState({
    patientId: "",
    date: todayISO(),
    time: "",
    clinicianId: "",
    type: "new_consultation" as const,
    reason: "",
    notes: "",
  });

  const filteredPatients = db.patients.filter((p) =>
    `${patientName(p)} ${p.patientNumber} ${p.phone}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  const showDropdown = searchQuery.length > 0 && !selectedPatient && filteredPatients.length > 0;

  const clinicians = db.users.filter((u) => u.role === "optometrist" && u.status === "active");

  const handleCreateAppointment = async () => {
    if (!newAppointment.patientId || !newAppointment.date || !newAppointment.time || !newAppointment.clinicianId || !newAppointment.reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate appointment date
    const appointmentDate = new Date(newAppointment.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      toast.error("Cannot book appointments in the past. Please select today or a future date.");
      return;
    }

    try {
      const appointment = await createRecord("appointments", {
        ...newAppointment,
        status: "scheduled",
        createdAt: nowISO(),
      });

      toast.success("Appointment scheduled successfully");
      setShowNewDialog(false);
      setNewAppointment({
        patientId: "",
        date: todayISO(),
        time: "",
        clinicianId: "",
        type: "new_consultation",
        reason: "",
        notes: "",
      });
    } catch (error) {
      toast.error("Failed to schedule appointment");
      console.error(error);
    }
  };

  const handleDeleteAppointment = async (id?: string) => {
    if (!id) {
      toast.error("Appointment not found.");
      return;
    }

    if (!confirm("Delete this appointment?")) return;
    try {
      await deleteRecord("appointments", id);
      toast.success("Appointment deleted");
    } catch (error) {
      toast.error("Failed to delete appointment");
      console.error(error);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateRecord("appointments", id, { status });
      toast.success("Appointment status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} total appointments`}
        actions={
          <Dialog open={showNewDialog} onOpenChange={(open) => {
            setShowNewDialog(open);
            if (!open) {
              setSelectedPatient("");
              setSelectedPatientName("");
              setSearchQuery("");
              setNewAppointment({ patientId: "", date: todayISO(), time: "", clinicianId: "", type: "new_consultation", reason: "", notes: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full"><Plus className="mr-2 size-4" /> Schedule appointment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-sm font-medium">Patient *</label>
                  {selectedPatient ? (
                    <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <span className="flex-1 text-sm font-medium">{selectedPatientName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient("");
                          setSelectedPatientName("");
                          setNewAppointment({ ...newAppointment, patientId: "" });
                          setSearchQuery("");
                        }}
                        className="text-muted-foreground hover:text-destructive text-xs underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Type name, ID or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mt-1"
                        autoComplete="off"
                      />
                      {showDropdown && (
                        <div className="absolute left-0 right-0 top-[4.5rem] z-50 overflow-hidden rounded-xl border bg-popover shadow-lg max-h-56 overflow-y-auto">
                          {filteredPatients.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p.id);
                                setSelectedPatientName(patientName(p));
                                setNewAppointment({ ...newAppointment, patientId: p.id });
                                setSearchQuery("");
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b last:border-0"
                            >
                              <span className="font-medium">{patientName(p)}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{p.patientNumber} · {p.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <Field label="Date *">
                    <Input
                      type="date"
                      value={newAppointment.date}
                      min={todayISO()}
                      onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                    />
                  </Field>
                  <Field label="Time *">
                    <Input
                      type="time"
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Clinician *">
                  <select
                    value={newAppointment.clinicianId}
                    onChange={(e) => setNewAppointment({ ...newAppointment, clinicianId: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select clinician</option>
                    {clinicians.map((c) => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Appointment type *">
                  <select
                    value={newAppointment.type}
                    onChange={(e) => setNewAppointment({ ...newAppointment, type: e.target.value as any })}
                    className={selectCls}
                  >
                    <option value="new_consultation">New consultation</option>
                    <option value="review">Review</option>
                    <option value="eye_test">Eye test</option>
                    <option value="contact_lens_fitting">Contact lens fitting</option>
                    <option value="spectacle_collection">Spectacle collection</option>
                    <option value="follow_up">Follow up</option>
                  </select>
                </Field>

                <Field label="Reason *">
                  <Textarea
                    value={newAppointment.reason}
                    onChange={(e) => setNewAppointment({ ...newAppointment, reason: e.target.value })}
                    rows={2}
                    placeholder="Reason for appointment"
                  />
                </Field>

                <Field label="Notes">
                  <Textarea
                    value={newAppointment.notes}
                    onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional notes"
                  />
                </Field>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateAppointment}>Schedule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Panel>
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="waiting">Waiting</option>
            <option value="in_consultation">In consultation</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </select>
        </div>

        {filteredAppointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No appointments found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Clinician</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt) => {
                  const patient = db.patients.find((p) => p.id === apt.patientId);
                  const clinician = db.users.find((u) => u.id === apt.clinicianId);
                  return (
                    <tr key={apt.id}>
                      <td>{new Date(apt.date).toLocaleDateString()}</td>
                      <td className="font-mono">{apt.time}</td>
                      <td>
                        <Link to="/patients/$id" params={{ id: apt.patientId }} className="font-semibold hover:underline">
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td>{clinician?.fullName || "Unknown"}</td>
                      <td className="capitalize">{apt.type.replace(/_/g, " ")}</td>
                      <td className="max-w-xs truncate">{apt.reason}</td>
                      <td><StatusBadge status={apt.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <select
                            value={apt.status}
                            onChange={(e) => handleUpdateStatus(apt.id, e.target.value)}
                            className={selectCls + " h-8 text-xs"}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="checked_in">Checked in</option>
                            <option value="waiting">Waiting</option>
                            <option value="in_consultation">In consultation</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No show</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAppointment(apt.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
