"use client";

import { useActionState, useEffect } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  useEffect(() => {
    if (state.next) window.location.assign(state.next);
  }, [state.next]);
  return (
    <form action={action} className="cell-col" style={{ gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <label className="cell-col small" style={{ gap: 4, fontWeight: 600 }}>
        Who are you?
        <select name="name" className="input" defaultValue="Mark">
          <option>Mark</option>
          <option>Processor 1</option>
          <option>Processor 2</option>
          <option>Lorinn</option>
        </select>
      </label>
      <label className="cell-col small" style={{ gap: 4, fontWeight: 600 }}>
        Password
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </label>
      {state.error ? <span role="alert" style={{ color: "#A3261B", fontSize: 13 }}>{state.error}</span> : null}
      <button type="submit" className="btn primary" disabled={pending || Boolean(state.next)} style={{ justifyContent: "center" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
