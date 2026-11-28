"use client";

import { useActionState } from "react";
import { setVestaEnv, type VestaEnvState } from "@/app/(app)/vesta-actions";
import type { VestaEnv, VestaStatus } from "@/lib/vesta/config";

export function VestaSwitch({ status, canUseProd }: { status: VestaStatus; canUseProd: boolean }) {
  const [state, action, pending] = useActionState<VestaEnvState, FormData>(setVestaEnv, { error: null });
  const current = status[status.env];
  const option = (env: VestaEnv, label: string) => {
    const disabled = pending || (env === "prod" && !canUseProd);
    return (
      <button
        type="submit"
        name="env"
        value={env}
        className={`vesta-opt ${env}`}
        aria-pressed={status.env === env}
        disabled={disabled || status.env === env}
        title={env === "prod" && !canUseProd ? "Only Mark can switch to PROD" : undefined}
        onClick={(e) => {
          if (env === "prod" && !window.confirm("Switch Vesta to PROD? Reads and writes will hit real loan files.")) e.preventDefault();
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div className={`vesta-bar ${status.env}`} role="region" aria-label="Vesta environment">
      <span className="mono vesta-label">Vesta</span>
      <form action={action} className="vesta-toggle">
        {option("beta", "BETA")}
        {option("prod", "PROD")}
      </form>
      <span className="small">
        {current.configured ? (
          <>{status.env.toUpperCase()} configured, API <span className="mono">v{status.apiVersion}</span></>
        ) : (
          <>Not configured. Add {status.env === "prod" ? "VESTA_PROD_API_URL and VESTA_PROD_API_TOKEN" : "VESTA_BETA_API_TOKEN"} in Netlify.</>
        )}
      </span>
      {status.env === "prod" && <span className="small" style={{ fontWeight: 700 }}>Live loan files. Changes are real.</span>}
      {state.error && <span className="small" role="status">{state.error}</span>}
    </div>
  );
}
