import { ApprovalsView } from "@/components/QueueViews";
import { loadLoans } from "@/lib/data";
import { indexLoans } from "@/lib/loan-index";

export default async function ApprovalsPage() {
  const { loans } = await loadLoans();
  return <ApprovalsView loans={indexLoans(loans)} />;
}
