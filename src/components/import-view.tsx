"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  FileSpreadsheet,
  FolderOpen,
  Upload,
  X,
} from "lucide-react";
import {
  autoMapping,
  CSV_FIELDS,
  CSV_LABELS,
  parseCSV,
  type ColumnMapping,
  type ImportRow,
  type ParsedCSV,
} from "@/lib/csv";
import { request } from "./ui";
type Preview = { rows: ImportRow[]; accepted: number; skipped: number };
export function ImportView({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const [csv, setCsv] = useState("");
  const [name, setName] = useState("");
  const [parsed, setParsed] = useState<ParsedCSV>();
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<Preview>();
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  async function load(file?: File) {
    if (!file) return;
    setError("");
    setSuccess("");
    setPreview(undefined);
    setAllowDuplicates(false);
    if (file.size > 5_000_000) {
      setError("Choose a CSV smaller than 5 MB.");
      return;
    }
    const text = await file.text();
    const p = parseCSV(text);
    setCsv(text);
    setName(file.name);
    setParsed(p);
    setMapping(autoMapping(p.headers));
    if (p.errors.length) setError(p.errors.join(" "));
  }
  async function submit(previewOnly: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await request<Preview>("/api/import", {
        method: "POST",
        body: JSON.stringify({ csv, mapping, allowDuplicates, previewOnly }),
      });
      if (previewOnly) setPreview(result);
      else {
        setSuccess(
          `Imported ${result.accepted} application${result.accepted === 1 ? "" : "s"}. Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}.`,
        );
        setPreview(undefined);
        setParsed(undefined);
        setCsv("");
        await onImported();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BRING YOUR PROGRESS WITH YOU</div>
          <h1>Import & export</h1>
          <p>Move from a spreadsheet. Keep a copy of everything.</p>
        </div>
        <a className="button" href="/api/export" download>
          <ArrowDownToLine size={17} />
          Export all applications
        </a>
      </div>
      <div className="import-layout">
        <section className="card import-card">
          <header className="card-header">
            <div className="title-with-icon">
              <span className="heading-icon">
                <FileSpreadsheet size={20} />
              </span>
              <div>
                <h2>Import from a spreadsheet</h2>
                <p>A fresh workspace for the work you’ve already done.</p>
              </div>
            </div>
          </header>
          <div className="import-body">
            <ol className="import-steps">
              {["Choose a file", "Map columns", "Review & import"].map(
                (s, i) => (
                  <li
                    key={s}
                    className={
                      (preview ? 2 : parsed ? 1 : 0) >= i ? "current" : ""
                    }
                  >
                    <span>{i + 1}</span>
                    {s}
                  </li>
                ),
              )}
            </ol>
            {error && (
              <div role="alert" className="notice error">
                <CircleAlert size={17} />
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="notice success">
                <Check size={18} />
                {success}
              </div>
            )}
            {!parsed ? (
              <label
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void load(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-icon">
                  <Upload size={26} strokeWidth={1.5} />
                </span>
                <strong>Give your spreadsheet a new home</strong>
                <span>Choose a CSV file, or drag it here.</span>
                <span className="button primary">
                  Browse files
                  <FolderOpen size={16} />
                </span>
                <input
                  aria-label="Upload CSV file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => load(e.target.files?.[0])}
                />
                <small>CSV files · up to 5 MB · 2,000 rows</small>
              </label>
            ) : (
              <>
                <div className="file-selected">
                  <FileSpreadsheet size={21} />
                  <div>
                    <strong>{name}</strong>
                    <span>
                      {parsed.rows.length} rows · {parsed.headers.length}{" "}
                      columns
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove selected file"
                    onClick={() => {
                      setParsed(undefined);
                      setPreview(undefined);
                      setError("");
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                {!preview ? (
                  <>
                    <h3>Match your columns</h3>
                    <p className="muted small">
                      Company and position are required. Unmapped optional
                      fields stay blank. Dates must use YYYY-MM-DD.
                    </p>
                    <div className="mapping-grid">
                      {CSV_FIELDS.filter(
                        (f) => f !== "formatVersion" || mapping[f],
                      ).map((field) => (
                        <div className="field" key={field}>
                          <label htmlFor={`map-${field}`}>
                            {CSV_LABELS[field]}
                            {["company", "position"].includes(field)
                              ? " *"
                              : ""}
                          </label>
                          <select
                            id={`map-${field}`}
                            value={mapping[field] || ""}
                            onChange={(e) =>
                              setMapping((m) => ({
                                ...m,
                                [field]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Do not import</option>
                            {parsed.headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        !!parsed.errors.length ||
                        !mapping.company ||
                        !mapping.position
                      }
                      onClick={() => submit(true)}
                    >
                      {busy ? "Checking rows…" : "Preview import"}
                      <ArrowRight size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="preview-heading">
                      <h3>Review before importing</h3>
                      <button
                        className="text-link"
                        onClick={() => setPreview(undefined)}
                      >
                        Edit mapping
                      </button>
                    </div>
                    <div className="notice info">
                      {
                        preview.rows.filter(
                          (r) =>
                            !r.errors.length &&
                            (allowDuplicates || !r.duplicate),
                        ).length
                      }{" "}
                      rows will be imported.{" "}
                      {
                        preview.rows.filter(
                          (r) =>
                            r.errors.length ||
                            (!allowDuplicates && r.duplicate),
                        ).length
                      }{" "}
                      rows will be skipped. Existing records will not be
                      replaced.
                    </div>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={allowDuplicates}
                        onChange={(e) => setAllowDuplicates(e.target.checked)}
                      />
                      <span>
                        Import possible duplicates as separate applications
                      </span>
                    </label>
                    <div className="import-preview">
                      {preview.rows.map((row) => (
                        <div
                          key={row.row}
                          className={`preview-row ${row.errors.length ? "invalid" : ""}`}
                        >
                          <div>
                            <span className="row-number">Row {row.row}</span>
                            <strong>{row.label}</strong>
                            <span
                              className={`badge ${row.errors.length ? "red" : row.duplicate ? "amber" : "green"}`}
                            >
                              {row.errors.length
                                ? "Skip · invalid"
                                : row.duplicate
                                  ? allowDuplicates
                                    ? "Import · duplicate"
                                    : "Skip · duplicate"
                                  : "Ready to import"}
                            </span>
                          </div>
                          {row.errors.map((e, i) => (
                            <p className="field-error" key={i}>
                              {e}
                            </p>
                          ))}
                          {row.data && (
                            <details>
                              <summary>Preview all fields</summary>
                              <dl>
                                {Object.entries(row.data).map(([k, v]) => (
                                  <div key={k}>
                                    <dt>{CSV_LABELS[k]}</dt>
                                    <dd>{v || "—"}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="button-row">
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => setPreview(undefined)}
                      >
                        Back
                      </button>
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          !preview.rows.some(
                            (r) =>
                              !r.errors.length &&
                              (allowDuplicates || !r.duplicate),
                          )
                        }
                        onClick={() => submit(false)}
                      >
                        <Upload size={16} />
                        {busy ? "Importing…" : "Import applications"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
        <aside className="import-aside">
          <section className="card">
            <span className="icon-tile">
              <FileSpreadsheet size={21} />
            </span>
            <h3>Coming from Google Sheets?</h3>
            <p>
              In your sheet, select{" "}
              <strong>File → Download → Comma-separated values (.csv)</strong>,
              then upload it here.
            </p>
            <a className="text-link" href="/example-applications.csv" download>
              Download example CSV
              <ArrowDownToLine size={15} />
            </a>
          </section>
          <section className="card">
            <span className="icon-tile">
              <ArrowDownToLine size={21} />
            </span>
            <h3>Your data, to keep.</h3>
            <p>
              Export includes every application field, dates, and activity
              history. Import that file into an empty database to restore it.
            </p>
            <p className="small muted">
              Text is escaped for spreadsheet safety. Keep the formatVersion
              column when reimporting an InternshipHQ export.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
