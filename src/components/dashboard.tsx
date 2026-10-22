"use client";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCheck,
  CircleCheck,
  Clock3,
  ListTodo,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import {
  addDays,
  formatDate,
  metrics,
  STATUSES,
  tasksFor,
  type ApplicationRecord,
  type Task,
} from "@/lib/domain";
import { CompanyMark, EmptyState, STATUS_COLORS, StatusBadge } from "./ui";

type Props = {
  records: ApplicationRecord[];
  today: string;
  onAdd: () => void;
  onOpen: (a: ApplicationRecord) => void;
  onComplete: (a: ApplicationRecord) => void;
  onNavigate: (view: string) => void;
};
export function Dashboard({
  records,
  today,
  onAdd,
  onOpen,
  onComplete,
  onNavigate,
}: Props) {
  const counts = metrics(records);
  const tasks = tasksFor(records, today);
  const [taskTab, setTaskTab] = useState("All tasks");
  const shownTasks = tasks.filter(
    (t) => taskTab === "All tasks" || t.group === taskTab,
  );
  const recent = [...records]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const stats = [
    {
      label: "Total applications",
      value: counts.total,
      detail: "Every opportunity, in one place",
      Icon: BriefcaseBusiness,
      color: "slate",
    },
    {
      label: "Active applications",
      value: counts.active,
      detail: "Your opportunities in progress",
      Icon: Target,
      color: "blue",
    },
    {
      label: "Submitted",
      value: counts.submitted,
      detail: "Applications with a date applied",
      Icon: ArrowUpRight,
      color: "purple",
    },
    {
      label: "Interviews",
      value: counts.interview,
      detail: "Currently at interview stage",
      Icon: MessageSquare,
      color: "amber",
    },
    {
      label: "Offers",
      value: counts.offer,
      detail: "Something worth celebrating",
      Icon: Trophy,
      color: "green",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-dot" />
            YOUR NEXT CHAPTER
          </div>
          <h1>A little progress, every day.</h1>
          <p>
            Your applications, next steps, and opportunities. All in one place.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} />
          Add application
        </button>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, value, detail, Icon, color }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={17} />
              </span>
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card today-card">
          <header className="card-header">
            <div className="title-with-icon">
              <span className="heading-icon">
                <ListTodo size={20} />
              </span>
              <div>
                <h2>What should I do today?</h2>
                <p>Make your next move a little clearer.</p>
              </div>
            </div>
            <span className="count-pill">{tasks.length} tasks</span>
          </header>
          <div className="tab-row">
            {["All tasks", "Overdue", "Today", "Next 7 days"].map((t) => (
              <button
                key={t}
                className={taskTab === t ? "active" : ""}
                aria-pressed={taskTab === t}
                onClick={() => setTaskTab(t)}
              >
                {t}
                {t === "Overdue" && tasks.some((x) => x.group === t) && (
                  <span className="tab-count">
                    {tasks.filter((x) => x.group === t).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {shownTasks.length ? (
            <div className="task-list">
              {shownTasks.slice(0, 5).map((task, i) => (
                <TaskRow
                  key={`${task.application.id}-${task.kind}-${i}`}
                  task={task}
                  onOpen={onOpen}
                  onComplete={onComplete}
                />
              ))}
              {shownTasks.length > 5 && (
                <button
                  className="text-link more-tasks"
                  onClick={() => onNavigate("today")}
                >
                  See all {shownTasks.length} tasks
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="tasks-empty">
              <div className="empty-orbit">
                <CheckCheck size={29} strokeWidth={1.5} />
                <span />
              </div>
              <h3>
                {records.length
                  ? "A little breathing room."
                  : "A clear head. A fresh start."}
              </h3>
              <p>
                {records.length
                  ? "No tasks in this view. Add a next action to an application to keep things moving."
                  : "Once you add a next action or deadline, your priorities will show up right here."}
              </p>
              <button className="text-link" onClick={onAdd}>
                Add an application
                <ArrowRight size={15} />
              </button>
            </div>
          )}
          <footer className="card-note">
            <CircleCheck size={14} />
            <span>One small step today is progress for tomorrow.</span>
          </footer>
        </section>
        <section className="card pipeline-card">
          <header className="card-header">
            <div>
              <h2>Your application pipeline</h2>
              <p>Every stage of your journey.</p>
            </div>
            <span className="icon-tile">
              <BriefcaseBusiness size={18} />
            </span>
          </header>
          <div className="pipeline-total">
            <strong>{counts.total}</strong>
            <span>tracked applications</span>
          </div>
          <div
            className="pipeline-stack"
            role="img"
            aria-label={STATUSES.map((s) => `${s}: ${counts.statuses[s]}`).join(
              ", ",
            )}
          >
            {counts.total ? (
              STATUSES.map(
                (s) =>
                  counts.statuses[s] > 0 && (
                    <span
                      key={s}
                      className={`bar-${STATUS_COLORS[s]}`}
                      style={{ flex: counts.statuses[s] }}
                      title={`${s}: ${counts.statuses[s]}`}
                    />
                  ),
              )
            ) : (
              <span className="empty-bar" />
            )}
          </div>
          <div className="pipeline-legend">
            {STATUSES.map((s) => (
              <div key={s}>
                <span className={`legend-dot bar-${STATUS_COLORS[s]}`} />
                <span>{s}</span>
                <strong>{counts.statuses[s]}</strong>
              </div>
            ))}
          </div>
          <footer className="pipeline-footer">
            <button className="text-link" onClick={() => onNavigate("board")}>
              Explore board view
              <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      </div>
      <section className="card recent-card">
        <header className="card-header">
          <div>
            <h2>Recent applications</h2>
            <p>A quick look at where you left off.</p>
          </div>
          <button
            className="text-link"
            onClick={() => onNavigate("applications")}
          >
            View all applications
            <ArrowRight size={15} />
          </button>
        </header>
        {recent.length ? (
          <div className="table-scroll">
            <table className="applications-table recent-table">
              <thead>
                <tr>
                  <th>COMPANY & ROLE</th>
                  <th>STATUS</th>
                  <th>INTERNSHIP TERM</th>
                  <th>NEXT STEP</th>
                  <th>
                    <span className="sr-only">Open application</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="company-cell"
                        onClick={() => onOpen(a)}
                      >
                        <CompanyMark company={a.company} />
                        <span>
                          <strong>{a.company}</strong>
                          <span>{a.position}</span>
                        </span>
                      </button>
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="muted">{a.term || "—"}</td>
                    <td>
                      <span className="cell-action">
                        {a.nextAction || "No next action"}
                      </span>
                      {a.nextActionDue && (
                        <span className="cell-sub">
                          <CalendarDays size={12} />
                          {formatDate(a.nextActionDue)}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => onOpen(a)}
                        aria-label={`Open ${a.company} application`}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState onAdd={onAdd} />
        )}
      </section>
      <div className="bottom-notes">
        <span>
          <span className="tiny-dot" />
          Your workspace. Your pace.
        </span>
        <span>Active excludes offers, rejections, and withdrawals.</span>
      </div>
    </>
  );
}
export function TaskRow({
  task,
  onOpen,
  onComplete,
}: {
  task: Task;
  onOpen: Props["onOpen"];
  onComplete: Props["onComplete"];
}) {
  return (
    <div className="task-row">
      {task.kind === "action" ? (
        <button
          className="task-check"
          aria-label={`Complete ${task.title} for ${task.application.company}`}
          onClick={() => onComplete(task.application)}
        >
          <Check size={14} />
        </button>
      ) : (
        <span className="task-deadline">
          <CalendarDays size={17} />
        </span>
      )}
      <button className="task-main" onClick={() => onOpen(task.application)}>
        <strong>{task.title}</strong>
        <span>
          {task.application.company}
          <span className="separator">·</span>
          {task.application.position}
        </span>
      </button>
      <span
        className={`task-date ${task.group === "Overdue" ? "overdue" : task.group === "Today" ? "due-today" : ""}`}
      >
        <Clock3 size={12} />
        {task.group === "Today" ? "Today" : formatDate(task.day)}
        {task.group === "Overdue" && <span className="sr-only">, overdue</span>}
      </span>
      <button
        className="icon-button task-open"
        onClick={() => onOpen(task.application)}
        aria-label={`Open ${task.application.company}`}
      >
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
export function TodayPage(props: Props) {
  const tasks = tasksFor(props.records, props.today);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SMALL STEP FORWARD</div>
          <h1>Your next moves</h1>
          <p>
            Actions and submission deadlines through{" "}
            {formatDate(addDays(props.today, 7), true)}.
          </p>
        </div>
        <button className="button primary" onClick={props.onAdd}>
          <Plus size={18} />
          Add application
        </button>
      </div>
      <div className="today-layout">
        <div>
          {["Overdue", "Today", "Next 7 days"].map((group) => (
            <section className="card task-group" key={group}>
              <header className="card-header">
                <h2>{group}</h2>
                <span className="count-pill">
                  {tasks.filter((t) => t.group === group).length}
                </span>
              </header>
              {tasks.filter((t) => t.group === group).length ? (
                tasks
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <TaskRow
                      key={`${t.application.id}-${t.kind}`}
                      task={t}
                      onOpen={props.onOpen}
                      onComplete={props.onComplete}
                    />
                  ))
              ) : (
                <p className="group-empty">
                  Nothing here. You’re all caught up.
                </p>
              )}
            </section>
          ))}
        </div>
        <aside className="focus-note">
          <Sparkles size={24} />
          <h2>Small steps add up.</h2>
          <p>
            Try giving each active application one clear next action. A resume
            update, a little research, a follow-up — it all counts.
          </p>
          <hr />
          <p className="small">
            All dates use America/Toronto. Offers, rejected, and withdrawn
            applications are excluded from reminders.
          </p>
        </aside>
      </div>
    </>
  );
}
