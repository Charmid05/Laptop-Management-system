import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Field, selectCls, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";
import {
  useDB,
  patientName,
  createRecord,
  updateRecord,
  nextNumber,
  todayISO,
  nowISO,
  blankExam,
  blankRx,
  blankPair,
} from "@/services/store";
import { toast } from "sonner";
import { Eye, Stethoscope, FileText, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/clinical")({
  head: () => meta("Clinical visits", "Clinical visits — Amani Eye practice manager."),
  component: ClinicalRouteView,
});

function ClinicalRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/clinical" ? (
    <AppShell module="clinical">
      <ClinicalVisits />
    </AppShell>
  ) : (
    <Outlet />
  );
}

function ClinicalVisits() {
  const navigate = useNavigate();
  const db = useDB();
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const visits = db.visits.sort((a, b) => b.date.localeCompare(a.date));

  const handleCreateVisit = async () => {
    if (!selectedPatient) {
      toast.error("Please select a patient");
      return;
    }

    try {
      const visitNumber = nextNumber(
        db.settings.prescriptionPrefix.replace("RX", "VS"),
        db.visits.map((v) => v.visitNumber),
      );
      const visit = await createRecord("visits", {
        visitNumber,
        patientId: selectedPatient,
        clinicianId: db.users.find((u) => u.role === "optometrist")?.id || "",
        date: todayISO(),
        status: "draft",
        chiefComplaint: {
          reason: "",
          symptoms: "",
          duration: "",
          previousEyeProblems: "",
          patientConcerns: "",
        },
        medicalHistory: {
          general: "",
          medications: "",
          allergies: "",
          conditions: "",
          surgeries: "",
          familyHistory: "",
        },
        ocularHistory: { conditions: "", surgery: "", correction: "", lastExam: "", other: "" },
        examination: blankExam(),
        diagnoses: [],
        findings: "",
        assessment: "",
        managementPlan: "",
        followUpDate: null,
        clinicalNotes: "",
        createdAt: nowISO(),
      });

      toast.success("Clinical visit created");
      navigate({ to: "/clinical/$id", params: { id: visit.id } });
    } catch (error) {
      toast.error("Failed to create visit");
      console.error(error);
    }
  };

  const filteredPatients = db.patients
    .filter((p) =>
      `${patientName(p)} ${p.patientNumber} ${p.phone}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Clinical visits"
        subtitle={`${visits.length} total visits`}
        actions={
          !showNewForm && (
            <Button onClick={() => setShowNewForm(true)} className="rounded-full">
              <Plus className="mr-2 size-4" /> New visit
            </Button>
          )
        }
      />

      {showNewForm && (
        <Panel className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Start new clinical visit</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && filteredPatients.length > 0 && (
                <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border bg-popover shadow-lg max-h-48 overflow-y-auto">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p.id);
                        setSearchQuery(patientName(p));
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{patientName(p)}</span>
                      <span className="ml-2 text-muted-foreground">{p.patientNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleCreateVisit} className="rounded-full">
              Start visit
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNewForm(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Recent clinical visits">
        {visits.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No clinical visits recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Visit #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Clinician</th>
                  <th>Status</th>
                  <th>Chief complaint</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => {
                  const patient = db.patients.find((p) => p.id === v.patientId);
                  const clinician = db.users.find((u) => u.id === v.clinicianId);
                  return (
                    <tr key={v.id}>
                      <td className="font-mono">{v.visitNumber}</td>
                      <td>
                        <Link
                          to="/patients/$id"
                          params={{ id: v.patientId }}
                          className="font-semibold hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td>{new Date(v.date).toLocaleDateString()}</td>
                      <td>{clinician?.fullName || "Unknown"}</td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.status === "completed" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="max-w-xs truncate">{v.chiefComplaint.reason || "-"}</td>
                      <td>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/clinical/$id" params={{ id: v.id }}>
                            View details
                          </Link>
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
    </>
  );
}

function ClinicalVisitDetail() {
  const { id } = RouteDetail.useParams();
  const navigate = useNavigate();
  const db = useDB();
  const [loading, setLoading] = useState(false);

  const visit = db.visits.find((v) => v.id === id);
  if (!visit) {
    return (
      <AppShell module="clinical">
        <PageHeader title="Visit not found" />
        <div className="text-center py-8">
          <p className="text-muted-foreground">Clinical visit not found</p>
          <Button asChild className="mt-4">
            <Link to="/clinical">Back to visits</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const patient = db.patients.find((p) => p.id === visit.patientId);
  const clinician = db.users.find((u) => u.id === visit.clinicianId);

  const [formData, setFormData] = useState({
    chiefComplaint: { ...visit.chiefComplaint },
    medicalHistory: { ...visit.medicalHistory },
    ocularHistory: { ...visit.ocularHistory },
    examination: { ...visit.examination },
    diagnoses: [...visit.diagnoses],
    findings: visit.findings || "",
    assessment: visit.assessment || "",
    managementPlan: visit.managementPlan || "",
    followUpDate: visit.followUpDate || "",
    clinicalNotes: visit.clinicalNotes || "",
  });

  const handleSave = async (status: string) => {
    setLoading(true);
    try {
      await updateRecord("visits", id, {
        ...formData,
        status,
        followUpDate: formData.followUpDate || null,
      });

      // Update patient's last visit date
      await updateRecord("patients", visit.patientId, { lastVisitAt: nowISO() });

      toast.success("Clinical visit saved");
      if (status === "completed") {
        navigate({ to: "/clinical" });
      }
    } catch (error) {
      toast.error("Failed to save visit");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateNested = (section: string, field: string, value: string) => {
    setFormData({
      ...formData,
      [section]: { ...formData[section as keyof typeof formData], [field]: value },
    });
  };

  const updateExam = (section: string, eye: string, field: string, value: string) => {
    setFormData({
      ...formData,
      examination: {
        ...formData.examination,
        [section]: {
          ...formData.examination[section as keyof typeof formData.examination],
          [eye]: {
            ...formData.examination[section as keyof typeof formData.examination][
              eye as keyof (typeof formData.examination)[keyof typeof formData.examination]
            ],
            [field]: value,
          },
        },
      },
    });
  };

  const addDiagnosis = () => {
    setFormData({
      ...formData,
      diagnoses: [...formData.diagnoses, { code: "", description: "", eye: "ou" as const }],
    });
  };

  const updateDiagnosis = (index: number, field: string, value: string) => {
    const updated = [...formData.diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, diagnoses: updated });
  };

  const removeDiagnosis = (index: number) => {
    setFormData({
      ...formData,
      diagnoses: formData.diagnoses.filter((_, i) => i !== index),
    });
  };

  return (
    <>
      <PageHeader
        title={`Visit ${visit.visitNumber}`}
        subtitle={`${patientName(patient)} • ${new Date(visit.date).toLocaleDateString()}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/clinical" })}>
              Back to visits
            </Button>
            {visit.status === "draft" && (
              <Button
                onClick={() => handleSave("completed")}
                disabled={loading}
                className="rounded-full"
              >
                {loading ? "Saving..." : "Complete visit"}
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="complaint" className="space-y-6">
        <TabsList>
          <TabsTrigger value="complaint">Chief complaint</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="examination">Examination</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="plan">Management plan</TabsTrigger>
        </TabsList>

        <TabsContent value="complaint" className="space-y-4">
          <Panel title="Chief complaint">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Reason for visit">
                <Textarea
                  value={formData.chiefComplaint.reason}
                  onChange={(e) => updateNested("chiefComplaint", "reason", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Symptoms">
                <Textarea
                  value={formData.chiefComplaint.symptoms}
                  onChange={(e) => updateNested("chiefComplaint", "symptoms", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Duration">
                <Input
                  value={formData.chiefComplaint.duration}
                  onChange={(e) => updateNested("chiefComplaint", "duration", e.target.value)}
                />
              </Field>
              <Field label="Previous eye problems">
                <Textarea
                  value={formData.chiefComplaint.previousEyeProblems}
                  onChange={(e) =>
                    updateNested("chiefComplaint", "previousEyeProblems", e.target.value)
                  }
                  rows={2}
                />
              </Field>
              <Field label="Patient concerns" className="md:col-span-2">
                <Textarea
                  value={formData.chiefComplaint.patientConcerns}
                  onChange={(e) =>
                    updateNested("chiefComplaint", "patientConcerns", e.target.value)
                  }
                  rows={2}
                />
              </Field>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Panel title="Medical history">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="General health">
                <Textarea
                  value={formData.medicalHistory.general}
                  onChange={(e) => updateNested("medicalHistory", "general", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Medications">
                <Textarea
                  value={formData.medicalHistory.medications}
                  onChange={(e) => updateNested("medicalHistory", "medications", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Allergies">
                <Textarea
                  value={formData.medicalHistory.allergies}
                  onChange={(e) => updateNested("medicalHistory", "allergies", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Medical conditions">
                <Textarea
                  value={formData.medicalHistory.conditions}
                  onChange={(e) => updateNested("medicalHistory", "conditions", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Surgeries">
                <Textarea
                  value={formData.medicalHistory.surgeries}
                  onChange={(e) => updateNested("medicalHistory", "surgeries", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Family history">
                <Textarea
                  value={formData.medicalHistory.familyHistory}
                  onChange={(e) => updateNested("medicalHistory", "familyHistory", e.target.value)}
                  rows={2}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Ocular history">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ocular conditions">
                <Textarea
                  value={formData.ocularHistory.conditions}
                  onChange={(e) => updateNested("ocularHistory", "conditions", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Eye surgery">
                <Textarea
                  value={formData.ocularHistory.surgery}
                  onChange={(e) => updateNested("ocularHistory", "surgery", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Current correction">
                <Textarea
                  value={formData.ocularHistory.correction}
                  onChange={(e) => updateNested("ocularHistory", "correction", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Last eye exam">
                <Input
                  value={formData.ocularHistory.lastExam}
                  onChange={(e) => updateNested("ocularHistory", "lastExam", e.target.value)}
                />
              </Field>
              <Field label="Other" className="md:col-span-2">
                <Textarea
                  value={formData.ocularHistory.other}
                  onChange={(e) => updateNested("ocularHistory", "other", e.target.value)}
                  rows={2}
                />
              </Field>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="examination" className="space-y-4">
          <Panel title="Visual acuity">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-semibold">Right eye (OD)</h4>
                <Field label="Unaided">
                  <Input
                    value={formData.examination.visualAcuity.unaidedOd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            unaidedOd: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Aided">
                  <Input
                    value={formData.examination.visualAcuity.aidedOd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            aidedOd: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Pinhole">
                  <Input
                    value={formData.examination.visualAcuity.pinholeOd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            pinholeOd: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">Left eye (OS)</h4>
                <Field label="Unaided">
                  <Input
                    value={formData.examination.visualAcuity.unaidedOs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            unaidedOs: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Aided">
                  <Input
                    value={formData.examination.visualAcuity.aidedOs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            aidedOs: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Pinhole">
                  <Input
                    value={formData.examination.visualAcuity.pinholeOs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examination: {
                          ...formData.examination,
                          visualAcuity: {
                            ...formData.examination.visualAcuity,
                            pinholeOs: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Unaided near" className="md:col-span-2">
                <Input
                  value={formData.examination.visualAcuity.unaidedNear}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: {
                        ...formData.examination,
                        visualAcuity: {
                          ...formData.examination.visualAcuity,
                          unaidedNear: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Refraction">
            <Tabs defaultValue="subjective">
              <TabsList>
                <TabsTrigger value="subjective">Subjective</TabsTrigger>
                <TabsTrigger value="objective">Objective</TabsTrigger>
                <TabsTrigger value="final">Final</TabsTrigger>
              </TabsList>
              <TabsContent value="subjective">
                <RefractionForm
                  data={formData.examination.refraction.subjective}
                  onChange={(eye, field, value) => updateExam("refraction", eye, field, value)}
                  section="subjective"
                />
              </TabsContent>
              <TabsContent value="objective">
                <RefractionForm
                  data={formData.examination.refraction.objective}
                  onChange={(eye, field, value) => updateExam("refraction", eye, field, value)}
                  section="objective"
                />
              </TabsContent>
              <TabsContent value="final">
                <RefractionForm
                  data={formData.examination.refraction.final}
                  onChange={(eye, field, value) => updateExam("refraction", eye, field, value)}
                  section="final"
                />
              </TabsContent>
            </Tabs>
          </Panel>

          <Panel title="Other examination findings">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="PD">
                <Input
                  value={formData.examination.pd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, pd: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Near PD">
                <Input
                  value={formData.examination.nearPd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, nearPd: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Binocular vision">
                <Input
                  value={formData.examination.binocularVision}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, binocularVision: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Colour vision">
                <Input
                  value={formData.examination.colourVision}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, colourVision: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Ocular motility">
                <Input
                  value={formData.examination.ocularMotility}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, ocularMotility: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Pupils">
                <Input
                  value={formData.examination.pupils}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, pupils: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Anterior segment">
                <Textarea
                  value={formData.examination.anteriorSegment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, anteriorSegment: e.target.value },
                    })
                  }
                  rows={2}
                />
              </Field>
              <Field label="Posterior segment">
                <Textarea
                  value={formData.examination.posteriorSegment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, posteriorSegment: e.target.value },
                    })
                  }
                  rows={2}
                />
              </Field>
              <Field label="IOP OD">
                <Input
                  value={formData.examination.iopOd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, iopOd: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="IOP OS">
                <Input
                  value={formData.examination.iopOs}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, iopOs: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Keratometry" className="md:col-span-2">
                <Input
                  value={formData.examination.keratometry || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, keratometry: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Contact lens notes" className="md:col-span-2">
                <Textarea
                  value={formData.examination.contactLensNotes || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examination: { ...formData.examination, contactLensNotes: e.target.value },
                    })
                  }
                  rows={2}
                />
              </Field>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="diagnosis" className="space-y-4">
          <Panel title="Diagnoses">
            <div className="space-y-3">
              {formData.diagnoses.map((d, i) => (
                <div key={i} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Field label="Code">
                      <Input
                        value={d.code || ""}
                        onChange={(e) => updateDiagnosis(i, "code", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Description">
                      <Input
                        value={d.description}
                        onChange={(e) => updateDiagnosis(i, "description", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="w-24">
                    <Field label="Eye">
                      <select
                        value={d.eye}
                        onChange={(e) => updateDiagnosis(i, "eye", e.target.value)}
                        className={selectCls}
                      >
                        <option value="od">OD</option>
                        <option value="os">OS</option>
                        <option value="ou">OU</option>
                      </select>
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDiagnosis(i)}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addDiagnosis}
                className="rounded-full"
              >
                <Plus className="mr-2 size-4" /> Add diagnosis
              </Button>
            </div>
          </Panel>

          <Panel title="Findings">
            <Field label="Clinical findings">
              <Textarea
                value={formData.findings}
                onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                rows={4}
              />
            </Field>
          </Panel>

          <Panel title="Assessment">
            <Field label="Clinical assessment">
              <Textarea
                value={formData.assessment}
                onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                rows={4}
              />
            </Field>
          </Panel>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <Panel title="Management plan">
            <Field label="Treatment plan">
              <Textarea
                value={formData.managementPlan}
                onChange={(e) => setFormData({ ...formData, managementPlan: e.target.value })}
                rows={4}
              />
            </Field>
          </Panel>

          <Panel title="Follow-up">
            <Field label="Follow-up date">
              <Input
                type="date"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              />
            </Field>
          </Panel>

          <Panel title="Clinical notes">
            <Field label="Additional notes">
              <Textarea
                value={formData.clinicalNotes}
                onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
                rows={4}
              />
            </Field>
          </Panel>

          <div className="flex gap-3">
            <Button
              onClick={() => handleSave("draft")}
              disabled={loading}
              variant="outline"
              className="rounded-full"
            >
              {loading ? "Saving..." : "Save draft"}
            </Button>
            <Button
              onClick={() => handleSave("completed")}
              disabled={loading}
              className="rounded-full"
            >
              {loading ? "Saving..." : "Complete visit"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function RefractionForm({
  data,
  onChange,
  section,
}: {
  data: any;
  onChange: (eye: string, field: string, value: string) => void;
  section: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-semibold">Right eye (OD)</h4>
        <Field label="Sphere">
          <Input
            value={data.od?.sphere || ""}
            onChange={(e) => onChange("od", "sphere", e.target.value)}
          />
        </Field>
        <Field label="Cylinder">
          <Input
            value={data.od?.cylinder || ""}
            onChange={(e) => onChange("od", "cylinder", e.target.value)}
          />
        </Field>
        <Field label="Axis">
          <Input
            value={data.od?.axis || ""}
            onChange={(e) => onChange("od", "axis", e.target.value)}
          />
        </Field>
        <Field label="Add">
          <Input
            value={data.od?.add || ""}
            onChange={(e) => onChange("od", "add", e.target.value)}
          />
        </Field>
        <Field label="Prism">
          <Input
            value={data.od?.prism || ""}
            onChange={(e) => onChange("od", "prism", e.target.value)}
          />
        </Field>
        <Field label="VA">
          <Input value={data.od?.va || ""} onChange={(e) => onChange("od", "va", e.target.value)} />
        </Field>
      </div>
      <div className="space-y-3">
        <h4 className="font-semibold">Left eye (OS)</h4>
        <Field label="Sphere">
          <Input
            value={data.os?.sphere || ""}
            onChange={(e) => onChange("os", "sphere", e.target.value)}
          />
        </Field>
        <Field label="Cylinder">
          <Input
            value={data.os?.cylinder || ""}
            onChange={(e) => onChange("os", "cylinder", e.target.value)}
          />
        </Field>
        <Field label="Axis">
          <Input
            value={data.os?.axis || ""}
            onChange={(e) => onChange("os", "axis", e.target.value)}
          />
        </Field>
        <Field label="Add">
          <Input
            value={data.os?.add || ""}
            onChange={(e) => onChange("os", "add", e.target.value)}
          />
        </Field>
        <Field label="Prism">
          <Input
            value={data.os?.prism || ""}
            onChange={(e) => onChange("os", "prism", e.target.value)}
          />
        </Field>
        <Field label="VA">
          <Input value={data.os?.va || ""} onChange={(e) => onChange("os", "va", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}
