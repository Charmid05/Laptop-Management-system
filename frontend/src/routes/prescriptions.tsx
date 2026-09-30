import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Field, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import {
  useDB,
  blankPair,
  createRecord,
  nextNumber,
  patientName,
  todayISO,
  nowISO,
} from "@/services/store";
import type { EyePair, Prescription, RefractionValues } from "@/types";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/prescriptions")({
  head: () => meta("Prescriptions", "Prescriptions — Amani Eye practice manager."),
  component: () => (
    <AppShell module="prescriptions">
      <Prescriptions />
    </AppShell>
  ),
});

type PrescriptionDraft = {
  patientId: string;
  visitId: string;
  clinicianId: string;
  date: string;
  eyes: EyePair<RefractionValues>;
  pd: string;
  lensType: string;
  lensMaterial: string;
  lensCoating: string;
  frameInfo: string;
  notes: string;
  contactLens: {
    brand: string;
    baseCurve: string;
    diameter: string;
    power: string;
    replacement: string;
  };
};

const emptyDraft = (): PrescriptionDraft => ({
  patientId: "",
  visitId: "",
  clinicianId: "",
  date: todayISO(),
  eyes: blankPair(),
  pd: "",
  lensType: "Single vision",
  lensMaterial: "",
  lensCoating: "",
  frameInfo: "",
  notes: "",
  contactLens: { brand: "", baseCurve: "", diameter: "", power: "", replacement: "" },
});

function Prescriptions() {
  const db = useDB();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PrescriptionDraft>(emptyDraft);
  const clinicians = db.users.filter(
    (user) =>
      user.status === "active" && (user.role === "optometrist" || user.role === "administrator"),
  );
  const availableVisits = db.visits.filter((visit) => visit.patientId === draft.patientId);
  const prescriptions = [...db.prescriptions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((prescription) => {
      const patient = db.patients.find((item) => item.id === prescription.patientId);
      return `${prescription.prescriptionNumber} ${patientName(patient)} ${patient?.patientNumber ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });

  const openNewDialog = () => {
    setDraft({ ...emptyDraft(), clinicianId: clinicians[0]?.id ?? "" });
    setShowNewDialog(true);
  };

  const updateEye = (
    eye: keyof EyePair<RefractionValues>,
    field: keyof RefractionValues,
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      eyes: { ...current.eyes, [eye]: { ...current.eyes[eye], [field]: value } },
    }));
  };

  const handleVisitChange = (visitId: string) => {
    const visit = db.visits.find((item) => item.id === visitId);
    setDraft((current) => ({
      ...current,
      visitId,
      ...(visit
        ? {
            patientId: visit.patientId,
            clinicianId: visit.clinicianId,
            eyes: visit.examination.refraction.final,
            pd: visit.examination.pd,
          }
        : {}),
    }));
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.patientId || !draft.clinicianId || !draft.lensType.trim()) {
      toast.error("Select a patient, clinician, and lens type");
      return;
    }

    try {
      const prescriptionNumber = nextNumber(
        db.settings.prescriptionPrefix,
        db.prescriptions.map((item) => item.prescriptionNumber),
      );
      await createRecord("prescriptions", {
        prescriptionNumber,
        patientId: draft.patientId,
        visitId: draft.visitId || undefined,
        clinicianId: draft.clinicianId,
        date: draft.date,
        eyes: draft.eyes,
        pd: draft.pd,
        lensType: draft.lensType.trim(),
        lensMaterial: draft.lensMaterial.trim(),
        lensCoating: draft.lensCoating.trim(),
        frameInfo: draft.frameInfo.trim() || undefined,
        contactLens: draft.lensType === "Contact lenses" ? draft.contactLens : undefined,
        notes: draft.notes.trim() || undefined,
        createdAt: nowISO(),
      });
      toast.success("Prescription saved");
      setShowNewDialog(false);
      setDraft(emptyDraft());
    } catch (error) {
      toast.error("Failed to save prescription");
      console.error(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle={`${db.prescriptions.length} total prescriptions`}
        actions={
          db.patients.length > 0 ? (
            <Button onClick={openNewDialog} className="rounded-full">
              <Plus className="size-4" /> New prescription
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/patients/new">
                <Plus className="size-4" /> Register patient
              </Link>
            </Button>
          )
        }
      />

      <Panel>
        <div className="mb-4 max-w-sm">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search prescription or patient..."
            aria-label="Search prescriptions"
          />
        </div>
        {prescriptions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No prescriptions match your search" : "No prescriptions recorded"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Prescription #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Clinician</th>
                  <th>Lens</th>
                  <th>PD</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((prescription) => {
                  const patient = db.patients.find((item) => item.id === prescription.patientId);
                  const clinician = db.users.find((item) => item.id === prescription.clinicianId);
                  return (
                    <tr key={prescription.id}>
                      <td className="font-mono">{prescription.prescriptionNumber}</td>
                      <td>
                        <Link
                          to="/patients/$id"
                          params={{ id: prescription.patientId }}
                          className="font-semibold hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td>{new Date(`${prescription.date}T00:00:00`).toLocaleDateString()}</td>
                      <td>{clinician?.fullName ?? "Unknown"}</td>
                      <td>
                        {prescription.lensType}
                        {prescription.lensMaterial ? ` · ${prescription.lensMaterial}` : ""}
                      </td>
                      <td>{prescription.pd || "—"}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(prescription)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New prescription</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient *">
                <select
                  value={draft.patientId}
                  onChange={(event) =>
                    setDraft({ ...draft, patientId: event.target.value, visitId: "" })
                  }
                  className={selectCls}
                  required
                >
                  <option value="">Select patient</option>
                  {db.patients
                    .filter((patient) => patient.status === "active")
                    .map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patientName(patient)} · {patient.patientNumber}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Clinical visit">
                <select
                  value={draft.visitId}
                  onChange={(event) => handleVisitChange(event.target.value)}
                  className={selectCls}
                  disabled={!draft.patientId}
                >
                  <option value="">Manual prescription</option>
                  {availableVisits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {visit.visitNumber} · {visit.date}
                      {visit.status === "draft" ? " · Draft" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Clinician *">
                <select
                  value={draft.clinicianId}
                  onChange={(event) => setDraft({ ...draft, clinicianId: event.target.value })}
                  className={selectCls}
                  required
                >
                  <option value="">Select clinician</option>
                  {clinicians.map((clinician) => (
                    <option key={clinician.id} value={clinician.id}>
                      {clinician.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prescription date *">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                  required
                />
              </Field>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Refraction</h3>
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Eye</th>
                      <th>Sphere</th>
                      <th>Cylinder</th>
                      <th>Axis</th>
                      <th>Add</th>
                      <th>Prism</th>
                      <th>Visual acuity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["od", "os"] as const).map((eye) => (
                      <tr key={eye}>
                        <td className="font-semibold uppercase">{eye}</td>
                        {(["sphere", "cylinder", "axis", "add", "prism", "va"] as const).map(
                          (field) => (
                            <td key={field}>
                              <Input
                                className="min-w-20"
                                aria-label={`${eye.toUpperCase()} ${field}`}
                                value={draft.eyes[eye][field]}
                                onChange={(event) => updateEye(eye, field, event.target.value)}
                              />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pupillary distance (mm)">
                <Input
                  value={draft.pd}
                  onChange={(event) => setDraft({ ...draft, pd: event.target.value })}
                />
              </Field>
              <Field label="Lens type *">
                <select
                  value={draft.lensType}
                  onChange={(event) => setDraft({ ...draft, lensType: event.target.value })}
                  className={selectCls}
                  required
                >
                  <option>Single vision</option>
                  <option>Bifocal</option>
                  <option>Progressive</option>
                  <option>Contact lenses</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Lens material">
                <Input
                  value={draft.lensMaterial}
                  onChange={(event) => setDraft({ ...draft, lensMaterial: event.target.value })}
                />
              </Field>
              <Field label="Lens coating">
                <Input
                  value={draft.lensCoating}
                  onChange={(event) => setDraft({ ...draft, lensCoating: event.target.value })}
                />
              </Field>
            </div>
            {draft.lensType === "Contact lenses" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Brand">
                  <Input
                    value={draft.contactLens.brand}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        contactLens: { ...draft.contactLens, brand: event.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Base curve">
                  <Input
                    value={draft.contactLens.baseCurve}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        contactLens: { ...draft.contactLens, baseCurve: event.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Diameter">
                  <Input
                    value={draft.contactLens.diameter}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        contactLens: { ...draft.contactLens, diameter: event.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Power">
                  <Input
                    value={draft.contactLens.power}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        contactLens: { ...draft.contactLens, power: event.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Replacement schedule">
                  <Input
                    value={draft.contactLens.replacement}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        contactLens: { ...draft.contactLens, replacement: event.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            )}
            <Field label="Frame information">
              <Input
                value={draft.frameInfo}
                onChange={(event) => setDraft({ ...draft, frameInfo: event.target.value })}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save prescription</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? `Prescription ${selected.prescriptionNumber}` : "Prescription"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Patient:</span>{" "}
                  {patientName(db.patients.find((patient) => patient.id === selected.patientId))}
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {new Date(`${selected.date}T00:00:00`).toLocaleDateString()}
                </p>
                <p>
                  <span className="text-muted-foreground">Clinician:</span>{" "}
                  {db.users.find((user) => user.id === selected.clinicianId)?.fullName ?? "Unknown"}
                </p>
                <p>
                  <span className="text-muted-foreground">PD:</span> {selected.pd || "—"}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Eye</th>
                      <th>Sphere</th>
                      <th>Cylinder</th>
                      <th>Axis</th>
                      <th>Add</th>
                      <th>Prism</th>
                      <th>VA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["od", "os"] as const).map((eye) => (
                      <tr key={eye}>
                        <td className="font-semibold uppercase">{eye}</td>
                        {(["sphere", "cylinder", "axis", "add", "prism", "va"] as const).map(
                          (field) => (
                            <td key={field}>{selected.eyes[eye][field] || "—"}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <span className="text-muted-foreground">Lens:</span>{" "}
                {[selected.lensType, selected.lensMaterial, selected.lensCoating]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {selected.frameInfo && (
                <p>
                  <span className="text-muted-foreground">Frame:</span> {selected.frameInfo}
                </p>
              )}
              {selected.contactLens && (
                <p>
                  <span className="text-muted-foreground">Contact lenses:</span>{" "}
                  {[
                    selected.contactLens.brand,
                    selected.contactLens.power,
                    selected.contactLens.replacement,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {selected.notes && (
                <p>
                  <span className="text-muted-foreground">Notes:</span> {selected.notes}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
