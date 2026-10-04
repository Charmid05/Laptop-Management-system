import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel, Field, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";
import { useDB, saveSettings } from "@/services/store";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Wallet,
  Laptop,
  Plus,
  Trash2,
  Tags,
  Settings2,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings", "Laptop store settings."),
  component: () => (
    <AppShell module="settings">
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const db = useDB();
  const [loading, setLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [brandInput, setBrandInput] = useState("");

  const [storeSettings, setStoreSettings] = useState(() => ({ ...db.settings }));

  const addProductCategory = async () => {
    const value = categoryInput.trim();
    if (!value) return;
    if (storeSettings.productCategories.includes(value)) {
      setCategoryInput("");
      return;
    }
    const next = [...(storeSettings.productCategories ?? []), value];
    const updated = { ...storeSettings, productCategories: next };
    setStoreSettings(updated);
    setCategoryInput("");
    try {
      await saveSettings({ productCategories: next });
      toast.success("Category added");
    } catch (error) {
      toast.error("Failed to add category");
      console.error(error);
    }
  };

  const removeProductCategory = async (value: string) => {
    const next = (storeSettings.productCategories ?? []).filter((item) => item !== value);
    const updated = { ...storeSettings, productCategories: next };
    setStoreSettings(updated);
    try {
      await saveSettings({ productCategories: next });
      toast.success("Category removed");
    } catch (error) {
      toast.error("Failed to remove category");
      console.error(error);
    }
  };

  const addProductBrand = async () => {
    const value = brandInput.trim();
    if (!value) return;
    if (storeSettings.productBrands.includes(value)) {
      setBrandInput("");
      return;
    }
    const next = [...(storeSettings.productBrands ?? []), value];
    const updated = { ...storeSettings, productBrands: next };
    setStoreSettings(updated);
    setBrandInput("");
    try {
      await saveSettings({ productBrands: next });
      toast.success("Brand added");
    } catch (error) {
      toast.error("Failed to add brand");
      console.error(error);
    }
  };

  const removeProductBrand = async (value: string) => {
    const next = (storeSettings.productBrands ?? []).filter((item) => item !== value);
    const updated = { ...storeSettings, productBrands: next };
    setStoreSettings(updated);
    try {
      await saveSettings({ productBrands: next });
      toast.success("Brand removed");
    } catch (error) {
      toast.error("Failed to remove brand");
      console.error(error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveSettings(storeSettings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStoreSettings({ ...db.settings });
    toast.info("Settings reset to current values");
  };

  return (
    <div className="settings-page space-y-5">
      <section className="settings-hero">
        <div className="settings-hero-content">
          <div className="settings-eyebrow">
            <span className="settings-eyebrow-icon">
              <Settings2 className="size-4" />
            </span>
            STORE CONFIGURATION
          </div>
          <h1>Settings</h1>
          <p>Configure store details, catalog, tax, and document numbering.</p>
          <div className="settings-hero-meta">
            <span>
              <Building2 className="size-3.5" /> {storeSettings.storeName || "Your store"}
            </span>
            <span className="settings-meta-divider" />
            <span>
              <Wallet className="size-3.5" /> {storeSettings.currency} · {storeSettings.taxRate}%
              tax
            </span>
          </div>
        </div>
        <div className="settings-hero-art" aria-hidden="true">
          <div className="settings-art-ring settings-art-ring-one" />
          <div className="settings-art-ring settings-art-ring-two" />
          <span>
            <Settings2 className="size-10" />
          </span>
        </div>
        <div className="settings-hero-actions">
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="settings-save-button rounded-full"
          >
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </section>

      <Tabs defaultValue="general" className="settings-tabs space-y-5">
        <TabsList className="settings-tabs-list">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="prefixes">Numbering</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Panel title="Store information" className="settings-panel">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Store name">
                    <Input
                      value={storeSettings.storeName}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, storeName: e.target.value })
                      }
                      placeholder="Laptop Store"
                    />
                  </Field>
                  <Field label="Tagline">
                    <Input
                      value={storeSettings.tagline}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, tagline: e.target.value })
                      }
                      placeholder="Laptops and accessories"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Address">
                    <Textarea
                      value={storeSettings.address}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, address: e.target.value })
                      }
                      rows={2}
                      placeholder="Street address, building, floor"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="County">
                      <Input
                        value={storeSettings.county}
                        onChange={(e) =>
                          setStoreSettings({ ...storeSettings, county: e.target.value })
                        }
                        placeholder="Nairobi"
                      />
                    </Field>
                    <Field label="Town">
                      <Input
                        value={storeSettings.town}
                        onChange={(e) =>
                          setStoreSettings({ ...storeSettings, town: e.target.value })
                        }
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
                      value={storeSettings.phone}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, phone: e.target.value })
                      }
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
                      value={storeSettings.email}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, email: e.target.value })
                      }
                      placeholder="info@amanieye.co.ke"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <Panel title="Product catalog defaults" className="settings-panel">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tags className="size-4 text-muted-foreground" />
                  Categories
                </div>
                <div className="flex gap-2">
                  <Input
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="Add category"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addProductCategory();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => void addProductCategory()}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(storeSettings.productCategories ?? []).map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm"
                    >
                      {value}
                      <button
                        type="button"
                        aria-label={`Remove ${value}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => void removeProductCategory(value)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Laptop className="size-4 text-muted-foreground" />
                  Brands
                </div>
                <div className="flex gap-2">
                  <Input
                    value={brandInput}
                    onChange={(e) => setBrandInput(e.target.value)}
                    placeholder="Add brand"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addProductBrand();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => void addProductBrand()}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(storeSettings.productBrands ?? []).map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm"
                    >
                      {value}
                      <button
                        type="button"
                        aria-label={`Remove ${value}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => void removeProductBrand(value)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Panel title="Currency and tax" className="settings-panel">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Wallet className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Currency">
                    <Input
                      value={storeSettings.currency}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, currency: e.target.value })
                      }
                      placeholder="KES"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tax rate (%)">
                      <Input
                        type="number"
                        value={storeSettings.taxRate}
                        onChange={(e) =>
                          setStoreSettings({
                            ...storeSettings,
                            taxRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </Field>
                    <Field label="Tax label">
                      <Input
                        value={storeSettings.taxLabel}
                        onChange={(e) =>
                          setStoreSettings({ ...storeSettings, taxLabel: e.target.value })
                        }
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
          <Panel title="Document numbering" className="settings-panel">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Invoice prefix">
                    <Input
                      value={storeSettings.invoicePrefix}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, invoicePrefix: e.target.value })
                      }
                      placeholder="INV-"
                    />
                  </Field>
                  <Field label="Receipt prefix">
                    <Input
                      value={storeSettings.receiptPrefix}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, receiptPrefix: e.target.value })
                      }
                      placeholder="RCP-"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="legal" className="space-y-4">
          <Panel title="Legal information" className="settings-panel">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Laptop className="size-5 mt-1 text-muted-foreground" />
                <div className="flex-1 space-y-4">
                  <Field label="Business registration number">
                    <Input
                      value={storeSettings.registrationNumber}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, registrationNumber: e.target.value })
                      }
                      placeholder="BN/2023/123456"
                    />
                  </Field>
                  <Field label="KRA PIN">
                    <Input
                      value={storeSettings.kraPin}
                      onChange={(e) =>
                        setStoreSettings({ ...storeSettings, kraPin: e.target.value })
                      }
                      placeholder="A000000000Z"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
