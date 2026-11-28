import { DraftQueue } from "@/components/DraftQueue";
import { loadLoans } from "@/lib/data";
import { buildDrafts } from "@/lib/drafts";

export default async function OutboundPage() {
  const { loans } = await loadLoans();
  const result = await buildDrafts(loans);
  const loanNames = Object.fromEntries(loans.map((l) => [l.id, l.name]));
  return <DraftQueue result={result} loanNames={loanNames} />;
}
