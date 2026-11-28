"use client";

import { useMemo, useState } from "react";
import type { VestaLoanDetail } from "@/lib/vesta/loan";

export function VestaDetails({ d }: { d: VestaLoanDetail }) {
  const [q, setQ] = useState("");
  const fields = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? d.allFields.filter((f) => f.label.toLowerCase().includes(s) || f.value.toLowerCase().includes(s)) : d.allFields;
  }, [q, d.allFields]);

  return (
    <div className="stack">
      {d.errors.length > 0 ? <div className="banner warn">Some Vesta data didn’t load: {d.errors.join(" · ")}</div> : null}

      <div className="grid-auto" style={{ ["--min" as string]: "300px" }}>
        {d.sections.map((s) => (
          <section key={s.title} className="card" style={{ gap: 6 }}>
            <h2>{s.title}</h2>
            {s.rows.map((r) => (
              <div key={r.label} className="line-item" style={{ gridTemplateColumns: "minmax(120px, 0.9fr) minmax(0, 1.1fr)", padding: "5px 0" }}>
                <span className="small muted">{r.label}</span>
                <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.value}</span>
              </div>
            ))}
          </section>
        ))}
      </div>

      {d.borrowers.length > 0 ? (
        <div className="grid-auto" style={{ ["--min" as string]: "300px" }}>
          {d.borrowers.map((b, i) => (
            <section key={i} className="card" style={{ gap: 6 }}>
              <h2>{b.name} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {i === 0 ? "Borrower" : "Co-borrower"}</span></h2>
              {b.rows.map((r) => (
                <div key={r.label} className="line-item" style={{ gridTemplateColumns: "minmax(120px, 0.9fr) minmax(0, 1.1fr)", padding: "5px 0" }}>
                  <span className="small muted">{r.label}</span>
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.value}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      <section className="card" style={{ gap: 0 }}>
        <h2 style={{ marginBottom: 8 }}>Conditions <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {d.conditions.filter((c) => c.status !== "Cleared").length} open of {d.conditions.length}</span></h2>
        {d.conditions.length === 0 ? <span className="muted">No conditions in Vesta.</span> : null}
        {d.conditions.map((c, i) => (
          <div key={i} className="line-item" style={{ gridTemplateColumns: "minmax(0, 1fr) 140px 130px", alignItems: "center" }}>
            <span className="cell-col">
              <span>{c.text}</span>
              <span className="small muted">{[c.timing, c.category, c.owner].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="small muted">{c.message ? "Has borrower message" : ""}</span>
            <span><span className={c.status === "Open" ? "pill waiting" : c.status === "Received" ? "pill info" : "pill ok"}>{c.status === "Received" ? "Ready to approve" : c.status}</span></span>
          </div>
        ))}
      </section>

      <div className="row-wrap">
        <section className="card" style={{ gap: 0, flex: "1 1 320px" }}>
          <h2 style={{ marginBottom: 8 }}>Documents <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {d.documents.length}</span></h2>
          {d.documents.length === 0 ? <span className="muted">No documents in Vesta.</span> : null}
          {d.documents.map((doc, i) => (
            <div key={i} className="line-item" style={{ gridTemplateColumns: "minmax(0, 1fr) 100px 90px", alignItems: "center" }}>
              <span>{doc.name}</span>
              <span className="small muted">{doc.uploaded}</span>
              <span><span className={doc.expired ? "pill attention" : doc.status === "Accepted" ? "pill ok" : "pill muted"}>{doc.expired ? "Expired" : doc.status}</span></span>
            </div>
          ))}
        </section>
        <section className="card" style={{ gap: 0, flex: "1 1 260px" }}>
          <h2 style={{ marginBottom: 8 }}>Stage history</h2>
          {d.stages.length === 0 ? <span className="muted">No stage history.</span> : null}
          {d.stages.map((s, i) => (
            <div key={i} className="line-item" style={{ gridTemplateColumns: "minmax(0, 1fr) 110px" }}>
              <span>{s.name}</span>
              <span className="small muted">{s.started}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ gap: 8 }}>
        <h2>Every field on this loan <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {d.allFields.length}</span></h2>
        <input className="input" type="search" placeholder="Search fields, e.g. appraisal, escrow, income" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search loan fields" />
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {fields.slice(0, 600).map((f) => (
            <div key={f.label} className="line-item" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", padding: "4px 0" }}>
              <span className="small mono" style={{ overflowWrap: "anywhere" }}>{f.label}</span>
              <span className="small" style={{ overflowWrap: "anywhere" }}>{f.value}</span>
            </div>
          ))}
          {fields.length > 600 ? <span className="small muted">Showing 600 of {fields.length}. Search to narrow it down.</span> : null}
        </div>
        <span className="small muted">Social Security numbers, dates of birth, account and routing numbers are never shown here.</span>
      </section>
    </div>
  );
}
