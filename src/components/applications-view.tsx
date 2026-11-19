"use client";
import {
  ArrowDownUp,
  ArrowUpRight,
  CalendarDays,
  Columns3,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  ARRANGEMENTS,
  DEFAULT_FILTERS,
  filterApplications,
  formatDate,
  PRIORITIES,
  STATUSES,
  type ApplicationRecord,
  type Filters,
  type Status,
} from "@/lib/domain";
import { CompanyMark, EmptyState, STATUS_COLORS } from "./ui";
type Props = {
  records: ApplicationRecord[];
  board: boolean;
  onNavigate: (s: string) => void;
  onOpen: (a: ApplicationRecord) => void;
  onAdd: () => void;
  onStatus: (a: ApplicationRecord, s: Status) => Promise<void>;
};
export function ApplicationsView({
  records,
  board,
  onNavigate,
  onOpen,
  onAdd,
  onStatus,
}: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const filtered = filterApplications(records, filters);
  const change = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const filterActive = [
    filters.search,
    filters.status,
    filters.priority,
    filters.term,
    filters.arrangement,
  ].some(Boolean);
  const canReset =
    filterActive ||
    filters.sort !== DEFAULT_FILTERS.sort ||
    filters.direction !== DEFAULT_FILTERS.direction;
  const statusControl = (a: ApplicationRecord) => (
    <select
      className={`status-select ${STATUS_COLORS[a.status]}`}
      aria-label={`Status for ${a.company} ${a.position}`}
      value={a.status}
      disabled={pending.includes(a.id)}
      onChange={async (e) => {
        setPending((p) => [...p, a.id]);
        try {
          await onStatus(a, e.target.value as Status);
        } finally {
          setPending((p) => p.filter((id) => id !== a.id));
        }
      }}
    >
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
  return (
    <>
      <div className="page-heading">
        <h1>{board ? "Application board" : "Applications"}</h1>
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} />
          Add application
        </button>
      </div>
      <section className="card application-workspace">
        <div className="applications-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search applications"
              placeholder="Search company, role, location, notes…"
              value={filters.search}
              onChange={(e) => change("search", e.target.value)}
            />
            {filters.search && (
              <button
                aria-label="Clear search"
                className="icon-button"
                onClick={() => change("search", "")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            className="button mobile-filters"
            aria-controls="application-filters"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal size={16} /> Filters &amp; sort
          </button>
          <div
            className="view-toggle"
            role="group"
            aria-label="Application view"
          >
            <button
              className={!board ? "active" : ""}
              aria-pressed={!board}
              onClick={() => onNavigate("applications")}
            >
              <List size={16} />
              Table
            </button>
            <button
              className={board ? "active" : ""}
              aria-pressed={board}
              onClick={() => onNavigate("board")}
            >
              <Columns3 size={16} />
              Board
            </button>
          </div>
        </div>
        <div
          id="application-filters"
          className={`filters-row ${filtersOpen ? "is-open" : ""}`}
        >
          <SlidersHorizontal size={16} className="filter-icon" />
          {(
            [
              ["status", "All statuses", STATUSES],
              ["priority", "All priorities", PRIORITIES],
              [
                "term",
                "All terms",
                [...new Set(records.map((a) => a.term).filter(Boolean))].sort(),
              ],
              ["arrangement", "All arrangements", ARRANGEMENTS],
            ] as const
          ).map(([key, label, values]) => (
            <select
              key={key}
              aria-label={`Filter ${key}`}
              value={filters[key]}
              onChange={(e) => change(key, e.target.value)}
            >
              <option value="">{label}</option>
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ))}
          <div className="spacer" />
          <select
            aria-label="Sort applications"
            value={filters.sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="updatedAt">Last updated</option>
            <option value="company">Company</option>
            <option value="deadline">Deadline</option>
            <option value="dateApplied">Date applied</option>
            <option value="nextActionDue">Next action date</option>
          </select>
          <button
            className="icon-button sort-direction"
            aria-label={`Sort ${filters.direction === "asc" ? "descending" : "ascending"}`}
            title={`Current order: ${filters.direction === "asc" ? "ascending" : "descending"}`}
            onClick={() =>
              change("direction", filters.direction === "asc" ? "desc" : "asc")
            }
          >
            <ArrowDownUp size={16} />
          </button>
        </div>
        <div className="result-summary">
          <span aria-live="polite">
            {filterActive
              ? `${filtered.length} of ${records.length} applications match your filters`
              : `${records.length} application${records.length === 1 ? "" : "s"}`}
          </span>
          {canReset && (
            <button
              className="text-link"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Reset filters &amp; sort <X size={13} />
            </button>
          )}
        </div>
        {!filtered.length ? (
          <EmptyState
            title={records.length ? "No applications match" : undefined}
            text={
              records.length
                ? "Try a different search or reset your filters to see all your opportunities."
                : undefined
            }
            onAdd={onAdd}
            reset={
              records.length ? () => setFilters(DEFAULT_FILTERS) : undefined
            }
          />
        ) : board ? (
          <div
            className="board-grid"
            role="region"
            aria-label="Application board by status"
            tabIndex={0}
          >
            {STATUSES.map((s) => (
              <section className="board-column" key={s}>
                <h2>
                  <span className={`legend-dot bar-${STATUS_COLORS[s]}`} />
                  {s}
                  <span>{filtered.filter((a) => a.status === s).length}</span>
                </h2>
                <div className="board-cards">
                  {filtered
                    .filter((a) => a.status === s)
                    .map((a) => (
                      <article className="board-card" key={a.id}>
                        <button
                          className="board-card-title"
                          aria-label={`Open ${a.company} ${a.position}`}
                          onClick={() => onOpen(a)}
                        >
                          <CompanyMark company={a.company} />
                          <span>
                            <strong>{a.company}</strong>
                            <span>{a.position}</span>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                        <div className="board-card-meta">
                          <span
                            className={`priority ${a.priority.toLowerCase()}`}
                          >
                            <span />
                            {a.priority}
                          </span>
                          {(a.nextActionDue || a.deadline) && (
                            <span>
                              <CalendarDays size={12} />
                              {formatDate(a.nextActionDue || a.deadline)}
                            </span>
                          )}
                        </div>
                        {statusControl(a)}
                      </article>
                    ))}
                  {!filtered.some((a) => a.status === s) && (
                    <div className="board-empty">No applications yet</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table role="table" className="applications-table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Company & role
                  </th>
                  <th scope="col" role="columnheader">
                    Status
                  </th>
                  <th scope="col" role="columnheader">
                    Priority
                  </th>
                  <th scope="col" role="columnheader">
                    Deadline
                  </th>
                  <th scope="col" role="columnheader">
                    Next action
                  </th>
                  <th scope="col" role="columnheader">
                    <span className="sr-only">Open application</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {filtered.map((a) => (
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
                          {(a.location || a.term) && (
                            <span className="cell-meta">
                              {[a.location, a.term].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td role="cell">
                      <span className="mobile-field" aria-hidden="true">
                        Status
                      </span>
                      {statusControl(a)}
                    </td>
                    <td role="cell">
                      <span className="mobile-field" aria-hidden="true">
                        Priority
                      </span>
                      <span className={`priority ${a.priority.toLowerCase()}`}>
                        <span />
                        {a.priority}
                      </span>
                    </td>
                    <td role="cell">
                      <span className="mobile-field" aria-hidden="true">
                        Deadline
                      </span>
                      {formatDate(a.deadline, true)}
                    </td>
                    <td role="cell">
                      <span className="mobile-field" aria-hidden="true">
                        Next action
                      </span>
                      <span className="cell-action">{a.nextAction || "—"}</span>
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
                        aria-label={`Edit ${a.company}`}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
