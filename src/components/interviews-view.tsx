"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { type ApplicationRecord } from "@/lib/domain";
import { localInterviewTime } from "@/lib/interview-time";
import { request, Modal } from "./ui";
type Interview = {
  id: string;
  applicationId: string;
  title: string;
  startAt: string;
  timeZone: string;
  duration: number;
  interviewer: string;
  location: string;
  meetingUrl: string;
  preparation: string;
  notes: string;
  state: string;
};
const initial = {
  applicationId: "",
  title: "Interview",
  startLocal: "",
  timeZone: "America/Toronto",
  duration: 60,
  interviewer: "",
  location: "",
  meetingUrl: "",
  preparation: "",
  notes: "",
  state: "Scheduled",
  occurrence: "earlier",
};
export function InterviewsView({
  records,
  onOpen,
  onChanged,
}: {
  records: ApplicationRecord[];
  onOpen: (a: ApplicationRecord) => void;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Interview | "new">();
  const [form, setForm] = useState(initial);
  const [filter, setFilter] = useState("upcoming");
  async function load() {
    try {
      setItems(await request<Interview[]>("/api/interviews"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function edit(item: Interview | "new") {
    setError("");
    setEditing(item);
    setForm(
      item === "new"
        ? { ...initial, applicationId: records[0]?.id || "" }
        : {
            ...item,
            startLocal: localInterviewTime(item.startAt, item.timeZone),
            occurrence: [30, 60, 90, 120, 150, 180].some(
              (minutes) =>
                localInterviewTime(
                  new Date(
                    Date.parse(item.startAt) - minutes * 60000,
                  ).toISOString(),
                  item.timeZone,
                ) === localInterviewTime(item.startAt, item.timeZone),
            )
              ? "later"
              : "earlier",
          },
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(
        `/api/interviews${editing === "new" ? "" : `/${editing?.id}`}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          body: JSON.stringify(form),
        },
      );
      setEditing(undefined);
      await load();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (i) =>
      filter === "all" ||
      (filter === "upcoming" &&
        i.state === "Scheduled" &&
        Date.parse(i.startAt) + i.duration * 60000 >= Date.now()) ||
      (filter === "past" &&
        (i.state !== "Scheduled" ||
          Date.parse(i.startAt) + i.duration * 60000 < Date.now())),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WALK IN PREPARED</div>
          <h1>Interview planner</h1>
          <p>Every round, meeting link, and preparation note in one place.</p>
        </div>
        <button
          className="button primary"
          disabled={!records.length}
          onClick={() => edit("new")}
        >
          <Plus size={17} aria-hidden="true" />
          Plan interview
        </button>
      </div>
      {!records.length && (
        <p className="notice">
          Add an application first, then plan its interviews here.
        </p>
      )}
      {error && !editing && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="feature-toolbar">
        <label className="field">
          Show interviews
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past & finished</option>
            <option value="all">All interviews</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Loading interviews…</p>
      ) : !visible.length ? (
        <section className="card feature-panel empty-inline">
          <CalendarDays size={28} aria-hidden="true" />
          <h2>
            No{" "}
            {filter === "all"
              ? ""
              : filter === "upcoming"
                ? "upcoming "
                : "past "}
            interviews
          </h2>
          <p>
            Schedule a round when you receive an invitation. Application status
            stays under your control.
          </p>
        </section>
      ) : (
        <div className="feature-list">
          {visible.map((i) => {
            const a = records.find((a) => a.id === i.applicationId);
            return (
              <article key={i.id} className="card feature-panel">
                <div className="feature-row">
                  <div>
                    <span className="badge slate">{i.state}</span>
                    <h2>{i.title}</h2>
                    {a && (
                      <button className="text-link" onClick={() => onOpen(a)}>
                        {a.company} · {a.position}
                      </button>
                    )}
                  </div>
                  <button className="button" onClick={() => edit(i)}>
                    Edit interview
                  </button>
                </div>
                <p className="interview-date">
                  {new Intl.DateTimeFormat("en-CA", {
                    timeZone: i.timeZone,
                    dateStyle: "full",
                    timeStyle: "short",
                  }).format(new Date(i.startAt))}
                </p>
                <p className="muted">
                  {i.timeZone} · {i.duration} minutes
                  {i.interviewer && ` · ${i.interviewer}`}
                </p>
                {i.location && <p>{i.location}</p>}
                {i.meetingUrl && (
                  <a
                    className="button"
                    href={i.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open meeting link
                  </a>
                )}
                {i.preparation && (
                  <div className="preformatted">
                    <h3>Preparation</h3>
                    <p>{i.preparation}</p>
                  </div>
                )}
                {i.notes && (
                  <div className="preformatted">
                    <h3>Notes & follow-up</h3>
                    <p>{i.notes}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <Modal
          title={editing === "new" ? "Plan an interview" : "Edit interview"}
          onClose={() => {
            if (!busy) setEditing(undefined);
          }}
        >
          <form className="feature-panel" onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="field">
                <label htmlFor="interview-app">Application</label>
                <select
                  id="interview-app"
                  required
                  value={form.applicationId}
                  onChange={(e) =>
                    setForm({ ...form, applicationId: e.target.value })
                  }
                >
                  {records.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.company} · {a.position}
                    </option>
                  ))}
                </select>
              </div>
              <label className="field">
                Round / title
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <div className="feature-grid">
                <label className="field">
                  Date and time
                  <input
                    type="datetime-local"
                    required
                    value={form.startLocal}
                    onChange={(e) =>
                      setForm({ ...form, startLocal: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Time zone
                  <input
                    required
                    list="time-zones"
                    value={form.timeZone}
                    onChange={(e) =>
                      setForm({ ...form, timeZone: e.target.value })
                    }
                  />
                </label>
                <datalist id="time-zones">
                  {[
                    "America/Toronto",
                    "America/Vancouver",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Europe/London",
                    "Europe/Paris",
                    "Asia/Shanghai",
                    "UTC",
                  ].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </datalist>
                <label className="field">
                  Duration (minutes)
                  <input
                    type="number"
                    min={1}
                    max={480}
                    required
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  Interview state
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  >
                    {["Scheduled", "Completed", "Cancelled"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <details>
                <summary>Daylight saving time options</summary>
                <label className="field">
                  If the clock repeats this time
                  <select
                    value={form.occurrence}
                    onChange={(e) =>
                      setForm({ ...form, occurrence: e.target.value })
                    }
                  >
                    <option value="earlier">Use the first occurrence</option>
                    <option value="later">Use the second occurrence</option>
                  </select>
                </label>
              </details>
              {(
                [
                  ["interviewer", "Interviewer(s)"],
                  ["location", "Location"],
                  ["meetingUrl", "Meeting URL"],
                ] as const
              ).map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type={key === "meetingUrl" ? "url" : "text"}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="field">
                Preparation
                <textarea
                  rows={4}
                  value={form.preparation}
                  onChange={(e) =>
                    setForm({ ...form, preparation: e.target.value })
                  }
                  placeholder="Questions to ask, topics to revise, and things to bring"
                />
              </label>
              <label className="field">
                Notes & follow-up
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save interview"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
