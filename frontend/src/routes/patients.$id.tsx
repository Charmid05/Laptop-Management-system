import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Field, StatusBadge, tableCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";
import { useDB, patientName, age, updateRecord, nowISO } from "@/services/store";
import { toast } from "sonner";
import { Calendar, FileText, Eye, Phone, Mail, MapPin, User, Edit2, History } from "lucide-react";

export const Route = createFileRoute("/patients/$id")({
  head: () => meta("Patient profile", "Patient profile — Amani Eye practice manager."),
  component: () => <AppShell module="patients"><PatientProfile /></AppShell>,
});

function PatientProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const db = useDB();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const patient = db.patients.find((p) => p.id === id);
  if (!patient) {
    return (
      <AppShell module="patients">
        <PageHeader title="Patient not found" />
        <div className="text-center py-8">
          <p className="text-muted-foreground">Patient not found</p>
          <Button asChild className="mt-4"><Link to="/patients">Back to patients</Link></Button>
        </div>
      </AppShell>
    );
  }

  const [formData, setFormData] = useState({
    firstName: patient.firstName,
    middleName: patient.middleName || "",
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    nationalId: patient.nationalId || "",
    phone: patient.phone,
    altPhone: patient.altPhone || "",
    email: patient.email || "",
    county: patient.county,
    town: patient.town,
    address: patient.address || "",
    emergencyContactName: patient.emergencyContact.name,
    emergencyContactRelationship: patient.emergencyContact.relationship,
    emergencyContactPhone: patient.emergencyContact.phone,
    occupation: patient.occupation || "",
    referralSource: patient.referralSource || "",
    insuranceProviderId: patient.insuranceProviderId || "",
    insuranceMemberNumber: patient.insuranceMemberNumber || "",
    notes: patient.notes || "",
    status: patient.status,
  });

  const patientVisits = db.visits.filter((v) => v.patientId === id).sort((a, b) => b.date.localeCompare(a.date));
  const patientAppointments = db.appointments.filter((a) => a.patientId === id).sort((a, b) => b.date.localeCompare(a.date));
  const patientInvoices = db.invoices.filter((i) => i.patientId === id).sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateRecord("patients", id, {
        firstName: formData.firstName,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        nationalId: formData.nationalId || undefined,
        phone: formData.phone,
        altPhone: formData.altPhone || undefined,
        email: formData.email || undefined,
        county: formData.county,
        town: formData.town,
        address: formData.address || undefined,
        emergencyContact: {
          name: formData.emergencyContactName,
          relationship: formData.emergencyContactRelationship,
          phone: formData.emergencyContactPhone,
        },
        occupation: formData.occupation || undefined,
        referralSource: formData.referralSource || undefined,
        insuranceProviderId: formData.insuranceProviderId || undefined,
        insuranceMemberNumber: formData.insuranceMemberNumber || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
      });
      toast.success("Patient updated successfully");
      setEditing(false);
    } catch (error) {
      toast.error("Failed to update patient");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const insuranceProvider = db.providers.find((p) => p.id === patient.insuranceProviderId);

  return (
    <>
      <PageHeader
        title={patientName(patient)}
        subtitle={`Patient #${patient.patientNumber} • ${age(patient.dateOfBirth)} years old`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(!editing)} className="rounded-full">
              <Edit2 className="mr-2 size-4" /> {editing ? "Cancel" : "Edit"}
            </Button>
            <Button asChild className="rounded-full"><Link to="/appointments">Book appointment</Link></Button>
          </>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Clinical visits</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Personal information">
              {editing ? (
                <div className="space-y-4">
                  <Field label="First name">
                    <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                  </Field>
                  <Field label="Middle name">
                    <Input value={formData.middleName} onChange={(e) => setFormData({ ...formData, middleName: e.target.value })} />
                  </Field>
                  <Field label="Last name">
                    <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                  </Field>
                  <Field label="Date of birth">
                    <Input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as "male" | "female" | "other" })}
                      className={selectCls}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="National ID">
                    <Input value={formData.nationalId} onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "archived" })}
                      className={selectCls}
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> <span className="font-medium">{patientName(patient)}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /> <span>{new Date(patient.dateOfBirth).toLocaleDateString()} ({age(patient.dateOfBirth)} years)</span></div>
                  <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> <span className="capitalize">{patient.gender}</span></div>
                  {patient.nationalId && <div className="flex items-center gap-2"><span className="text-muted-foreground">ID:</span> <span>{patient.nationalId}</span></div>}
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">Status:</span> <StatusBadge status={patient.status} /></div>
                </div>
              )}
            </Panel>

            <Panel title="Contact information">
              {editing ? (
                <div className="space-y-4">
                  <Field label="Phone">
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </Field>
                  <Field label="Alternative phone">
                    <Input value={formData.altPhone} onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </Field>
                  <Field label="County">
                    <Input value={formData.county} onChange={(e) => setFormData({ ...formData, county: e.target.value })} />
                  </Field>
                  <Field label="Town">
                    <Input value={formData.town} onChange={(e) => setFormData({ ...formData, town: e.target.value })} />
                  </Field>
                  <Field label="Address">
                    <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> <span>{patient.phone}</span></div>
                  {patient.altPhone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> <span>{patient.altPhone}</span></div>}
                  {patient.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /> <span>{patient.email}</span></div>}
                  <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> <span>{patient.town}, {patient.county}</span></div>
                  {patient.address && <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> <span>{patient.address}</span></div>}
                </div>
              )}
            </Panel>

            <Panel title="Emergency contact">
              {editing ? (
                <div className="space-y-4">
                  <Field label="Name">
                    <Input value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} />
                  </Field>
                  <Field label="Relationship">
                    <Input value={formData.emergencyContactRelationship} onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })} />
                  </Field>
                  <Field label="Phone">
                    <Input value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> <span>{patient.emergencyContact.name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">Relationship:</span> <span>{patient.emergencyContact.relationship}</span></div>
                  <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> <span>{patient.emergencyContact.phone}</span></div>
                </div>
              )}
            </Panel>

            <Panel title="Additional information">
              {editing ? (
                <div className="space-y-4">
                  <Field label="Occupation">
                    <Input value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} />
                  </Field>
                  <Field label="Referral source">
                    <Input value={formData.referralSource} onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })} />
                  </Field>
                  <Field label="Insurance provider">
                    <select
                      value={formData.insuranceProviderId}
                      onChange={(e) => setFormData({ ...formData, insuranceProviderId: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {db.providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Insurance member number">
                    <Input value={formData.insuranceMemberNumber} onChange={(e) => setFormData({ ...formData, insuranceMemberNumber: e.target.value })} />
                  </Field>
                  <Field label="Notes">
                    <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  {patient.occupation && <div className="flex items-center gap-2"><span className="text-muted-foreground">Occupation:</span> <span>{patient.occupation}</span></div>}
                  {patient.referralSource && <div className="flex items-center gap-2"><span className="text-muted-foreground">Referral:</span> <span>{patient.referralSource}</span></div>}
                  {insuranceProvider && <div className="flex items-center gap-2"><span className="text-muted-foreground">Insurance:</span> <span>{insuranceProvider.name}</span></div>}
                  {patient.insuranceMemberNumber && <div className="flex items-center gap-2"><span className="text-muted-foreground">Member #:</span> <span>{patient.insuranceMemberNumber}</span></div>}
                  {patient.notes && <div className="flex items-center gap-2"><span className="text-muted-foreground">Notes:</span> <span>{patient.notes}</span></div>}
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">Registered:</span> <span>{new Date(patient.registeredAt).toLocaleDateString()}</span></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">Last visit:</span> <span>{patient.lastVisitAt ? new Date(patient.lastVisitAt).toLocaleDateString() : "Never"}</span></div>
                </div>
              )}
            </Panel>
          </div>

          {editing && (
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={loading} className="rounded-full">
                {loading ? "Saving..." : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="rounded-full">
                Cancel
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits">
          <Panel title="Clinical visits">
            {patientVisits.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No clinical visits recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Visit #</th>
                      <th>Date</th>
                      <th>Clinician</th>
                      <th>Status</th>
                      <th>Chief complaint</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientVisits.map((v) => (
                      <tr key={v.id}>
                        <td className="font-mono">{v.visitNumber}</td>
                        <td>{new Date(v.date).toLocaleDateString()}</td>
                        <td>{db.users.find((u) => u.id === v.clinicianId)?.fullName || "Unknown"}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td className="max-w-xs truncate">{v.chiefComplaint.reason}</td>
                        <td>
                          <Button asChild variant="ghost" size="sm"><Link to="/clinical">View</Link></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="appointments">
          <Panel title="Appointments">
            {patientAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments scheduled</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientAppointments.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.date).toLocaleDateString()}</td>
                        <td className="font-mono">{a.time}</td>
                        <td className="capitalize">{a.type.replace(/_/g, " ")}</td>
                        <td>{a.reason}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>
                          <Button asChild variant="ghost" size="sm"><Link to="/appointments">View</Link></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="billing">
          <Panel title="Billing history">
            {patientInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No invoices</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientInvoices.map((inv) => {
                      const totals = db.payments
                        .filter((p) => p.invoiceId === inv.id && p.status === "confirmed")
                        .reduce((sum, p) => sum + p.amount, 0);
                      const subtotal = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0);
                      const tax = (subtotal * inv.taxRate) / 100;
                      const total = subtotal + tax;
                      const balance = total - totals;
                      return (
                        <tr key={inv.id}>
                          <td className="font-mono">{inv.invoiceNumber}</td>
                          <td>{new Date(inv.date).toLocaleDateString()}</td>
                          <td><StatusBadge status={inv.status} /></td>
                          <td>{db.settings.currency} {total.toLocaleString()}</td>
                          <td>{db.settings.currency} {totals.toLocaleString()}</td>
                          <td>{db.settings.currency} {balance.toLocaleString()}</td>
                          <td>
                            <Button asChild variant="ghost" size="sm"><Link to="/invoices">View</Link></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
