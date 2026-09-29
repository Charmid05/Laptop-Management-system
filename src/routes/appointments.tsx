import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Empty, PageHeader } from "@/components/kit";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/appointments")({
  head: () => meta("Appointments", "Appointments — Amani Eye practice manager."),
  component: () => (
    <AppShell module="appointments">
      <PageHeader title="Appointments" />
      <Empty>This screen is coming next.</Empty>
    </AppShell>
  ),
});
