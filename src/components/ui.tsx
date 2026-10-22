"use client";
import { useEffect, useRef } from "react";
import { X, Plus, BriefcaseBusiness } from "lucide-react";
import type { Status } from "@/lib/domain";
export const STATUS_COLORS: Record<Status, string> = {
  Saved: "slate",
  Preparing: "amber",
  Applied: "blue",
  Assessment: "purple",
  Interview: "indigo",
  Offer: "green",
  Rejected: "red",
  Withdrawn: "slate",
};
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status]}`}>
      <span className="dot" />
      {status}
    </span>
  );
}
export function CompanyMark({ company }: { company: string }) {
  const palette = ["violet", "blue", "rose", "teal", "orange"];
  const color =
    palette[
      [...company].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length
    ];
  return (
    <span aria-hidden="true" className={`company-mark ${color}`}>
      {company
        .replace(/^Fictional\s+/i, "")
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function EmptyState({
  title = "Your next chapter starts here",
  text = "Add an internship you have your eye on. We’ll help you keep every opportunity and next step in one place.",
  onAdd,
}: {
  title?: string;
  text?: string;
  onAdd: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <BriefcaseBusiness size={27} strokeWidth={1.6} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="button primary" onClick={onAdd}>
        <Plus size={17} />
        Add application
      </button>
    </div>
  );
}
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok)
    throw Object.assign(
      new Error(body.error || "Something went wrong. Please try again."),
      body,
    );
  return body;
}
