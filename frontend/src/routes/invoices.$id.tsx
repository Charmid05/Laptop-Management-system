import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { meta } from "@/lib/meta";
import { InvoiceDetail } from "./invoices";

export const Route = createFileRoute("/invoices/$id")({
  head: () => meta("Sale details", "Laptop sale details and payment history."),
  component: InvoiceDetailsPage,
});

function InvoiceDetailsPage() {
  const { id } = Route.useParams();
  return (
    <AppShell module="invoices">
      <InvoiceDetail id={id} />
    </AppShell>
  );
}
