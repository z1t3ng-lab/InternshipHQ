"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Save,
  Trash2,
} from "lucide-react";
import {
  applicationSchema,
  ARRANGEMENTS,
  EMPTY_APPLICATION,
  FIELD_LABELS,
  fieldErrors,
  formatTimestamp,
  PRIORITIES,
  STATUSES,
  type ApplicationInput,
  type ApplicationRecord,
} from "@/lib/domain";
import { Modal, request, StatusBadge } from "./ui";
import { ApplicationDocuments } from "./documents-view";

export function ApplicationForm({
  record,
  onClose,
  onSaved,
  onDeleted,
  onComplete,
}: {
  record?: ApplicationRecord;
  onClose: () => void;
  onSaved: (a: ApplicationRecord) => void;
  onDeleted: (id: string) => void;
  onComplete: (a: ApplicationRecord) => void;
}) {
  const [data, setData] = useState<ApplicationInput>(
    record ? { ...record } : { ...EMPTY_APPLICATION },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [more, setMore] = useState(!!record);
  const errorRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirmDelete) deleteRef.current?.focus();
  }, [confirmDelete]);
  const set = (key: keyof ApplicationInput, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setDuplicate(false);
  };
  const fail = (message: string, fields: Record<string, string> = {}) => {
    setError(message);
    setErrors(fields);
    setTimeout(() => errorRef.current?.focus(), 0);
  };
  async function save(allowDuplicate = false, thenComplete = false) {
    const parsed = applicationSchema.safeParse(data);
    if (!parsed.success) {
      setMore(true);
      fail("Please check the highlighted fields.", fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const result = await request<ApplicationRecord>(
        record ? `/api/applications/${record.id}` : "/api/applications",
        {
          method: record ? "PATCH" : "POST",
          body: JSON.stringify({ data: parsed.data, allowDuplicate }),
        },
      );
      if (thenComplete) onComplete(result);
      else onSaved(result);
    } catch (e) {
      const err = e as Error & {
        fields?: Record<string, string>;
        duplicates?: unknown[];
      };
      setMore(true);
      fail(err.message, err.fields);
      if (err.duplicates) setDuplicate(true);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await request(`/api/applications/${record!.id}`, {
        method: "DELETE",
        body: "{}",
      });
      onDeleted(record!.id);
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: keyof ApplicationInput,
    type = "text",
    placeholder = "",
    full = false,
  ) => (
    <div className={`field ${full ? "full" : ""}`} key={key}>
      <label htmlFor={key}>
        {FIELD_LABELS[key]}
        {["company", "position"].includes(key) && (
          <span className="required"> *</span>
        )}
      </label>
      {key === "notes" ? (
        <textarea
          id={key}
          rows={5}
          value={data[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder="Interview thoughts, things to research, or anything worth remembering…"
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        />
      ) : (
        <input
          id={key}
          type={type}
          value={data[key]}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value)}
          aria-required={["company", "position"].includes(key)}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        />
      )}
      {errors[key] && (
        <span className="field-error" id={`${key}-error`}>
          {errors[key]}
        </span>
      )}
    </div>
  );
  const select = (
    key: "status" | "priority" | "arrangement",
    options: readonly string[],
  ) => (
    <div className="field" key={key}>
      <label htmlFor={key}>{FIELD_LABELS[key]}</label>
      <select
        id={key}
        value={data[key]}
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </div>
  );
  return (
    <Modal
      title={record ? record.company : "Add an application"}
      subtitle={
        record ? record.position : "A new opportunity, one small step forward."
      }
      onClose={onClose}
      wide
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="modal-body">
          {record && (
            <div className="detail-meta">
              <StatusBadge status={record.status} />
              <span>Added {formatTimestamp(record.createdAt)}</span>
            </div>
          )}
          {error && (
            <div
              className="notice error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {error}
              {Object.entries(errors).length > 0 && (
                <ul>
                  {Object.entries(errors).map(([key, value]) => (
                    <li key={key}>
                      <a
                        href={`#${key}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(key)?.focus();
                        }}
                      >
                        {FIELD_LABELS[key as keyof ApplicationInput] || key}:{" "}
                        {value}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {duplicate && (
            <div className="notice warning">
              <p>
                Review the company, position, and posting URL. You can keep this
                as a separate record.
              </p>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => save(true)}
              >
                Save as separate application
              </button>
            </div>
          )}
          <div className="form-grid">
            {field("company", "text", "e.g. Maple Labs")}
            {field("position", "text", "e.g. Software Engineering Intern")}
            {select("status", STATUSES)}
            {select("priority", PRIORITIES)}
          </div>
          <button
            type="button"
            className="disclosure"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            <ChevronDown size={17} className={more ? "rotated" : ""} />
            {more ? "Hide additional details" : "Add dates, links, and more"}
            <span>Optional</span>
          </button>
          <ApplicationDocuments
            data={data}
            errors={errors}
            onChange={(patch) => {
              setData((current) => ({ ...current, ...patch }));
              setDuplicate(false);
            }}
          />
          {more && (
            <>
              <h3 className="form-section">The opportunity</h3>
              <div className="form-grid">
                {field("jobUrl", "url", "https://…", true)}
                {field("location", "text", "e.g. Toronto, ON")}
                {select("arrangement", ARRANGEMENTS)}
                {field("term", "text", "e.g. Summer 2027")}
                {field("deadline", "date")}
                {field("dateApplied", "date")}
              </div>
              <h3 className="form-section">Your next step</h3>
              <div className="form-grid">
                {field("nextAction", "text", "e.g. Tailor my resume")}
                {field("nextActionDue", "date")}
              </div>
              {record?.nextAction && (
                <button
                  type="button"
                  className="button subtle complete-inline"
                  disabled={busy}
                  onClick={() => save(false, true)}
                >
                  <Check size={16} />
                  Save & complete current action
                </button>
              )}
              <h3 className="form-section">People & documents</h3>
              <div className="form-grid">
                {field("contactName")}
                {field("contactEmail", "email")}
                {!data.resumeDocumentId &&
                  field(
                    "resume",
                    "text",
                    "Optional filename without an upload",
                  )}
                {!data.letterDocumentId &&
                  field(
                    "coverLetter",
                    "text",
                    "Optional filename without an upload",
                  )}
                {!data.transcriptDocumentId &&
                  field(
                    "transcript",
                    "text",
                    "Optional filename without an upload",
                  )}
                {field(
                  "sourceEmailUrl",
                  "url",
                  "https://mail.google.com/…",
                  true,
                )}
                {field("notes", "text", "", true)}
              </div>
              {record && (record.jobUrl || record.sourceEmailUrl) && (
                <div className="external-links">
                  {record.jobUrl && (
                    <a
                      className="button"
                      target="_blank"
                      rel="noreferrer"
                      href={record.jobUrl}
                    >
                      Job posting
                      <ExternalLink size={15} />
                    </a>
                  )}
                  {record.sourceEmailUrl && (
                    <a
                      className="button"
                      target="_blank"
                      rel="noreferrer"
                      href={record.sourceEmailUrl}
                    >
                      Source email
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              )}
            </>
          )}
          {record && (
            <section className="history">
              <h3>
                <Clock3 size={17} />
                Activity history
              </h3>
              <p className="muted small">
                Updated {formatTimestamp(record.updatedAt)} · America/Toronto
              </p>
              <ol>
                {record.activities.map((a, i) => (
                  <li key={a.id || i}>
                    <span
                      className={`history-dot ${a.type === "status" ? "accent" : ""}`}
                    />
                    <div>
                      <p>{a.message}</p>
                      <time dateTime={a.createdAt}>
                        {formatTimestamp(a.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {confirmDelete && (
            <div
              className="notice error"
              role="alert"
              tabIndex={-1}
              ref={deleteRef}
            >
              <strong>Delete {record?.company}?</strong>
              <p>
                This permanently deletes the application and its activity
                history.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep application
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={remove}
                >
                  Yes, delete application
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="modal-footer">
          {record && (
            <button
              className="button text-danger"
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <div className="spacer" />
          <button
            type="button"
            className="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : record ? "Save changes" : "Add application"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function CompleteAction({
  record,
  onClose,
  onSaved,
}: {
  record: ApplicationRecord;
  onClose: () => void;
  onSaved: (a: ApplicationRecord) => void;
}) {
  const [nextAction, setNext] = useState("");
  const [nextActionDue, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="One step closer"
      subtitle={`Complete your action for ${record.company}.`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onSaved(
              await request<ApplicationRecord>(
                `/api/applications/${record.id}/complete`,
                {
                  method: "POST",
                  body: JSON.stringify({ nextAction, nextActionDue }),
                },
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <div className="completed-callout">
            <Check size={20} />
            <strong>{record.nextAction}</strong>
          </div>
          <p className="muted">
            This action will be saved in your history. Set another step, or
            leave it blank.
          </p>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="field">
            <label htmlFor="replacement-action">Next action (optional)</label>
            <input
              id="replacement-action"
              value={nextAction}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="replacement-due">Due date (optional)</label>
            <input
              id="replacement-due"
              type="date"
              value={nextActionDue}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Complete action"}
            <Check size={16} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
