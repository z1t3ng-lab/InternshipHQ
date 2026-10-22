"use client";
import { useState } from "react";
import { applicationInsights } from "@/lib/insights";
import { type ApplicationRecord } from "@/lib/domain";
import { StatusBadge } from "./ui";
export function InsightsView({
  records,
  today,
  onOpen,
}: {
  records: ApplicationRecord[];
  today: string;
  onOpen: (a: ApplicationRecord) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const stats = applicationInsights(records, today, start, end);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEE HOW YOUR SEARCH IS MOVING</div>
          <h1>Application insights</h1>
          <p>Progress and timing from your recorded application history.</p>
        </div>
      </div>
      <section className="card feature-panel">
        <div className="feature-toolbar">
          <label className="field">
            Applied from
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            Applied through
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button
            className="button"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
          >
            All time
          </button>
        </div>
        <p className="muted">
          {stats.total} applications in this view. Date filters use the
          application’s date applied; records without that date are excluded
          when a filter is set.
        </p>
      </section>
      <section className="card feature-panel">
        <h2>Application funnel</h2>
        <p className="muted">
          Each percentage is out of {stats.submitted} submitted applications.
          Responses include assessments, interviews, offers, and rejections.
          Stages may be skipped.
        </p>
        <div className="funnel">
          {stats.steps.map((step) => (
            <div className="funnel-row" key={step.label}>
              <div className="feature-row">
                <span>{step.label}</span>
                <strong>
                  {step.count}{" "}
                  <span className="muted">
                    / {stats.submitted} ·{" "}
                    {stats.submitted
                      ? Math.round((step.count / stats.submitted) * 100)
                      : 0}
                    %
                  </span>
                </strong>
              </div>
              <div className="funnel-track" aria-hidden="true">
                <span
                  style={{
                    width: `${stats.submitted ? (step.count / stats.submitted) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="small muted">
          A stage is counted when the current status or recorded history shows
          it. An offer alone does not prove that an interview occurred.
          Rejections and withdrawals without a date or prior submission evidence
          do not establish when an application was sent.
        </p>
      </section>
      <div className="timing-grid">
        {stats.timings.map((t) => (
          <section className="card feature-panel" key={t.label}>
            <h2>{t.label}</h2>
            <p className="timing-value">
              {t.median === null ? "—" : `${t.median} days`}
            </p>
            <p className="muted">
              Median · {t.count} dated sample{t.count === 1 ? "" : "s"}
            </p>
          </section>
        ))}
      </div>
      <p className="small muted timing-note">
        Timing runs from Date applied to the first recorded status change for
        that stage, in America/Toronto calendar days. It measures when you
        recorded the change, which may differ from the employer’s response time.
        Imported or initially entered statuses have no assumed response date.
        Small samples describe your records; they do not predict outcomes.
      </p>
      <section className="card feature-panel">
        <h2>Current status</h2>
        <div className="status-totals">
          {stats.statuses.map((s) => (
            <div key={s.status}>
              <StatusBadge status={s.status} />
              <strong>{s.count}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="card feature-panel">
        <h2>Waiting for a recorded response</h2>
        <p className="muted">
          {stats.waiting.length} applications. Waiting does not imply rejection.
        </p>
        <div className="feature-list">
          {stats.waiting.length ? (
            stats.waiting.map((w) => (
              <div className="feature-row" key={w.application.id}>
                <button
                  className="text-link"
                  onClick={() => onOpen(w.application)}
                >
                  {w.application.company} · {w.application.position}
                </button>
                <span>{w.days} days since applying</span>
              </div>
            ))
          ) : (
            <p className="empty-inline">
              No applications waiting with a known date applied.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
