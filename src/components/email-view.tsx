"use client";
import { useEffect, useState } from "react";
import {
  type ApplicationRecord,
  STATUSES,
  formatTimestamp,
} from "@/lib/domain";
import { request, Modal } from "./ui";
import { GmailConnection } from "./gmail-connection";
type Review = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  sourceUrl: string;
  evidence: string;
  proposedStatus: string;
  state: string;
  applicationId: string;
  createdAt: string;
  reviewedAt: string | null;
};
export function EmailView({
  records,
  onChanged,
  onOpen,
}: {
  records: ApplicationRecord[];
  onChanged: () => Promise<void>;
  onOpen: (a: ApplicationRecord) => void;
}) {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [subject, setSubject] = useState("");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [review, setReview] = useState<Review>();
  const [applicationId, setApplicationId] = useState("");
  const [status, setStatus] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [due, setDue] = useState("");
  const [applied, setApplied] = useState("");
  async function load() {
    try {
      setItems(await request<Review[]>("/api/email"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(item: Review) {
    setReview(item);
    setApplicationId("");
    setStatus(item.proposedStatus);
    setNextAction("");
    setDue("");
    setApplied("");
    setError("");
  }
  async function importMessage(data: Record<string, unknown>) {
    const result = await request<Review>("/api/email", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await load();
    if (result.state === "pending") open(result);
    else
      setNotice(
        `This email was already ${result.state}. Its review decision has been retained.`,
      );
  }
  const current = records.find((a) => a.id === applicationId);
  const candidates = records.filter(
    (a) =>
      review &&
      `${review.subject} ${review.body}`
        .toLowerCase()
        .includes(a.company.toLowerCase()) &&
      `${review.subject} ${review.body}`
        .toLowerCase()
        .includes(a.position.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LESS ADMIN, WITH YOU IN CONTROL</div>
          <h1>Email-assisted updates</h1>
          <p>Collect messages, review the evidence, and choose what changes.</p>
        </div>
      </div>
      <GmailConnection onImported={load} />
      {error && !review && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="card feature-panel">
        <details>
          <summary>Paste an email or import an .eml file</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(() =>
                importMessage({ subject, sender, body, sourceUrl }),
              );
            }}
          >
            <fieldset disabled={busy}>
              <div className="feature-grid">
                <label className="field">
                  Email subject
                  <input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <label className="field">
                  Sender (optional)
                  <input
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    maxLength={500}
                  />
                </label>
              </div>
              <label className="field">
                Email text
                <textarea
                  required
                  rows={7}
                  maxLength={100000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the relevant message here. English and French are supported."
                />
              </label>
              <label className="field">
                Source email URL (optional)
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button className="button primary" disabled={busy}>
                  {busy ? "Reading…" : "Review pasted email"}
                </button>
                <label className="button">
                  Import .eml
                  <input
                    className="file-overlay"
                    type="file"
                    accept=".eml,message/rfc822"
                    aria-label="Import .eml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file)
                        void action(async () => {
                          if (file.size > 1000000)
                            throw new Error("Choose an email file up to 1 MB.");
                          await importMessage({ eml: await file.text() });
                        });
                    }}
                  />
                </label>
              </div>
            </fieldset>
          </form>
        </details>
      </section>
      <section className="card feature-panel">
        <div className="feature-row">
          <h2>Review inbox</h2>
          <label className="field">
            Review state
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["pending", "accepted", "dismissed", "all"].map((s) => (
                <option value={s} key={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button subtle"
            onClick={() => {
              void load();
            }}
          >
            Refresh inbox
          </button>
        </div>
        {loading ? (
          <p role="status">Loading reviews…</p>
        ) : (
          <div className="feature-list">
            {items.filter((i) => filter === "all" || i.state === filter)
              .length ? (
              items
                .filter((i) => filter === "all" || i.state === filter)
                .map((i) => (
                  <article className="feature-row" key={i.id}>
                    <div>
                      <h3>{i.subject}</h3>
                      <p className="muted">
                        {i.sender || "Sender not provided"} ·{" "}
                        {formatTimestamp(i.createdAt)} · {i.state}
                      </p>
                      <p>
                        {i.proposedStatus
                          ? `Suggested: ${i.proposedStatus}`
                          : "Needs manual review"}
                      </p>
                    </div>
                    <button className="button" onClick={() => open(i)}>
                      {i.state === "pending" ? "Review update" : "View review"}
                    </button>
                  </article>
                ))
            ) : (
              <p className="empty-inline">
                No {filter === "all" ? "" : `${filter} `}emails here. Check
                Gmail or import a message to get started.
              </p>
            )}
          </div>
        )}
      </section>
      {review && (
        <Modal
          title={
            review.state === "pending" ? "Review email update" : "Email review"
          }
          subtitle={review.subject}
          wide
          onClose={() => {
            if (!busy) setReview(undefined);
          }}
        >
          <div className="feature-panel">
            <p className="muted">
              From {review.sender || "unknown sender"}
              {review.reviewedAt &&
                ` · ${review.state} ${formatTimestamp(review.reviewedAt)}`}
            </p>
            {review.sourceUrl && (
              <a
                className="text-link"
                href={review.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open source email
              </a>
            )}
            <div className="email-evidence">
              <h3>Suggestion evidence</h3>
              <p>{review.evidence}</p>
            </div>
            <details>
              <summary>Read the full message</summary>
              <pre className="email-text">{review.body}</pre>
            </details>
            {review.state !== "pending" ? (
              <>
                <p>This email has been {review.state}.</p>
                {records.find((a) => a.id === review.applicationId) && (
                  <button
                    className="button"
                    onClick={() => {
                      const a = records.find(
                        (a) => a.id === review.applicationId,
                      )!;
                      setReview(undefined);
                      onOpen(a);
                    }}
                  >
                    Open linked application
                  </button>
                )}
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    if (!current)
                      throw new Error("Choose an application first.");
                    await request(`/api/email/${review.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        action: "accept",
                        applicationId,
                        expectedUpdatedAt: current.updatedAt,
                        ...(status ? { status } : {}),
                        ...(nextAction
                          ? { nextAction, nextActionDue: due }
                          : {}),
                        ...(applied ? { dateApplied: applied } : {}),
                      }),
                    });
                    setReview(undefined);
                    await onChanged();
                    await load();
                    setNotice(
                      "Email update accepted and recorded in application history.",
                    );
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <label className="field">
                    Apply to application
                    <select
                      required
                      value={applicationId}
                      onChange={(e) => setApplicationId(e.target.value)}
                    >
                      <option value="">Choose the correct application</option>
                      {records.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.company} · {a.position}
                        </option>
                      ))}
                    </select>
                  </label>
                  {candidates.length > 0 && (
                    <p className="small muted">
                      Company and role mentioned in the text:{" "}
                      {candidates
                        .map((a) => `${a.company} · ${a.position}`)
                        .join("; ")}
                      . Confirm the match yourself.
                    </p>
                  )}
                  {!records.length && (
                    <p className="notice">
                      Add the application first, then return to this pending
                      review.
                    </p>
                  )}
                  <div className="feature-grid">
                    <label className="field">
                      Proposed status
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="">Keep current status</option>
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <span className="small muted">
                        Current: {current?.status || "Select an application"}
                      </span>
                    </label>
                    <label className="field">
                      Date applied (optional)
                      <input
                        type="date"
                        value={applied}
                        onChange={(e) => setApplied(e.target.value)}
                      />
                      <span className="small muted">
                        Current: {current?.dateApplied || "Not recorded"}. Blank
                        keeps it.
                      </span>
                    </label>
                  </div>
                  <label className="field">
                    Next action (optional)
                    <input
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                    />
                    <span className="small muted">
                      Current: {current?.nextAction || "None"}. Blank keeps it.
                    </span>
                  </label>
                  <label className="field">
                    Next action due
                    <input
                      type="date"
                      disabled={!nextAction}
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                  <p className="small muted">
                    Only the fields above and an available source email link are
                    updated. Interview dates are planned separately so you can
                    confirm the time zone.
                  </p>
                  {error && (
                    <p className="notice error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="button-row">
                    <button
                      className="button primary"
                      disabled={busy || !current}
                    >
                      {busy ? "Saving…" : "Accept update"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await request(`/api/email/${review.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ action: "dismiss" }),
                          });
                          setReview(undefined);
                          await load();
                          setNotice(
                            "Email dismissed. Your application was not changed.",
                          );
                        })
                      }
                    >
                      Dismiss suggestion
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
