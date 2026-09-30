import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, Field, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";
import { useDB, saveSettings } from "@/services/store";
import { toast } from "sonner";
import { Building2, MapPin, Phone, Mail, FileText, Wallet, Eye } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings", "Practice settings — Amani Eye practice manager."),
  component: () => <AppShell module="settings"><Settings /></AppShell>,
});

function Settings() {
  const db = useDB();
  const [loading, setLoading] = useState(false);

  const [practiceSettings, setPracticeSettings] = useState({
    practiceName: db.settings.practiceName,
    tagline: db.settings.tagline,
    address: db.settings.address,
    county: db.settings.county,
    town: db.settings.town,
    phone: db.settings.phone,
    email: db.settings.email,
    currency: db.settings.currency,
    taxRate: db.settings.taxRate,
    taxLabel: db.settings.taxLabel,
    invoicePrefix: db.settings.invoicePrefix,
    receiptPrefix: db.settings.receiptPrefix,
    prescriptionPrefix: db.settings.prescriptionPrefix,
    registrationNumber: db.settings.registrationNumber,
    kraPin: db.settings.kraPin,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveSettings(practiceSettings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPracticeSettings(db.settings);
    toast.info("Settings reset to current values");
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure your practice information and preferences"
        actions={
          <>
            <Button variant="outline" onClick={handleReset} disabled={loading}>Reset</Button>
            <Button onClick={handleSave} disabled={loading} className="rounded-full">
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </>
        }
      />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="prefixes">Numbering</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Panel title="Practice information">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Practice name">
                    <Input
                      value={practiceSettings.practiceName}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, practiceName: e.target.value })}
                      placeholder="Amani Eye Centre"
                    />
                  </Field>
                  <Field label="Tagline">
                    <Input
                      value={practiceSettings.tagline}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, tagline: e.target.value })}
                      placeholder="Clear sight, cared for"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Address">
                    <Textarea
                      value={practiceSettings.address}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, address: e.target.value })}
                      rows={2}
                      placeholder="Street address, building, floor"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="County">
                      <Input
                        value={practiceSettings.county}
                        onChange={(e) => setPracticeSettings({ ...practiceSettings, county: e.target.value })}
                        placeholder="Nairobi"
                      />
                    </Field>
                    <Field label="Town">
                      <Input
                        value={practiceSettings.town}
                        onChange={(e) => setPracticeSettings({ ...practiceSettings, town: e.target.value })}
                        placeholder="Westlands"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <Field label="Phone">
                    <Input
                      value={practiceSettings.phone}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, phone: e.target.value })}
                      placeholder="+254 700 000 000"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <Field label="Email">
                    <Input
                      type="email"
                      value={practiceSettings.email}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, email: e.target.value })}
                      placeholder="info@amanieye.co.ke"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Panel title="Currency and tax">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Wallet className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Currency">
                    <Input
                      value={practiceSettings.currency}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, currency: e.target.value })}
                      placeholder="KES"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tax rate (%)">
                      <Input
                        type="number"
                        value={practiceSettings.taxRate}
                        onChange={(e) => setPracticeSettings({ ...practiceSettings, taxRate: parseFloat(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </Field>
                    <Field label="Tax label">
                      <Input
                        value={practiceSettings.taxLabel}
                        onChange={(e) => setPracticeSettings({ ...practiceSettings, taxLabel: e.target.value })}
                        placeholder="VAT"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="prefixes" className="space-y-4">
          <Panel title="Document numbering">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Invoice prefix">
                    <Input
                      value={practiceSettings.invoicePrefix}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, invoicePrefix: e.target.value })}
                      placeholder="INV-"
                    />
                  </Field>
                  <Field label="Receipt prefix">
                    <Input
                      value={practiceSettings.receiptPrefix}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, receiptPrefix: e.target.value })}
                      placeholder="RCP-"
                    />
                  </Field>
                  <Field label="Prescription prefix">
                    <Input
                      value={practiceSettings.prescriptionPrefix}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, prescriptionPrefix: e.target.value })}
                      placeholder="RX-"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="legal" className="space-y-4">
          <Panel title="Legal information">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Eye className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Business registration number">
                    <Input
                      value={practiceSettings.registrationNumber}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, registrationNumber: e.target.value })}
                      placeholder="BN/2023/123456"
                    />
                  </Field>
                  <Field label="KRA PIN">
                    <Input
                      value={practiceSettings.kraPin}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, kraPin: e.target.value })}
                      placeholder="A000000000Z"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
