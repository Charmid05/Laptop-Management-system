import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Stat, StatusBadge, Field, selectCls, tableCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import {
  useDB,
  createRecord,
  updateRecord,
  invoiceTotals,
  money,
  nextNumber,
  patientName,
  nowISO,
} from "@/services/store";
import type { ClaimStatus } from "@/types";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/insurance")({
  head: () => meta("Insurance claims", "Insurance claims — Amani Eye practice manager."),
  component: () => (
    <AppShell module="insurance">
      <InsuranceClaims />
    </AppShell>
  ),
});

function InsuranceClaims() {
  const db = useDB();
  const { user } = useSession();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [adjudicatingId, setAdjudicatingId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [decision, setDecision] = useState<"approved" | "partially_approved" | "rejected">(
    "approved",
  );
  const [approvedAmount, setApprovedAmount] = useState("");
  const [patientCopay, setPatientCopay] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const availableInvoices = db.invoices.filter(
    (invoice) =>
      !["draft", "cancelled", "refunded"].includes(invoice.status) &&
      !db.claims.some((claim) => claim.invoiceId === invoice.id) &&
      Boolean(
        db.patients.find((patient) => patient.id === invoice.patientId)?.insuranceProviderId,
      ) &&
      invoiceTotals(invoice, db).balance > 0,
  );
  const selectedInvoice = db.invoices.find((invoice) => invoice.id === invoiceId);
  const selectedPatient =
    selectedInvoice && db.patients.find((patient) => patient.id === selectedInvoice.patientId);
  const filteredClaims = [...db.claims]
    .sort((a, b) => b.claimNumber.localeCompare(a.claimNumber))
    .filter((claim) => {
      const patient = db.patients.find((item) => item.id === claim.patientId);
      const provider = db.providers.find((item) => item.id === claim.providerId);
      const invoice = db.invoices.find((item) => item.id === claim.invoiceId);
      const matchesSearch =
        `${claim.claimNumber} ${patientName(patient)} ${provider?.name ?? ""} ${invoice?.invoiceNumber ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      return matchesSearch && (statusFilter === "all" || claim.status === statusFilter);
    });

  const handleInvoiceChange = (id: string) => {
    const invoice = db.invoices.find((item) => item.id === id);
    const patient = invoice && db.patients.find((item) => item.id === invoice.patientId);
    setInvoiceId(id);
    setProviderId(patient?.insuranceProviderId ?? "");
    setMemberNumber(patient?.insuranceMemberNumber ?? "");
    setClaimedAmount(invoice ? String(invoiceTotals(invoice, db).balance) : "");
  };

  const handleCreateClaim = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invoice = db.invoices.find((item) => item.id === invoiceId);
    const amount = Number(claimedAmount);
    if (
      !invoice ||
      !selectedPatient ||
      !providerId ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > invoiceTotals(invoice, db).balance
    ) {
      toast.error("Choose an insured invoice and enter a valid claim amount within its balance");
      return;
    }

    setSaving(true);
    try {
      const claimNumber = nextNumber(
        "CLM-",
        db.claims.map((claim) => claim.claimNumber),
      );
      const claim = await createRecord("claims", {
        claimNumber,
        providerId,
        patientId: invoice.patientId,
        invoiceId: invoice.id,
        memberNumber: memberNumber.trim(),
        policyNumber: policyNumber.trim(),
        claimedAmount: amount,
        approvedAmount: 0,
        patientCopay: 0,
        status: "draft",
        submittedAt: null,
        notes: claimNotes.trim() || undefined,
      });
      await updateRecord("invoices", invoice.id, { insuranceClaimId: claim.id });
      toast.success(`Claim ${claimNumber} created`);
      setShowNewDialog(false);
      setInvoiceId("");
      setProviderId("");
      setMemberNumber("");
      setPolicyNumber("");
      setClaimedAmount("");
      setClaimNotes("");
    } catch (error) {
      toast.error("Failed to create insurance claim");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClaim = async (claimId: string) => {
    try {
      await updateRecord("claims", claimId, {
        status: "submitted",
        submittedAt: nowISO().slice(0, 10),
      });
      toast.success("Claim submitted");
    } catch (error) {
      toast.error("Failed to submit claim");
      console.error(error);
    }
  };

  const openAdjudication = (claimId: string) => {
    const claim = db.claims.find((item) => item.id === claimId);
    if (!claim) return;
    setAdjudicatingId(claim.id);
    setDecision("approved");
    setApprovedAmount(String(claim.claimedAmount));
    setPatientCopay("0");
  };

  const handleAdjudication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const claim = db.claims.find((item) => item.id === adjudicatingId);
    const approved = Number(approvedAmount);
    const copay = Number(patientCopay);
    if (
      !claim ||
      !Number.isFinite(approved) ||
      !Number.isFinite(copay) ||
      approved < 0 ||
      copay < 0 ||
      approved + copay > claim.claimedAmount ||
      (decision === "approved" && approved <= 0) ||
      (decision === "rejected" && approved !== 0)
    ) {
      toast.error("Enter a valid decision; approved amount and copay cannot exceed the claim");
      return;
    }
    try {
      await updateRecord("claims", claim.id, {
        status: decision,
        approvedAmount: approved,
        patientCopay: copay,
      });
      toast.success("Claim decision saved");
      setAdjudicatingId("");
    } catch (error) {
      toast.error("Failed to save claim decision");
      console.error(error);
    }
  };

  const handleMarkPaid = async (claimId: string) => {
    const claim = db.claims.find((item) => item.id === claimId);
    const invoice = claim && db.invoices.find((item) => item.id === claim.invoiceId);
    if (!claim || !invoice || !user || !["approved", "partially_approved"].includes(claim.status))
      return;
    const existingRemittance = db.payments.find(
      (payment) =>
        payment.invoiceId === invoice.id &&
        payment.method === "insurance" &&
        payment.notes === `Insurance claim ${claim.claimNumber}`,
    );
    const balance = invoiceTotals(invoice, db).balance;
    if (!existingRemittance && claim.approvedAmount > balance) {
      toast.error(
        "Approved amount exceeds the invoice balance. Review the invoice before posting this remittance.",
      );
      return;
    }
    setSaving(true);
    try {
      if (!existingRemittance && claim.approvedAmount > 0) {
        const receiptNumber = nextNumber(
          db.settings.receiptPrefix,
          db.payments.map((payment) => payment.receiptNumber),
        );
        await createRecord("payments", {
          receiptNumber,
          invoiceId: invoice.id,
          patientId: invoice.patientId,
          amount: claim.approvedAmount,
          method: "insurance",
          reference: claim.claimNumber,
          date: nowISO(),
          receivedBy: user.id,
          status: "confirmed",
          notes: `Insurance claim ${claim.claimNumber}`,
        });
      }
      const remittanceTotal =
        db.payments
          .filter((payment) => payment.invoiceId === invoice.id && payment.status === "confirmed")
          .reduce((sum, payment) => sum + payment.amount, 0) +
        (existingRemittance ? 0 : claim.approvedAmount);
      const total = invoiceTotals(invoice, db).total;
      await updateRecord("invoices", invoice.id, {
        status: remittanceTotal >= total ? "paid" : "partially_paid",
      });
      await updateRecord("claims", claim.id, { status: "paid" });
      toast.success("Insurance remittance recorded in Payments");
    } catch (error) {
      toast.error("Failed to record insurance remittance");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const paidClaims = db.claims.filter((claim) => claim.status === "paid");
  const openClaims = db.claims.filter((claim) => !["paid", "rejected"].includes(claim.status));
  const totalClaimed = openClaims.reduce((sum, claim) => sum + claim.claimedAmount, 0);

  return (
    <>
      <PageHeader
        title="Insurance claims"
        subtitle={`${db.claims.length} total claims`}
        actions={
          availableInvoices.length > 0 &&
          db.providers.some((provider) => provider.status === "active") ? (
            <Button onClick={() => setShowNewDialog(true)} className="rounded-full">
              <Plus className="size-4" /> New claim
            </Button>
          ) : undefined
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Open claims"
          value={openClaims.length}
          hint="Awaiting completion"
          accent="info"
        />
        <Stat
          label="Amount in review"
          value={money(totalClaimed, db.settings.currency)}
          hint="Unpaid claim amounts"
          accent="accent"
        />
        <Stat
          label="Paid claims"
          value={paidClaims.length}
          hint={money(
            paidClaims.reduce((sum, claim) => sum + claim.approvedAmount, 0),
            db.settings.currency,
          )}
          accent="ink"
        />
      </div>

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search claim, patient, provider..."
            aria-label="Search insurance claims"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={selectCls}
            aria-label="Filter claims by status"
          >
            <option value="all">All statuses</option>
            {(
              [
                "draft",
                "submitted",
                "approved",
                "partially_approved",
                "rejected",
                "paid",
              ] as ClaimStatus[]
            ).map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {filteredClaims.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No claims match these filters"
              : "No insurance claims recorded"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Invoice</th>
                  <th>Claimed</th>
                  <th>Approved</th>
                  <th>Copay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((claim) => {
                  const invoice = db.invoices.find((item) => item.id === claim.invoiceId);
                  const patient = db.patients.find((item) => item.id === claim.patientId);
                  const provider = db.providers.find((item) => item.id === claim.providerId);
                  return (
                    <tr key={claim.id}>
                      <td className="font-mono">{claim.claimNumber}</td>
                      <td>
                        <Link
                          to="/patients/$id"
                          params={{ id: claim.patientId }}
                          className="font-semibold hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td>{provider?.name ?? "Unknown"}</td>
                      <td>{invoice?.invoiceNumber ?? "Unknown"}</td>
                      <td>{money(claim.claimedAmount, db.settings.currency)}</td>
                      <td>{money(claim.approvedAmount, db.settings.currency)}</td>
                      <td>{money(claim.patientCopay, db.settings.currency)}</td>
                      <td>
                        <StatusBadge status={claim.status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {claim.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmitClaim(claim.id)}
                            >
                              Submit
                            </Button>
                          )}
                          {claim.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjudication(claim.id)}
                            >
                              Adjudicate
                            </Button>
                          )}
                          {["approved", "partially_approved"].includes(claim.status) && (
                            <Button
                              size="sm"
                              onClick={() => void handleMarkPaid(claim.id)}
                              disabled={saving || !user}
                            >
                              Mark paid
                            </Button>
                          )}
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

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New insurance claim</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleCreateClaim(event)} className="space-y-4">
            <Field label="Invoice *">
              <select
                value={invoiceId}
                onChange={(event) => handleInvoiceChange(event.target.value)}
                className={selectCls}
                required
              >
                <option value="">Select insured invoice</option>
                {availableInvoices.map((invoice) => {
                  const patient = db.patients.find((item) => item.id === invoice.patientId);
                  return (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} · {patientName(patient)} ·{" "}
                      {money(invoiceTotals(invoice, db).balance, db.settings.currency)}
                    </option>
                  );
                })}
              </select>
            </Field>
            {selectedPatient && (
              <p className="text-sm text-muted-foreground">
                Patient: {patientName(selectedPatient)} · Member:{" "}
                {selectedPatient.insuranceMemberNumber || "Not on file"}
              </p>
            )}
            <Field label="Insurance provider *">
              <select
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                className={selectCls}
                required
              >
                <option value="">Select provider</option>
                {db.providers
                  .filter((provider) => provider.status === "active")
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.code})
                    </option>
                  ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Member number">
                <Input
                  value={memberNumber}
                  onChange={(event) => setMemberNumber(event.target.value)}
                />
              </Field>
              <Field label="Policy number">
                <Input
                  value={policyNumber}
                  onChange={(event) => setPolicyNumber(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Claimed amount *">
              <Input
                type="number"
                min="0.01"
                max={selectedInvoice ? invoiceTotals(selectedInvoice, db).balance : undefined}
                step="0.01"
                value={claimedAmount}
                onChange={(event) => setClaimedAmount(event.target.value)}
                required
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={claimNotes}
                onChange={(event) => setClaimNotes(event.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create claim"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(adjudicatingId)}
        onOpenChange={(open) => {
          if (!open) setAdjudicatingId("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjudicate claim</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void handleAdjudication(event)} className="space-y-4">
            <Field label="Decision *">
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value as typeof decision)}
                className={selectCls}
              >
                <option value="approved">Approved</option>
                <option value="partially_approved">Partially approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
            <Field label="Approved amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={approvedAmount}
                onChange={(event) => setApprovedAmount(event.target.value)}
                disabled={decision === "rejected"}
              />
            </Field>
            <Field label="Patient copay">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={patientCopay}
                onChange={(event) => setPatientCopay(event.target.value)}
                disabled={decision === "rejected"}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdjudicatingId("")}>
                Cancel
              </Button>
              <Button type="submit">Save decision</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
