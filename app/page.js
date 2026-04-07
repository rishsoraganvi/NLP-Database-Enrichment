"use client";
import { useState } from "react";
import styles from "./page.module.css";

const SAMPLE_PROMPTS = [
  "Find 3 fast-growing SaaS companies in the US with 50–500 employees, raising Series B or later.",
  "Give me 3 VPs of Sales in European fintech startups with more than 100 employees.",
  "Top AI infrastructure companies hiring machine learning engineers in India.",
  "3 marketing leaders at e-commerce brands in North America doing more than $50M in revenue.",
  "Cybersecurity firms with increasing web traffic and at least 200 employees.",
];

function JsonModal({ data, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>Raw JSON</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <pre className={styles.jsonPre}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function CompanyRow({ result, onViewJson }) {
  return (
    <tr className={styles.tr}>
      <td className={styles.td}>
        <div className={styles.nameCell}>
          <span className={styles.entityName}>{result.name || "—"}</span>
          {result.domain && <a href={`https://${result.domain}`} target="_blank" rel="noreferrer" className={styles.domainLink}>{result.domain}</a>}
        </div>
      </td>
      <td className={styles.td}>{result.industry || "—"}</td>
      <td className={styles.td}>{result.employee_count ?? "—"}</td>
      <td className={styles.td}>{result.revenue || "—"}</td>
      <td className={styles.td}>{result.country || "—"}</td>
      <td className={styles.td}>
        {result.linkedin_url
          ? <a href={result.linkedin_url} target="_blank" rel="noreferrer" className={styles.link}>LinkedIn ↗</a>
          : "—"}
      </td>
      <td className={styles.td}>
        <button className={styles.jsonBtn} onClick={() => onViewJson(result.raw || result)}>JSON</button>
      </td>
    </tr>
  );
}

function ProspectRow({ result, onViewJson }) {
  return (
    <tr className={styles.tr}>
      <td className={styles.td}>
        <div className={styles.nameCell}>
          <span className={styles.entityName}>{result.name || "—"}</span>
          <span className={styles.subtitle}>{result.title || ""}</span>
        </div>
      </td>
      <td className={styles.td}>{result.company || "—"}</td>
      <td className={styles.td}>{result.email || "—"}</td>
      <td className={styles.td}>{result.country || "—"}</td>
      <td className={styles.td}>
        {result.linkedin_url
          ? <a href={result.linkedin_url} target="_blank" rel="noreferrer" className={styles.link}>LinkedIn ↗</a>
          : "—"}
      </td>
      <td className={styles.td}>
        <button className={styles.jsonBtn} onClick={() => onViewJson(result.raw || result)}>JSON</button>
      </td>
    </tr>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  const entityType = results?.[0]?.type || null;
  const isCompany = entityType === "company";

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>OutMate</span>
        </div>
        <h1 className={styles.title}>NLP Enrichment Demo</h1>
        <p className={styles.subtitle}>Type a natural language prompt. We'll find and enrich up to <strong>3 matching records</strong> from the Explorium B2B database.</p>
      </header>

      {/* Prompt Section */}
      <section className={styles.card}>
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="prompt-input">Your prompt</label>
          <textarea
            id="prompt-input"
            className={styles.textarea}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. Find 3 fast-growing SaaS companies in the US with 50–500 employees..."
            rows={3}
            disabled={loading}
          />

          {/* Sample prompts */}
          <div className={styles.samples}>
            <span className={styles.samplesLabel}>Try an example:</span>
            <div className={styles.chips}>
              {SAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.chip}
                  onClick={() => setPrompt(p)}
                  disabled={loading}
                >
                  {p.length > 55 ? p.slice(0, 55) + "…" : p}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formFooter}>
            <span className={styles.limitNote}>⚡ Returns max 3 enriched records per search</span>
            <div className={styles.actions}>
              {results !== null && (
                <button type="button" className={styles.clearBtn} onClick={() => { setResults(null); setPrompt(""); setError(null); }} disabled={loading}>
                  Clear
                </button>
              )}
              <button type="submit" className={styles.submitBtn} disabled={loading || !prompt.trim()} id="search-btn">
                {loading ? <><span className={styles.spinner} /> Searching…</> : "Search & Enrich"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Error */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorIcon}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <section className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              {results.length === 0
                ? "No results found"
                : `${results.length} result${results.length !== 1 ? "s" : ""} · ${entityType === "prospect" ? "Prospects" : "Companies"}`}
            </h2>
          </div>

          {results.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>No matching records found. Try adjusting your prompt — be more specific about industry, location, or company size.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {isCompany
                      ? ["Name / Domain", "Industry", "Employees", "Revenue", "Country", "LinkedIn", ""].map(h => <th key={h} className={styles.th}>{h}</th>)
                      : ["Name / Title", "Company", "Email", "Country", "LinkedIn", ""].map(h => <th key={h} className={styles.th}>{h}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) =>
                    r.type === "prospect"
                      ? <ProspectRow key={i} result={r} onViewJson={setModalData} />
                      : <CompanyRow key={i} result={r} onViewJson={setModalData} />
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modalData && <JsonModal data={modalData} onClose={() => setModalData(null)} />}
    </main>
  );
}
