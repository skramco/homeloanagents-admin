import { BotsView } from "@/components/QueueViews";
import { loadLoans } from "@/lib/data";
import { loadSavedReviews } from "@/lib/reviews";

export default async function BotsPage() {
  const { loans } = await loadLoans();
  const saved = await loadSavedReviews([]);
  return <BotsView loans={loans} tallies={saved.available ? saved.tallies : null} />;
}
