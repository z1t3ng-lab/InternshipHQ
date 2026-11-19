"use client";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  Plus,
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
import {
  CompanyMark,
  DateStamp,
  EmptyState,
  STATUS_COLORS,
  StatusBadge,
} from "./ui";
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
    ["Total applications", counts.total],
    ["Active", counts.active],
    ["Submitted", counts.submitted],
    ["At interview", counts.interview],
    ["Offers", counts.offer],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <h1>Application overview</h1>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} />
          Add application
        </button>
      </div>
      <dl className="metric-strip" aria-label="Application totals">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="dashboard-grid">
        <section className="agenda" aria-labelledby="agenda-title">
          <header className="section-heading">
            <h2 id="agenda-title">Next actions</h2>
            <a className="text-link" href="#today">
              View agenda <ArrowUpRight size={15} />
            </a>
          </header>
          <div className="tab-row" role="group" aria-label="Due date">
            {["All tasks", "Overdue", "Today", "Next 7 days"].map((tab) => (
              <button
                key={tab}
                aria-pressed={taskTab === tab}
                onClick={() => setTaskTab(tab)}
              >
                {tab}
                {tab === "Overdue" && tasks.some((t) => t.group === tab) && (
                  <span className="tab-count">
                    {tasks.filter((t) => t.group === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {shownTasks.length ? (
            <>
              {shownTasks.slice(0, 5).map((task) => (
                <TaskRow
                  key={task.application.id + task.kind}
                  task={task}
                  onOpen={onOpen}
                  onComplete={onComplete}
                />
              ))}
              {shownTasks.length > 5 && (
                <a className="text-link more-tasks" href="#today">
                  See all {shownTasks.length} tasks <ArrowRight size={15} />
                </a>
              )}
            </>
          ) : (
            <div className="agenda-empty">
              <CalendarCheck2 size={29} strokeWidth={1.3} aria-hidden="true" />
              <div>
                <h3>
                  {taskTab === "Overdue"
                    ? "No overdue tasks"
                    : taskTab === "Today"
                      ? "Nothing due today"
                      : taskTab === "Next 7 days"
                        ? "Nothing due in the next 7 days"
                        : "No actions due"}
                </h3>
                <p>
                  {taskTab !== "All tasks" && tasks.length
                    ? "Other dates have scheduled tasks."
                    : "Dated next actions and submission deadlines appear here."}
                </p>
                {taskTab !== "All tasks" && tasks.length > 0 && (
                  <button
                    className="text-link"
                    onClick={() => setTaskTab("All tasks")}
                  >
                    Show all tasks <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
        <section className="pipeline" aria-labelledby="pipeline-title">
          <header className="section-heading">
            <h2 id="pipeline-title">Application pipeline</h2>
          </header>
          <dl className="pipeline-rows">
            {STATUSES.map((status) => (
              <div key={status}>
                <dt>{status}</dt>
                <dd>
                  <span className="pipeline-track" aria-hidden="true">
                    <span
                      className={`bar-${STATUS_COLORS[status]}`}
                      style={{
                        width:
                          (counts.total
                            ? (counts.statuses[status] / counts.total) * 100
                            : 0) + "%",
                      }}
                    />
                  </span>
                  <span>{counts.statuses[status]}</span>
                </dd>
              </div>
            ))}
          </dl>
          <a className="text-link pipeline-link" href="#board">
            Open board <ArrowUpRight size={15} />
          </a>
        </section>
      </div>
      <section className="recent-section" aria-labelledby="recent-title">
        <header className="section-heading">
          <h2 id="recent-title">Recent applications</h2>
          <a className="text-link" href="#applications">
            View all applications <ArrowUpRight size={15} />
          </a>
        </header>
        {recent.length ? (
          <div className="table-scroll">
            <table role="table" className="applications-table recent-table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Company & role
                  </th>
                  <th scope="col" role="columnheader">
                    Status
                  </th>
                  <th scope="col" role="columnheader">
                    Internship term
                  </th>
                  <th scope="col" role="columnheader">
                    Next step
                  </th>
                  <th scope="col" role="columnheader">
                    <span className="sr-only">Open application</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {recent.map((a) => (
                  <tr role="row" key={a.id}>
                    <td role="cell">
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
                    <td role="cell">
                      <StatusBadge status={a.status} />
                    </td>
                    <td role="cell" className="muted">
                      <span className="mobile-field" aria-hidden="true">
                        Term
                      </span>
                      {a.term || "—"}
                    </td>
                    <td role="cell">
                      <span className="mobile-field" aria-hidden="true">
                        Next step
                      </span>
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
                    <td role="cell">
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

      <details className="metric-key">
        <summary>How totals are counted</summary>
        <p>
          Active excludes offers, rejections, and withdrawals. Submitted counts
          applications with a date applied. Interview and offer counts use the
          current status.
        </p>
      </details>
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
      <DateStamp value={task.day} />
      <button className="task-main" onClick={() => onOpen(task.application)}>
        <strong>{task.title}</strong>
        <span>
          {task.application.company}
          <span className="separator"> · </span>
          {task.application.position}
        </span>
      </button>
      {task.group !== "Next 7 days" && (
        <span
          className={`due-label ${task.group === "Overdue" ? "overdue" : ""}`}
        >
          {task.group}
        </span>
      )}
      {task.kind === "action" ? (
        <button
          className="icon-button task-check"
          title="Complete action"
          aria-label={`Complete ${task.title} for ${task.application.company}`}
          onClick={() => onComplete(task.application)}
        >
          <span>
            <Check size={14} strokeWidth={2} />
          </span>
        </button>
      ) : (
        <button
          className="icon-button task-open"
          aria-label={`Open ${task.application.company} deadline`}
          onClick={() => onOpen(task.application)}
        >
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}
export function TodayPage(props: Props) {
  const tasks = tasksFor(props.records, props.today);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Next actions</h1>
          <p>
            Actions and submission deadlines through{" "}
            {formatDate(addDays(props.today, 7), true)}.
          </p>
        </div>
        <button className="button primary" onClick={props.onAdd}>
          <Plus size={17} />
          Add application
        </button>
      </div>
      <div className="agenda-groups">
        {(["Overdue", "Today", "Next 7 days"] as const).map((group) => {
          const entries = tasks.filter((t) => t.group === group);
          return (
            <section className="agenda-group" key={group}>
              <header>
                <h2>{group}</h2>
                <span className="group-count">{entries.length}</span>
              </header>
              <div>
                {entries.length ? (
                  entries.map((task) => (
                    <TaskRow
                      key={task.application.id + task.kind}
                      task={task}
                      onOpen={props.onOpen}
                      onComplete={props.onComplete}
                    />
                  ))
                ) : (
                  <p className="group-empty">No tasks scheduled.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="small muted agenda-note">
        Dates use America/Toronto. Reminders end when an application is offered,
        rejected, or withdrawn.
      </p>
    </>
  );
}
