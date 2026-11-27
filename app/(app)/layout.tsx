import { WorkspaceProvider } from "@/components/Workspace";
import { Sidebar } from "@/components/Sidebar";
import { loadLoans } from "@/lib/data";
import { cookies } from "next/headers";
import { logout } from "../login/actions";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { loans } = await loadLoans();
  const session = await verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <WorkspaceProvider signedInAs={(session?.name as Role) ?? "Mark"}>
      <div className="shell">
        <Sidebar loanCount={loans.length} />
        <main className="main">
          <div className="banner" style={{ justifyContent: "space-between" }}>
            <span className="btn-row" style={{ gap: "8px 16px", alignItems: "center" }}>
              <span className="mono">Pilot · CA, TX, FL</span>
              <span>Voice (xAI agent), text and email. Every call announces recording</span>
              <span>A processor reads every outbound message</span>
              <span>Anything with a rate, APR, points, payment or lock needs Mark</span>
            </span>
            <form action={logout}>
              <button type="submit" className="btn link" style={{ minHeight: 32, padding: 0 }}>Sign out</button>
            </form>
          </div>
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
