import { DraftQueue } from "@/components/DraftQueue";
import { loadLoans } from "@/lib/data";
import { loadSavedReviews } from "@/lib/reviews";
import { sendInfo } from "@/lib/send";
import { buildDrafts } from "@/lib/drafts";

export default async function OutboundPage() {
  const { loans } = await loadLoans();
  const result = await buildDrafts(loans);
  const saved = await loadSavedReviews(result.drafts.map((d) => d.id));
  const loanNames = Object.fromEntries(loans.map((l) => [l.id, l.name]));
  return <DraftQueue result={result} saved={saved} send={sendInfo()} loanNames={loanNames} />;
}
