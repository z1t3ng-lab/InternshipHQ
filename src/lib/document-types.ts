export const DOCUMENT_KINDS = [
  "CV",
  "Cover letter",
  "Motivation letter",
  "Transcript",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type DocumentRecord = {
  id: string;
  name: string;
  version: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  archived: boolean;
  createdAt: string;
};
export const DOCUMENT_SLOTS = [
  {
    id: "resumeDocumentId",
    snapshot: "resume",
    label: "CV / resume",
    kinds: ["CV"],
  },
  {
    id: "letterDocumentId",
    snapshot: "coverLetter",
    label: "Cover / motivation letter",
    kinds: ["Cover letter", "Motivation letter"],
  },
  {
    id: "transcriptDocumentId",
    snapshot: "transcript",
    label: "Grade transcript",
    kinds: ["Transcript"],
  },
] as const;
export function documentLabel(
  doc: Pick<DocumentRecord, "name" | "version" | "fileName">,
) {
  return `${doc.name} · ${doc.version} (${doc.fileName})`;
}
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
