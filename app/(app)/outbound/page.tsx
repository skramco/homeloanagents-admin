import { OutboundView } from "@/components/QueueViews";
import { loadLoans } from "@/lib/data";
import { indexLoans } from "@/lib/loan-index";

export default async function OutboundPage() {
  const { loans } = await loadLoans();
  return <OutboundView loans={indexLoans(loans)} />;
}
