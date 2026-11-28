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
          <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <VestaSwitch status={vesta} canUseProd={VESTA_PROD_ROLES.includes(session?.name ?? "")} />
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
