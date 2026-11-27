import { BotsView } from "@/components/QueueViews";
import { loadLoans } from "@/lib/data";

export default async function BotsPage() {
  const { loans } = await loadLoans();
  return <BotsView loans={loans} />;
}
