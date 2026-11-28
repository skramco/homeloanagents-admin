/** Shown while a server page loads (Vesta, Gmail, Twilio and Grok can take several seconds). */
export function Loading({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      <div className="card" style={{ gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <span className="spinner" aria-hidden="true" />
          Loading…
        </span>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <span className="small muted">This can take up to a minute the first time each day while the loan files load. After that it’s quicker.</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skeleton" style={{ height: 120 }} />
      ))}
    </div>
  );
}
