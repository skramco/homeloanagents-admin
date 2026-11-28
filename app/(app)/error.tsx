"use client";

/** Shown instead of a blank "Application error" page when something on a page throws. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Something went wrong</h1>
      </header>
      <div className="banner warn">
        {error.message || "This page hit an error."} {error.digest ? `(ref ${error.digest})` : ""}
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => reset()}>Try again</button>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    </div>
  );
}
