import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Empty, PageHeader } from "@/components/kit";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/patients/new")({
  head: () => meta("Register patient", "Register patient — Amani Eye practice manager."),
  component: () => (
    <AppShell module="patients">
      <PageHeader title="Register patient" />
      <Empty>This screen is coming next.</Empty>
    </AppShell>
  ),
});
