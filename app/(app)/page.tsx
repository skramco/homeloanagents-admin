import { PipelineView } from "@/components/PipelineView";
import { loadLoans, supabaseConfigured } from "@/lib/data";
import { loadSavedReviews } from "@/lib/reviews";

export default async function PipelinePage() {
  const { loans, liveCount, liveError, vesta } = await loadLoans();
  const env = vesta.env.toUpperCase();
  const saved = await loadSavedReviews([]);
  return (
    <>
      {vesta.error ? (
        <div className="banner warn">No Vesta loans: {vesta.error}</div>
      ) : (
        <div className="banner">
          <span className="live-dot" /> {vesta.loans.length}
          {vesta.total !== null && vesta.total > vesta.loans.length ? ` of ${vesta.total}` : ""} loan file{vesta.loans.length === 1 ? "" : "s"} from Vesta {env}.
        </div>
      )}
      {liveError ? (
        <div className="banner warn">Could not load voice-agent leads from Supabase ({liveError}).</div>
      ) : supabaseConfigured() ? (
        <div className="banner">
          <span className="live-dot" /> {liveCount} voice-agent lead{liveCount === 1 ? "" : "s"} from Supabase.
        </div>
      ) : (
        <div className="banner warn">Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to show voice-agent leads.</div>
      )}
      <PipelineView loans={loans} reviewedCount={saved.available ? Object.values(saved.tallies).reduce((n, t) => n + t.approved + t.edited + t.rejected, 0) : null} />
      {vesta.columns.length > 0 ? (
        <details className="small muted">
          <summary>Columns in this Vesta view ({vesta.columns.length})</summary>
          <p>{vesta.columns.join(" · ")}</p>
        </details>
      ) : null}
    </>
  );
}
