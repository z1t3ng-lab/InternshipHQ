"use client";
import { useEffect, useState } from "react";
import { ArchiveRestore, Download, ShieldCheck } from "lucide-react";
import { request, Modal } from "./ui";
import { formatTimestamp } from "@/lib/domain";
import { fileSize } from "@/lib/document-types";
type Backup = { name: string; kind: string; createdAt: string; size: number };
type BackupState = {
  settings: {
    enabled: boolean;
    lastSuccess?: string;
    lastAttempt?: string;
    error?: string;
  };
  directory: string;
  backups: Backup[];
};
type Preview = { name: string; counts: Record<string, number> };
export function BackupsView({
  onRestored,
}: {
  onRestored: () => Promise<void>;
}) {
  const [data, setData] = useState<BackupState>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [confirmation, setConfirmation] = useState("");
  async function load() {
    setData(await request<BackupState>("/api/backups"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
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
  const previewName = (name: string) =>
    action(async () => {
      setConfirmation("");
      setPreview(
        await request<Preview>(`/api/backups?name=${encodeURIComponent(name)}`),
      );
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SAFETY NET FOR YOUR PROGRESS</div>
          <h1>Backups & restore</h1>
          <p>
            Your applications, document files, interviews, and email reviews
            together.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await request("/api/backups", {
                method: "POST",
                body: JSON.stringify({ action: "create" }),
              });
              await load();
              setNotice(
                "Backup created, including all uploaded document files.",
              );
            })
          }
        >
          <ShieldCheck size={17} aria-hidden="true" />
          {busy ? "Working…" : "Back up now"}
        </button>
      </div>
      {error && (
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
        <h2>Automatic local backups</h2>
        <p>
          A backup is made every 24 hours while InternshipHQ is running, with a
          catch-up on the next launch. The latest 14 automatic copies are kept.
          Manual and recovery copies stay until you remove them from the folder.
        </p>
        {data ? (
          <>
            <label className="check-line">
              <input
                type="checkbox"
                checked={data.settings.enabled}
                disabled={busy}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void action(async () => {
                    await request("/api/backups", {
                      method: "POST",
                      body: JSON.stringify({ action: "settings", enabled }),
                    });
                    await load();
                  });
                }}
              />
              Enable automatic backups
            </label>
            <p className="muted">
              Last successful automatic backup:{" "}
              {data.settings.lastSuccess
                ? formatTimestamp(data.settings.lastSuccess)
                : "None yet"}
            </p>
            {data.settings.error && (
              <p className="notice error" role="alert">
                {data.settings.error}
              </p>
            )}
            <p className="small muted break-text">
              Local folder: {data.directory}
            </p>
          </>
        ) : (
          <p role="status">Loading backups…</p>
        )}
        <p className="muted small">
          These copies stay on this Mac. Download a copy to another drive for
          protection against a lost or damaged Mac.
        </p>
      </section>
      <section className="card feature-panel">
        <div className="feature-row">
          <div>
            <h2>Restore a saved workspace</h2>
            <p>
              Preview a backup before restoring. A recovery copy of the current
              workspace is created automatically.
            </p>
          </div>
          <label className="button">
            Import backup file
            <input
              className="file-overlay"
              aria-label="Import backup file"
              type="file"
              accept=".db,.sqlite,.sqlite3,application/octet-stream"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void action(async () => {
                    if (file.size > 250 * 1024 * 1024)
                      throw new Error("Choose a backup no larger than 250 MB.");
                    const response = await fetch("/api/backups/import", {
                      method: "POST",
                      body: file,
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    setConfirmation("");
                    setPreview(result);
                    await load();
                  });
              }}
            />
          </label>
        </div>
        <div className="feature-list">
          {data?.backups.length === 0 && (
            <p className="empty-inline">
              No backups yet. Create your first copy with Back up now.
            </p>
          )}
          {data?.backups.map((b) => (
            <article className="feature-row" key={b.name}>
              <div>
                <h3>
                  {b.kind === "auto"
                    ? "Automatic"
                    : b.kind === "recovery"
                      ? "Before restore"
                      : b.kind === "import"
                        ? "Imported"
                        : "Manual"}{" "}
                  backup
                </h3>
                <p>
                  {formatTimestamp(b.createdAt)} · {fileSize(b.size)}
                </p>
                <p className="small muted break-text">{b.name}</p>
              </div>
              <div className="button-row">
                <a
                  className="button"
                  href={`/api/backups?name=${encodeURIComponent(b.name)}&download=1`}
                  download
                  aria-label={`Download ${b.name}`}
                >
                  <Download size={16} aria-hidden="true" />
                  Download
                </a>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => previewName(b.name)}
                  aria-label={`Preview & restore ${b.name}`}
                >
                  <ArchiveRestore size={16} aria-hidden="true" />
                  Preview & restore
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {preview && (
        <Modal
          title="Restore this backup?"
          subtitle="Restoring replaces the whole workspace with the saved copy."
          onClose={() => {
            if (!busy) setPreview(undefined);
          }}
        >
          <div className="feature-panel">
            <p className="break-text small">{preview.name}</p>
            <dl className="count-grid">
              {Object.entries(preview.counts).map(([label, n]) => (
                <div key={label}>
                  <dt>
                    {
                      (
                        {
                          Application: "Applications",
                          Document: "Document versions",
                          Activity: "History entries",
                          Interview: "Interviews",
                          StatusEvent: "Status events",
                          EmailReview: "Email reviews",
                          GmailMessage: "Processed Gmail messages",
                        } as Record<string, string>
                      )[label]
                    }
                  </dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>
            <p>
              Your current workspace will be saved as a “Before restore” backup.
              You can restore that copy to undo this change.
            </p>
            <label className="field">
              Type RESTORE to confirm
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="button-row">
              <button
                className="button"
                disabled={busy}
                onClick={() => setPreview(undefined)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || confirmation !== "RESTORE"}
                onClick={() =>
                  action(async () => {
                    await request("/api/backups", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "restore",
                        name: preview.name,
                        confirmation,
                      }),
                    });
                    setPreview(undefined);
                    await onRestored();
                    await load();
                    setNotice(
                      "Workspace restored. A Before restore backup is available if you need to undo it.",
                    );
                  })
                }
              >
                {busy ? "Restoring…" : "Restore workspace"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
