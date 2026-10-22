"use client";
import { useEffect, useState } from "react";
import {
  type ApplicationRecord,
  formatDate,
  formatTimestamp,
} from "@/lib/domain";
import {
  type DocumentRecord,
  DOCUMENT_SLOTS,
  documentLabel,
} from "@/lib/document-types";
import { request, StatusBadge } from "./ui";
export function DocumentUsageView({
  records,
  onOpen,
}: {
  records: ApplicationRecord[];
  onOpen: (a: ApplicationRecord) => void;
}) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    request<DocumentRecord[]>("/api/documents")
      .then((d) => {
        setDocs(d);
        const wanted = new URLSearchParams(
          window.location.hash.split("?")[1],
        ).get("document");
        setSelected(wanted || d[0]?.id || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const doc = docs.find((d) => d.id === selected);
  const used = records.filter(
    (a) =>
      DOCUMENT_SLOTS.some((s) => a[s.id] === selected) &&
      `${a.company} ${a.position}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KNOW EXACTLY WHAT YOU SENT</div>
          <h1>Document usage</h1>
          <p>
            Find the applications linked to each CV, letter, or transcript
            version.
          </p>
        </div>
        <a className="button" href="#documents">
          Document library
        </a>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading document versions…</p>
      ) : !docs.length ? (
        <section className="card feature-panel empty-inline">
          <h2>No document versions yet</h2>
          <p>
            Upload your first version in Documents, then select it when you add
            or edit an application.
          </p>
          <a className="button primary" href="#documents">
            Open Documents
          </a>
        </section>
      ) : (
        <>
          <section className="card feature-panel">
            <label className="field">
              Document version
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {documentLabel(d)}
                    {d.archived ? " · Archived" : ""}
                  </option>
                ))}
              </select>
            </label>
            {doc && (
              <div className="feature-row">
                <p className="muted">
                  {doc.kind} · Uploaded {formatTimestamp(doc.createdAt)}
                  {doc.archived
                    ? " · Archived, existing application links retained"
                    : ""}
                </p>
                <a
                  className="button"
                  download
                  href={`/api/documents/${doc.id}`}
                >
                  Download this version
                </a>
              </div>
            )}
          </section>
          <section className="card feature-panel">
            <div className="feature-row">
              <h2>Linked applications</h2>
              <label className="field">
                Search linked applications
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">
              Shows the version currently recorded for each application. Earlier
              changes remain in that application’s history.
            </p>
            <div className="feature-list">
              {used.length ? (
                used.map((a) => (
                  <article className="feature-row" key={a.id}>
                    <div>
                      <button className="text-link" onClick={() => onOpen(a)}>
                        {a.company} · {a.position}
                      </button>
                      <p className="muted">
                        Applied {formatDate(a.dateApplied)} ·{" "}
                        {DOCUMENT_SLOTS.filter((s) => a[s.id] === selected)
                          .map((s) => s.label)
                          .join(", ")}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </article>
                ))
              ) : (
                <p className="empty-inline">
                  {search
                    ? "No matching applications."
                    : "This version is not linked to an application yet."}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
