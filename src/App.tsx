import React, { useEffect, useState } from "react";
import { validateInvoiceSheet, type ValidationReport } from "./engine/sheetValidator";
import { loadDraftSnapshot, saveDraftSnapshot } from "./storage/draftDb";

function buildDemoCsv(rowCount: number = 5000): string {
  const lines = ["externalId,customerEmail,amountUsd,seatCount"];
  for (let i = 1; i <= rowCount; i++) {
    if (i === 42) {
      lines.push(`inv_0001,duplicate@acme.io,49.00,5`); // duplicate ID
    } else if (i === 318) {
      lines.push(`inv_${String(i).padStart(4, "0")},broken-email,199.00,10`);
    } else if (i === 1904) {
      lines.push(`inv_${String(i).padStart(4, "0")},ops@globex.com,$1200,8`); // '$' string
    } else {
      lines.push(`inv_${String(i).padStart(4, "0")},billing${i}@company.com,99.00,12`);
    }
  }
  return lines.join("\n");
}

export default function App() {
  const [csvText, setCsvText] = useState(() => buildDemoCsv(5000));
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [draftStatus, setDraftStatus] = useState<string>("Checking IndexedDB...");

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    loadDraftSnapshot("current").then((saved) => {
      if (saved) {
        setCsvText(saved.rawCsv);
        setDraftStatus(`Restored IndexedDB snapshot from ${saved.savedAtIso}`);
      } else {
        setDraftStatus("No prior draft in IndexedDB (loaded 5,000-row sample)");
      }
    });

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const res = validateInvoiceSheet(csvText);
    setReport(res);
  }, [csvText]);

  const handlePersistDraft = async () => {
    const savedAtIso = new Date().toISOString();
    await saveDraftSnapshot({
      id: "current",
      rawCsv: csvText,
      uploadedChunkIndex: 0,
      savedAtIso,
    });
    setDraftStatus(`Saved ${(csvText.length / 1024).toFixed(1)} KB draft to IndexedDB at ${savedAtIso}`);
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.55rem" }}>
          Offline-First CSV Validator &amp; IndexedDB Draft Guard
        </h1>
        <p style={{ margin: 0, color: "#94a3b8" }}>
          Network:{" "}
          <strong style={{ color: isOnline ? "#4ade80" : "#f87171" }}>
            {isOnline ? "ONLINE" : "OFFLINE (Drafts Safe in IndexedDB)"}
          </strong>{" "}
          &middot; {draftStatus}
        </p>
      </header>

      {report && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ background: "#1e293b", padding: "0.9rem", borderRadius: 8 }}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Rows Checked</div>
            <strong style={{ fontSize: "1.3rem" }}>{report.totalRows.toLocaleString()}</strong>
          </div>
          <div style={{ background: "#1e293b", padding: "0.9rem", borderRadius: 8 }}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Validation Time</div>
            <strong style={{ fontSize: "1.3rem", color: "#38bdf8" }}>{report.elapsedMs} ms</strong>
          </div>
          <div style={{ background: "#1e293b", padding: "0.9rem", borderRadius: 8 }}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Cell Errors Caught</div>
            <strong style={{ fontSize: "1.3rem", color: report.issues.length ? "#f87171" : "#4ade80" }}>
              {report.issues.length}
            </strong>
          </div>
          <div style={{ background: "#1e293b", padding: "0.9rem", borderRadius: 8 }}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Wasted Upload Saved</div>
            <strong style={{ fontSize: "1.3rem", color: "#fbbf24" }}>
              {(report.bytesAvoidedOnFailure / 1024).toFixed(1)} KB
            </strong>
          </div>
        </section>
      )}

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem" }}>
        <button
          onClick={handlePersistDraft}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Save Snapshot to IndexedDB
        </button>
      </div>

      {report && report.issues.length > 0 && (
        <section style={{ background: "#1e293b", padding: "1rem", borderRadius: 8, marginBottom: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", color: "#f87171" }}>
            Blocked Before Upload — Exact Row &amp; Column Diagnostics
          </h2>
          {report.issues.slice(0, 10).map((iss, idx) => (
            <div
              key={idx}
              style={{
                padding: "0.45rem 0",
                borderBottom: "1px solid #334155",
                fontSize: "0.9rem",
              }}
            >
              <strong>Row {iss.rowNumber}</strong> &middot; <code>{iss.column}</code> ={" "}
              <code>"{iss.value}"</code> &rarr; {iss.message} (<code>{iss.code}</code>)
            </div>
          ))}
        </section>
      )}

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={10}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "monospace",
          fontSize: "0.85rem",
          background: "#020617",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "0.75rem",
        }}
      />
    </main>
  );
}
