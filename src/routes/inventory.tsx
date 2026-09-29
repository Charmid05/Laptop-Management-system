import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Empty, PageHeader } from "@/components/kit";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/inventory")({
  head: () => meta("Inventory", "Inventory — Amani Eye practice manager."),
  component: () => (
    <AppShell module="inventory">
      <PageHeader title="Inventory" />
      <Empty>This screen is coming next.</Empty>
    </AppShell>
  ),
});
