"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Columns3,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
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

const NAV = [
  { key: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { key: "applications", label: "Applications", Icon: BriefcaseBusiness },
  { key: "board", label: "Board view", Icon: Columns3 },
  { key: "today", label: "Next actions", Icon: ListTodo },
  { key: "documents", label: "Documents", Icon: FolderOpen },
];
const TITLES: Record<string, string> = {
  dashboard: "Overview",
  applications: "Applications",
  board: "Board view",
  today: "Next actions",
  documents: "Documents",
  import: "Import & export",
  email: "Email integration",
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
    const sync = () => {
      const hash = window.location.hash.slice(1).split("?")[0];
      if (TITLES[hash]) setView(hash);
      else setView("dashboard");
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
    const previous = document.activeElement as HTMLElement | null;
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
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
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
    notify("Application saved. You’re one step closer.");
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
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <button
          className="icon-button mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <X size={18} />
        </button>
        <a
          href="#dashboard"
          className="brand"
          onClick={() => navigate("dashboard")}
        >
          <span className="brand-icon">
            <BriefcaseBusiness size={23} strokeWidth={1.8} />
            <span />
          </span>
          <span>
            Internship<span className="brand-hq">HQ</span>
          </span>
        </a>
        <div className="workspace-label">YOUR PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          <div className="nav-section-label">WORKSPACE</div>
          {NAV.map(({ key, label, Icon }) => (
            <a
              href={`#${key}`}
              key={key}
              aria-current={view === key ? "page" : undefined}
              className={`nav-item ${view === key ? "active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(key);
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {key === "applications" && (
                <span className="nav-count">{records.length}</span>
              )}
              {key === "today" && todayCount > 0 && (
                <span className="nav-count attention">{todayCount}</span>
              )}
            </a>
          ))}
          <div className="nav-section-label tools-label">TOOLS</div>
          <a
            href="#import"
            className={`nav-item ${view === "import" ? "active" : ""}`}
            aria-current={view === "import" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate("import");
            }}
          >
            <ArrowDownToLine size={19} />
            <span>Import & export</span>
          </a>
          <a
            href="#email"
            className={`nav-item ${view === "email" ? "active" : ""}`}
            aria-current={view === "email" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate("email");
            }}
          >
            <Mail size={19} />
            <span>Email integration</span>
            <span className="soon-pill">Soon</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-card">
            <span className="journey-spark">
              <Sparkles size={19} />
            </span>
            <h3>
              Big futures.
              <br />
              Small next steps.
            </h3>
            <p>Your next opportunity starts with showing up.</p>
            <div className="journey-line">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="local-profile">
            <div className="profile-avatar">YO</div>
            <div>
              <strong>Your workspace</strong>
              <span>
                <span className="tiny-dot" />
                {demo ? "Fictional demo data" : "Local & personal"}
              </span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{TITLES[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              <CalendarDays size={16} />
              {today &&
                new Intl.DateTimeFormat("en-CA", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${today}T12:00:00Z`))}
            </span>
            <span className="topbar-divider" />
            <span className="profile-avatar small-avatar">YO</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <Sparkles size={15} />
            <strong>Demo workspace</strong>
            <span>
              These companies and applications are fictional. Your personal
              database is separate.
            </span>
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
              {view === "email" && <EmailView />}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Made for the next chapter.</span>
          <span>
            InternshipHQ<span className="footer-dot">·</span>America/Toronto
          </span>
        </footer>
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
function EmailView() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE LESS ADMIN, SOMEDAY</div>
          <h1>Email, with you in control.</h1>
          <p>A look at what’s next for InternshipHQ.</p>
        </div>
        <span className="badge amber">Planned · Phase two</span>
      </div>
      <section className="card email-card">
        <div className="email-illustration">
          <div className="mail-orbit">
            <Mail size={42} strokeWidth={1.2} />
          </div>
          <span className="mail-check">
            <Check size={18} />
          </span>
        </div>
        <h2>
          Your inbox could help.
          <br />
          You’ll always have the final say.
        </h2>
        <p>
          Gmail integration is not connected or implemented yet. Today, you can
          save a source email link on any application and use CSV to bring in
          existing records.
        </p>
        <div className="email-flow">
          <div>
            <span>01</span>
            <h3>Connect securely</h3>
            <p>A future OAuth flow with read-only access.</p>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>02</span>
            <h3>Review suggestions</h3>
            <p>See the source email and supporting evidence.</p>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>03</span>
            <h3>You decide</h3>
            <p>Accept, edit, or dismiss every suggested update.</p>
          </div>
        </div>
        <div className="email-footnote">
          <ShieldCheck size={18} />
          <p>
            No inbox access, background checks, or email sending is active.
            ChatGPT’s Gmail connection is separate from this app.
          </p>
        </div>
      </section>
    </>
  );
}
