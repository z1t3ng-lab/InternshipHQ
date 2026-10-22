ALTER TABLE "Application" ADD COLUMN "transcript" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Application" ADD COLUMN "resumeDocumentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Application" ADD COLUMN "letterDocumentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Application" ADD COLUMN "transcriptDocumentId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Document_kind_archived_idx" ON "Document"("kind", "archived");
