"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";

/**
 * v0 working state. Actions (approve, send, resolve, pause) are kept in this
 * browser's localStorage so you can click around. Nothing is sent anywhere yet.
 * When the events table and bot gateway exist, these become server actions.
 */

export type SentMessage = { when: string; channel: string; who: string; text: string };
export type ChatMessage = { from: "me" | "bot"; text: string };

type State = {
  role: Role;
  done: Record<string, string>;
  edited: number;
  paused: Record<string, boolean>;
  sent: Record<string, SentMessage[]>;
  chats: Record<string, ChatMessage[]>;
};

const DEFAULT: State = { role: "Mark", done: {}, edited: 0, paused: {}, sent: {}, chats: {} };
const KEY = "hla-loan-manager:v0";

type Ctx = State & {
  setRole: (r: Role) => void;
  close: (id: string, outcome: string, opts?: { edited?: boolean }) => void;
  togglePause: (bot: string) => void;
  addSent: (loanId: string, m: SentMessage) => void;
  addChat: (key: string, msgs: ChatMessage[]) => void;
  reset: () => void;
  toast: string;
  flash: (msg: string) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children, signedInAs }: { children: ReactNode; signedInAs: Role }) {
  const [state, setState] = useState<State>({ ...DEFAULT, role: signedInAs });
  const [toast, setToast] = useState("");
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      // The signed-in person is the default view; the switch is for previewing other roles.
      if (raw) setState({ ...DEFAULT, ...JSON.parse(raw), role: signedInAs });
    } catch {
      /* storage blocked: run with defaults */
    }
    loaded.current = true;
  }, [signedInAs]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      toast,
      flash,
      setRole: (role) => setState((s) => ({ ...s, role })),
      close: (id, outcome, opts) => {
        setState((s) => ({ ...s, done: { ...s.done, [id]: outcome }, edited: s.edited + (opts?.edited ? 1 : 0) }));
        flash(outcome);
      },
      togglePause: (bot) => setState((s) => ({ ...s, paused: { ...s.paused, [bot]: !s.paused[bot] } })),
      addSent: (loanId, m) => setState((s) => ({ ...s, sent: { ...s.sent, [loanId]: [m, ...(s.sent[loanId] ?? [])] } })),
      addChat: (key, msgs) => setState((s) => ({ ...s, chats: { ...s.chats, [key]: [...(s.chats[key] ?? []), ...msgs] } })),
      reset: () => {
        setState({ ...DEFAULT, role: signedInAs });
        flash("Demo state reset");
      },
    }),
    [state, toast, flash, signedInAs],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {toast ? (
        <div role="status" className="toast">
          {toast}
        </div>
      ) : null}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
