import { PipelineView } from "@/components/PipelineView";
import { loadLoans, supabaseConfigured } from "@/lib/data";

export default async function PipelinePage() {
  const { loans, liveCount, liveError } = await loadLoans();
  return (
    <>
      {liveError ? (
        <div className="banner warn">Could not load live voice-agent leads from Supabase ({liveError}). Showing sample data only.</div>
      ) : supabaseConfigured() ? (
        <div className="banner">
          <span className="live-dot" /> {liveCount} live voice-agent lead{liveCount === 1 ? "" : "s"} from Supabase, plus sample files.
        </div>
      ) : (
        <div className="banner warn">Sample data only. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to show real voice-agent leads.</div>
      )}
      <PipelineView loans={loans} />
    </>
  );
}
