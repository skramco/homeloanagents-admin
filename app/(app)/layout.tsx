import { WorkspaceProvider } from "@/components/Workspace";
import { Sidebar } from "@/components/Sidebar";
import { loadLoans } from "@/lib/data";
import { cookies } from "next/headers";
import { logout } from "../login/actions";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";
import type { Role } from "@/lib/types";
import { VestaSwitch } from "@/components/VestaSwitch";
import { VESTA_PROD_ROLES, vestaStatus } from "@/lib/vesta/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { loans } = await loadLoans();
  const session = await verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  const vesta = await vestaStatus();
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
          <VestaSwitch status={vesta} canUseProd={VESTA_PROD_ROLES.includes(session?.name ?? "")} />
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
