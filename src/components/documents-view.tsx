"use client";
import { useEffect, useId, useState } from "react";
import {
  Archive,
  Download,
  FileText,
  FolderOpen,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KINDS,
  DOCUMENT_SLOTS,
  MAX_DOCUMENT_BYTES,
  documentLabel,
  fileSize,
  type DocumentKind,
  type DocumentRecord,
} from "@/lib/document-types";
import {
  formatTimestamp,
  type ApplicationInput,
  type ApplicationRecord,
} from "@/lib/domain";
import { request } from "./ui";

export function DocumentUpload({
  onUploaded,
}: {
  onUploaded: (doc: DocumentRecord) => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [kind, setKind] = useState<DocumentKind>("CV");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inputKey, setInputKey] = useState(0);
  async function upload() {
    setError("");
    setSuccess("");
    if (!name.trim() || !version.trim() || !file) {
      setError("Enter a document name and version label, then choose a file.");
      return;
    }
    if (!file.size || file.size > MAX_DOCUMENT_BYTES) {
      setError("Choose a nonempty file no larger than 10 MB.");
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a PDF or Word DOCX file.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("version", version);
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Upload failed. Please try again.");
      onUploaded(body);
      setSuccess(`Uploaded ${body.name} · ${body.version}.`);
      setFile(undefined);
      setVersion("");
      setInputKey((key) => key + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="document-upload" aria-label="Upload a document version">
      <h2>
        <Upload size={18} aria-hidden="true" /> Upload a version
      </h2>
      <p className="muted small">
        Give each version a clear label. Previous uploads stay available.
      </p>
      <fieldset disabled={busy}>
        <div className="field">
          <label htmlFor={`${id}-kind`}>Document type</label>
          <select
            id={`${id}-kind`}
            value={kind}
            onChange={(e) => setKind(e.target.value as DocumentKind)}
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-name`}>Document name</label>
          <input
            id={`${id}-name`}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Software engineering CV"
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-version`}>Version label</label>
          <input
            id={`${id}-version`}
            maxLength={80}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. v2 · October 2026"
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-file`}>PDF or DOCX file</label>
          <input
            key={inputKey}
            id={`${id}-file`}
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={(e) => {
              setFile(e.target.files?.[0]);
              setError("");
            }}
            aria-describedby={`${id}-hint`}
          />
          <span id={`${id}-hint`} className="muted small">
            Up to 10 MB per file. Stored on this Mac.
          </span>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          type="button"
          disabled={busy}
          onClick={upload}
        >
          <Upload size={16} aria-hidden="true" />
          {busy ? "Uploading…" : "Upload version"}
        </button>
      </fieldset>
      {success && (
        <p className="document-success" role="status">
          {success}
        </p>
      )}
    </section>
  );
}

export function ApplicationDocuments({
  data,
  onChange,
  errors,
}: {
  data: ApplicationInput;
  onChange: (patch: Partial<ApplicationInput>) => void;
  errors: Record<string, string>;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setDocuments(await request<DocumentRecord[]>("/api/documents"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function uploaded(doc: DocumentRecord) {
    setDocuments((current) => [doc, ...current]);
    const slot = DOCUMENT_SLOTS.find((s) =>
      (s.kinds as readonly string[]).includes(doc.kind),
    )!;
    onChange({ [slot.id]: doc.id, [slot.snapshot]: documentLabel(doc) });
  }
  return (
    <section
      className="application-documents"
      aria-labelledby="application-documents-title"
    >
      <div className="document-section-heading">
        <h3 id="application-documents-title">Documents used</h3>
        <span className="muted small">Optional</span>
      </div>
      <p className="muted small">
        Select the exact versions you applied with. New uploads never change
        these selections.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <button type="button" className="text-link" onClick={load}>
            Retry loading documents
          </button>
        </div>
      )}
      <div className="document-selectors">
        {DOCUMENT_SLOTS.map((slot) => {
          const options = documents.filter(
            (doc) =>
              (slot.kinds as readonly string[]).includes(doc.kind) &&
              (!doc.archived || doc.id === data[slot.id]),
          );
          const selected = documents.find((doc) => doc.id === data[slot.id]);
          return (
            <div className="field" key={slot.id}>
              <label htmlFor={slot.id}>{slot.label}</label>
              <select
                id={slot.id}
                disabled={loading}
                value={data[slot.id]}
                aria-invalid={!!errors[slot.id]}
                aria-describedby={
                  errors[slot.id] ? `${slot.id}-error` : undefined
                }
                onChange={(e) => {
                  const doc = documents.find((d) => d.id === e.target.value);
                  onChange({
                    [slot.id]: e.target.value,
                    [slot.snapshot]: doc ? documentLabel(doc) : "",
                  });
                }}
              >
                <option value="">
                  {loading ? "Loading documents…" : "No file selected"}
                </option>
                {data[slot.id] && !selected && (
                  <option value={data[slot.id]}>
                    Unavailable version · choose another
                  </option>
                )}
                {options.map((doc) => (
                  <option value={doc.id} key={doc.id}>
                    {doc.name} · {doc.version}
                    {doc.archived ? " (archived)" : ""}
                  </option>
                ))}
              </select>
              {errors[slot.id] && (
                <span className="field-error" id={`${slot.id}-error`}>
                  {errors[slot.id]}
                </span>
              )}
              {selected && (
                <a
                  className="text-link small"
                  href={`/api/documents/${selected.id}`}
                  download
                >
                  <Download size={13} aria-hidden="true" />
                  {selected.fileName}
                </a>
              )}
              {!data[slot.id] && data[slot.snapshot] && (
                <span className="muted small">
                  Recorded filename: {data[slot.snapshot]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="text-link"
        aria-expanded={uploading}
        onClick={() => setUploading((v) => !v)}
      >
        <Upload size={15} aria-hidden="true" />
        {uploading ? "Close uploader" : "Upload a new version here"}
      </button>
      {uploading && <DocumentUpload onUploaded={uploaded} />}
    </section>
  );
}

export function DocumentsView({ records }: { records: ApplicationRecord[] }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState("");
  async function load() {
    setError("");
    setLoading(true);
    try {
      setDocuments(await request<DocumentRecord[]>("/api/documents"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function archive(doc: DocumentRecord) {
    setBusy(doc.id);
    setError("");
    try {
      const result = await request<DocumentRecord>(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: !doc.archived }),
      });
      setDocuments((current) =>
        current.map((d) => (d.id === doc.id ? result : d)),
      );
      setNotice(
        result.archived
          ? "Version archived. Applications that used it keep their file."
          : "Version restored and available to select.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const filtered = documents.filter(
    (doc) =>
      (archived || !doc.archived) &&
      (!kind || doc.kind === kind) &&
      `${doc.name} ${doc.version} ${doc.fileName}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREPARED FOR YOUR NEXT OPPORTUNITY</div>
          <h1>Documents</h1>
          <p>
            Your CVs, letters, and transcripts. Every version, in one place.
          </p>
        </div>
        <span className="document-local">
          <FolderOpen size={17} aria-hidden="true" /> Stored locally
        </span>
      </div>
      <div className="documents-layout">
        <div className="document-library">
          <div className="document-filters">
            <div className="field">
              <label htmlFor="document-search">Search documents</label>
              <input
                id="document-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, version, or filename"
              />
            </div>
            <div className="field">
              <label htmlFor="document-filter">Document type filter</label>
              <select
                id="document-filter"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">All document types</option>
                {DOCUMENT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <label className="document-archive-toggle">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />{" "}
              Show archived
            </label>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button className="text-link" onClick={load}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <p className="document-success" role="status">
              {notice}
            </p>
          )}
          {loading ? (
            <p role="status" className="muted">
              Loading your documents…
            </p>
          ) : filtered.length ? (
            <div className="document-list">
              {filtered.map((doc) => {
                const used = records.filter((a) =>
                  DOCUMENT_SLOTS.some((slot) => a[slot.id] === doc.id),
                ).length;
                return (
                  <article
                    className="card document-card"
                    key={doc.id}
                    aria-label={`${doc.name} ${doc.version}`}
                  >
                    <div className="document-file-icon">
                      <FileText size={22} aria-hidden="true" />
                    </div>
                    <div className="document-card-info">
                      <div className="document-card-title">
                        <h2>{doc.name}</h2>
                        <span className="document-version">{doc.version}</span>
                      </div>
                      <p>
                        {doc.kind} · {doc.fileName} · {fileSize(doc.size)}
                      </p>
                      <span className="muted small">
                        Uploaded {formatTimestamp(doc.createdAt)}
                        {used
                          ? ` · Used in ${used} application${used === 1 ? "" : "s"}`
                          : ""}
                        {doc.archived ? " · Archived" : ""}
                      </span>
                    </div>
                    <div className="document-card-actions">
                      <a
                        className="button"
                        href={`/api/documents/${doc.id}`}
                        download
                        aria-label={`Download ${doc.name} ${doc.version}`}
                      >
                        <Download size={15} aria-hidden="true" />
                        Download
                      </a>
                      <button
                        className="button subtle"
                        disabled={busy === doc.id}
                        onClick={() => archive(doc)}
                        aria-label={`${doc.archived ? "Restore" : "Archive"} ${doc.name} ${doc.version}`}
                      >
                        {doc.archived ? (
                          <RotateCcw size={15} aria-hidden="true" />
                        ) : (
                          <Archive size={15} aria-hidden="true" />
                        )}
                        {busy === doc.id
                          ? "Saving…"
                          : doc.archived
                            ? "Restore"
                            : "Archive"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card document-empty">
              <FolderOpen size={34} aria-hidden="true" />
              <h2>
                {documents.length
                  ? "No matching documents"
                  : "Your application toolkit starts here"}
              </h2>
              <p>
                {documents.length
                  ? "Try another search or show archived versions."
                  : "Upload your first CV, letter, or transcript. Choose its version when you add an application."}
              </p>
            </div>
          )}
        </div>
        <aside
          className="card document-upload-card"
          aria-label="Upload and version guidance"
        >
          <DocumentUpload
            onUploaded={(doc) => {
              setDocuments((current) => [doc, ...current]);
              setSearch("");
              setKind("");
            }}
          />
          <p className="document-retention muted small">
            Each upload is a separate version. Archive older versions to tidy
            your library; applications keep access to the originals.
          </p>
        </aside>
      </div>
    </>
  );
}
