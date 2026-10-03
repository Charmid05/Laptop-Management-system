import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Field, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { meta } from "@/lib/meta";
import { useDB, createRecord, nextNumber, todayISO, nowISO } from "@/services/store";
import { toast } from "sonner";

export const Route = createFileRoute("/patients/new")({
  head: () => meta("Register patient", "Register patient — Amani Eye practice manager."),
  component: () => <AppShell module="patients"><PatientRegistration /></AppShell>,
});

function PatientRegistration() {
  const navigate = useNavigate();
  const db = useDB();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as "male" | "female" | "other",
    nationalId: "",
    phone: "",
    altPhone: "",
    email: "",
    county: "",
    town: "",
    address: "",
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinPhone: "",
    nextOfKinAddress: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    occupation: "",
    referralSource: "",
    insuranceProviderId: "",
    insuranceMemberNumber: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.gender || !formData.phone || !formData.county || !formData.town) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate date of birth
    const dob = new Date(formData.dateOfBirth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dob > today) {
      toast.error("Date of birth cannot be in the future");
      return;
    }

    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 120);
    if (dob < minAgeDate) {
      toast.error("Invalid date of birth: age cannot exceed 120 years");
      return;
    }

    const maxAgeDate = new Date();
    maxAgeDate.setFullYear(maxAgeDate.getFullYear() - 18);
    if (dob > maxAgeDate) {
      toast.warning("Patient appears to be under 18 years old. Please verify the date of birth.");
    }

    setLoading(true);
    try {
      const patientNumber = nextNumber(db.settings.invoicePrefix.replace("INV", "PT"), db.patients.map(p => p.patientNumber));
      await createRecord("patients", {
        patientNumber,
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
        nextOfKin: formData.nextOfKinName ? {
          name: formData.nextOfKinName,
          relationship: formData.nextOfKinRelationship,
          phone: formData.nextOfKinPhone,
          address: formData.nextOfKinAddress || undefined,
        } : undefined,
        occupation: formData.occupation || undefined,
        referralSource: formData.referralSource || undefined,
        insuranceProviderId: formData.insuranceProviderId || undefined,
        insuranceMemberNumber: formData.insuranceMemberNumber || undefined,
        notes: formData.notes || undefined,
        status: "active",
        registeredAt: nowISO(),
        lastVisitAt: null,
      });
      toast.success("Patient registered successfully");
      navigate({ to: "/patients" });
    } catch (error) {
      toast.error("Failed to register patient");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Register patient"
        subtitle="Add a new patient to the practice"
        actions={<Button variant="outline" onClick={() => navigate({ to: "/patients" })}>Cancel</Button>}
      />

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Personal information</h3>
            <Field label="First name *">
              <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
            </Field>
            <Field label="Middle name">
              <Input value={formData.middleName} onChange={(e) => setFormData({ ...formData, middleName: e.target.value })} />
            </Field>
            <Field label="Last name *">
              <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
            </Field>
            <Field label="Date of birth *">
              <Input
                type="date"
                value={formData.dateOfBirth}
                max={todayISO()}
                min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 120); return d.toISOString().slice(0, 10); })()}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                required
              />
            </Field>
            <Field label="Gender *">
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as "male" | "female" | "other" })}
                className={selectCls}
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="National ID">
              <Input value={formData.nationalId} onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact information</h3>
            <Field label="Phone *">
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
            </Field>
            <Field label="Alternative phone">
              <Input value={formData.altPhone} onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Field>
            <Field label="County *">
              <Input value={formData.county} onChange={(e) => setFormData({ ...formData, county: e.target.value })} required />
            </Field>
            <Field label="Town *">
              <Input value={formData.town} onChange={(e) => setFormData({ ...formData, town: e.target.value })} required />
            </Field>
            <Field label="Address">
              <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
            </Field>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Next of kin</h3>
            <Field label="Name">
              <Input value={formData.nextOfKinName} onChange={(e) => setFormData({ ...formData, nextOfKinName: e.target.value })} />
            </Field>
            <Field label="Relationship">
              <Input value={formData.nextOfKinRelationship} onChange={(e) => setFormData({ ...formData, nextOfKinRelationship: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={formData.nextOfKinPhone} onChange={(e) => setFormData({ ...formData, nextOfKinPhone: e.target.value })} />
            </Field>
            <Field label="Address">
              <Textarea value={formData.nextOfKinAddress} onChange={(e) => setFormData({ ...formData, nextOfKinAddress: e.target.value })} rows={2} />
            </Field>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Emergency contact</h3>
            <Field label="Name *">
              <Input value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} required />
            </Field>
            <Field label="Relationship *">
              <Input value={formData.emergencyContactRelationship} onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })} required />
            </Field>
            <Field label="Phone *">
              <Input value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} required />
            </Field>
          </div>
        </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Additional information</h3>
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

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="rounded-full">
            {loading ? "Registering..." : "Register patient"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/patients" })} className="rounded-full">
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
