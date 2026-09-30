import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, StatusBadge, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";
import { useDB, patientName, updateRecord, todayISO } from "@/services/store";
import { toast } from "sonner";
import { Clock, User, Calendar, Stethoscope, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/queue")({
  head: () => meta("Patient queue", "Patient queue — Amani Eye practice manager."),
  component: () => <AppShell module="queue"><PatientQueue /></AppShell>,
});

function PatientQueue() {
  const db = useDB();
  const [selectedClinician, setSelectedClinician] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  const queueEntries = db.queue
    .filter((q) => q.date === selectedDate)
    .filter((q) => selectedClinician === "all" || q.clinicianId === selectedClinician)
    .sort((a, b) => a.queueNumber - b.queueNumber);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateRecord("queue", id, { status: newStatus });
      toast.success("Queue status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const clinicians = db.users.filter((u) => u.role === "optometrist" && u.status === "active");

  return (
    <>
      <PageHeader
        title="Patient queue"
        subtitle={`${queueEntries.length} patients in queue`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full"><Link to="/appointments">View appointments</Link></Button>
            <Button asChild className="rounded-full"><Link to="/patients/new">Register patient</Link></Button>
          </>
        }
      />

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Clinician:</label>
            <select
              value={selectedClinician}
              onChange={(e) => setSelectedClinician(e.target.value)}
              className={selectCls}
            >
              <option value="all">All clinicians</option>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          </div>
        </div>

        {queueEntries.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">No patients in queue for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueEntries.map((entry) => {
              const patient = db.patients.find((p) => p.id === entry.patientId);
              const appointment = db.appointments.find((a) => a.id === entry.appointmentId);
              const clinician = db.users.find((u) => u.id === entry.clinicianId);

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold text-lg">
                    #{entry.queueNumber}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to="/patients/$id" params={{ id: entry.patientId }} className="font-semibold hover:underline">
                        {patientName(patient)}
                      </Link>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3.5" /> Arrived: {entry.arrivalTime}</span>
                      {entry.appointmentTime && <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Apt: {entry.appointmentTime}</span>}
                      {clinician && <span className="flex items-center gap-1"><Stethoscope className="size-3.5" /> {clinician.fullName}</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {entry.status === "waiting" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, "checked_in")}
                          className="rounded-full"
                        >
                          <CheckCircle2 className="mr-1 size-4" /> Check in
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, "in_consultation")}
                          className="rounded-full"
                        >
                          <ArrowRight className="mr-1 size-4" /> Start
                        </Button>
                      </>
                    )}
                    {entry.status === "checked_in" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(entry.id, "in_consultation")}
                        className="rounded-full"
                      >
                        <ArrowRight className="mr-1 size-4" /> Start consultation
                      </Button>
                    )}
                    {entry.status === "in_consultation" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, "completed")}
                          className="rounded-full"
                        >
                          <CheckCircle2 className="mr-1 size-4" /> Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, "no_show")}
                          className="rounded-full text-destructive"
                        >
                          <XCircle className="mr-1 size-4" /> No show
                        </Button>
                      </>
                    )}
                    <Button asChild size="sm" variant="ghost" className="rounded-full">
                      <Link to="/patients/$id" params={{ id: entry.patientId }}>
                        <User className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
