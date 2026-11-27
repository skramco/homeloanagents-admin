import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · HLA Loan Manager" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--emerald-900)", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 28, gap: 18 }}>
        <div className="btn-row" style={{ alignItems: "center", gap: 12 }}>
          <Image src="/brand/homeloanagents-icon-color.svg" alt="" width={40} height={40} priority />
          <div className="cell-col">
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.022em" }}>
              HomeLoan<span style={{ color: "var(--accent)" }}>Agents</span>
            </span>
            <span className="serif" style={{ color: "var(--emerald-700)" }}>Loan Manager</span>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Internal tool for the HomeLoanAgents team. Authorized users only.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
