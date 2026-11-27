import { EscalationsView } from "@/components/QueueViews";
import { loadLoans } from "@/lib/data";
import { indexLoans } from "@/lib/loan-index";

export default async function EscalationsPage() {
  const { loans } = await loadLoans();
  return <EscalationsView loans={indexLoans(loans)} />;
}
