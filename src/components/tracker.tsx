"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArchiveRestore,
  BarChart3,
  ArrowDownToLine,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Columns3,
  Files,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  ListTodo,
  Mail,
  Menu,
  X,
} from "lucide-react";
import {
  todayInToronto,
  tasksFor,
  type ApplicationRecord,
  type Status,
} from "@/lib/domain";
import { Dashboard, TodayPage } from "./dashboard";
import { ApplicationsView } from "./applications-view";
import { ApplicationForm, CompleteAction } from "./application-form";
import { ImportView } from "./import-view";
import { request } from "./ui";
import { DocumentsView } from "./documents-view";
import { DocumentUsageView } from "./document-usage-view";
import { InterviewsView } from "./interviews-view";
import { BackupsView } from "./backups-view";
import { InsightsView } from "./insights-view";
import { EmailView } from "./email-view";

const NAV_GROUPS = [
  [
    { key: "dashboard", label: "Overview", Icon: LayoutDashboard },
    { key: "applications", label: "Applications", Icon: BriefcaseBusiness },
    { key: "board", label: "Board view", Icon: Columns3 },
    { key: "today", label: "Next actions", Icon: ListTodo },
    { key: "interviews", label: "Interviews", Icon: CalendarDays },
  ],
  [
    { key: "documents", label: "Documents", Icon: FolderOpen },
    { key: "document-usage", label: "Document usage", Icon: Files },
    { key: "email", label: "Email updates", Icon: Mail },
    { key: "insights", label: "Insights", Icon: BarChart3 },
  ],
  [
    { key: "import", label: "Import & export", Icon: ArrowDownToLine },
    { key: "backups", label: "Backups & restore", Icon: ArchiveRestore },
  ],
];
const TITLES: Record<string, string> = {
  dashboard: "Overview",
  applications: "Applications",
  board: "Board view",
  today: "Next actions",
  documents: "Documents",
  import: "Import & export",
  email: "Email updates",
  interviews: "Interview planner",
  "document-usage": "Document usage",
  insights: "Application insights",
  backups: "Backups & restore",
};
export function Tracker({ demo }: { demo: boolean }) {
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("dashboard");
  const [today, setToday] = useState("");
  const [editing, setEditing] = useState<ApplicationRecord | "new" | null>(
    null,
  );
  const [completing, setCompleting] = useState<ApplicationRecord | null>(null);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const notify = useCallback((text: string, error = false) => {
    setToast(text);
    setToastError(error);
  }, []);
  const refresh = useCallback(async () => {
    try {
      setLoadError("");
      setRecords(await request<ApplicationRecord[]>("/api/applications"));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => setToday(todayInToronto());
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    // The macOS menu uses the same editor as the on-screen Add button.
    const openNewApplication = () => setEditing("new");
    window.addEventListener("internshiphq:add", openNewApplication);
    return () =>
      window.removeEventListener("internshiphq:add", openNewApplication);
  }, []);
  useEffect(() => {
    const sync = (event?: HashChangeEvent) => {
      const hash = window.location.hash.slice(1).split("?")[0];
      if (TITLES[hash]) setView(hash);
      else setView("dashboard");
      if (event) {
        setMobileNav(false);
        requestAnimationFrame(() => {
          document
            .getElementById("main-content")
            ?.focus({ preventScroll: true });
          window.scrollTo(0, 0);
        });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!toast || toastError) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast, toastError]);
  useEffect(() => {
    if (!mobileNav) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    const trigger = document.querySelector<HTMLButtonElement>(".mobile-menu");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(sidebar.querySelectorAll<HTMLElement>("a,button")).filter(
        (el) => el.getClientRects().length > 0,
      );
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
      if (event.key !== "Tab") return;
      const items = focusables();
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      }
      if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnResize = () => {
      if (desktop.matches) setMobileNav(false);
    };
    desktop.addEventListener("change", closeOnResize);
    document.addEventListener("keydown", trap);
    return () => {
      desktop.removeEventListener("change", closeOnResize);
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileNav]);
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    const id = params.get("application");
    if (id) {
      const a = records.find((a) => a.id === id);
      if (a) setEditing(a);
    }
  }, [loading]); // Resolve an initial shared record URL once records load.
  function navigate(next: string) {
    window.location.hash = next;
    setView(next);
    setMobileNav(false);
  }
  useEffect(() => {
    document.title = TITLES[view] + " · InternshipHQ";
  }, [view]);
  function open(a: ApplicationRecord) {
    setEditing(a);
    window.history.replaceState(
      null,
      "",
      `#${view}?application=${encodeURIComponent(a.id)}`,
    );
  }
  function close() {
    setEditing(null);
    window.history.replaceState(null, "", `#${view}`);
  }
  function saved(a: ApplicationRecord) {
    setRecords((r) => [a, ...r.filter((x) => x.id !== a.id)]);
    close();
    setCompleting(null);
    notify("Application saved.");
  }
  async function status(a: ApplicationRecord, s: Status) {
    try {
      const result = await request<ApplicationRecord>(
        `/api/applications/${a.id}`,
        { method: "PATCH", body: JSON.stringify({ data: { status: s } }) },
      );
      setRecords((r) => r.map((x) => (x.id === a.id ? result : x)));
      notify(`Moved ${a.company} to ${s}.`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const todayCount = today
    ? tasksFor(records, today).filter((t) => t.group !== "Next 7 days").length
    : 0;
  const props = {
    records,
    today,
    onAdd: () => setEditing("new"),
    onOpen: open,
    onComplete: (a: ApplicationRecord) => {
      setRecords((current) =>
        current.map((record) => (record.id === a.id ? a : record)),
      );
      close();
      setCompleting(a);
    },
    onNavigate: navigate,
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-scrim"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? "is-open" : ""}`}
        role={mobileNav ? "dialog" : undefined}
        aria-modal={mobileNav || undefined}
        aria-label="Workspace navigation"
      >
        <div className="brand-row">
          <a
            href="#dashboard"
            className="brand"
            onClick={(event) => {
              event.preventDefault();
              navigate("dashboard");
            }}
          >
            <span className="ledger-mark" aria-hidden="true">
              <i />
            </span>
            <span>
              Internship<span className="brand-hq">HQ</span>
            </span>
          </a>
          <button
            className="icon-button mobile-nav-close"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <ul className="nav-group" key={group[0].key}>
              {group.map(({ key, label, Icon }) => (
                <li key={key}>
                  <a
                    href={`#${key}`}
                    aria-current={view === key ? "page" : undefined}
                    className={`nav-item ${view === key ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(key);
                    }}
                  >
                    <Icon size={18} strokeWidth={1.65} aria-hidden="true" />
                    <span>{label}</span>
                    {key === "applications" && !loading && !loadError && (
                      <span className="nav-count">{records.length}</span>
                    )}
                    {key === "today" && todayCount > 0 && (
                      <span className="nav-count attention">{todayCount}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </nav>
        <div className="sidebar-foot">
          <HardDrive size={16} aria-hidden="true" />
          {demo ? "Demo workspace" : "Local workspace"}
        </div>
      </aside>
      <div className="main-shell" inert={mobileNav}>
        <header className="topbar">
          <div className="mobile-topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-controls="workspace-navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              Internship<span className="mobile-hq">HQ</span>
            </span>
          </div>
          {today && (
            <time
              className="today-date"
              dateTime={today}
              title="America/Toronto"
            >
              <CalendarDays size={15} aria-hidden="true" />
              {new Intl.DateTimeFormat("en-CA", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(today + "T12:00:00Z"))}
            </time>
          )}
        </header>
        {demo && (
          <div className="demo-banner">
            <strong>Demo workspace</strong> Fictional applications in a separate
            database.
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {loadError ? (
            <div role="alert" className="notice error">
              <h2>Couldn’t load your workspace</h2>
              <p>{loadError}</p>
              <p>
                For first-time setup, run <code>npm run db:init</code> in the
                project folder.
              </p>
              <button className="button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : loading || !today ? (
            <div className="loading-state" role="status">
              <div className="loading-dot" />
              Getting your workspace ready…
            </div>
          ) : (
            <>
              {view === "dashboard" && <Dashboard {...props} />}
              {(view === "applications" || view === "board") && (
                <ApplicationsView
                  records={records}
                  board={view === "board"}
                  onNavigate={navigate}
                  onAdd={props.onAdd}
                  onOpen={open}
                  onStatus={status}
                />
              )}
              {view === "today" && <TodayPage {...props} />}
              {view === "documents" && <DocumentsView records={records} />}
              {view === "import" && <ImportView onImported={refresh} />}
              {view === "email" && (
                <EmailView
                  records={records}
                  onChanged={refresh}
                  onOpen={open}
                />
              )}
              {view === "interviews" && (
                <InterviewsView
                  records={records}
                  onChanged={refresh}
                  onOpen={open}
                />
              )}
              {view === "document-usage" && (
                <DocumentUsageView records={records} onOpen={open} />
              )}
              {view === "insights" && (
                <InsightsView records={records} today={today} onOpen={open} />
              )}
              {view === "backups" && <BackupsView onRestored={refresh} />}
            </>
          )}
        </main>
      </div>
      {editing && (
        <ApplicationForm
          key={editing === "new" ? "new" : editing.id}
          record={editing === "new" ? undefined : editing}
          onClose={close}
          onSaved={saved}
          onDeleted={(id) => {
            setRecords((r) => r.filter((a) => a.id !== id));
            close();
            notify("Application deleted.");
          }}
          onComplete={props.onComplete}
        />
      )}
      {completing && (
        <CompleteAction
          record={completing}
          onClose={() => setCompleting(null)}
          onSaved={(a) => {
            saved(a);
            notify("Action completed and recorded in your history.");
          }}
        />
      )}
      {toast && (
        <div
          className={`toast ${toastError ? "toast-error" : ""}`}
          role={toastError ? "alert" : "status"}
        >
          {!toastError && <CheckCircle2 size={19} />}
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
