import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Empty, PageHeader } from "@/components/kit";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/patients/$id")({
  head: () => meta("Patient profile", "Patient profile — Amani Eye practice manager."),
  component: () => (
    <AppShell module="patients">
      <PageHeader title="Patient profile" />
      <Empty>This screen is coming next.</Empty>
    </AppShell>
  ),
});
