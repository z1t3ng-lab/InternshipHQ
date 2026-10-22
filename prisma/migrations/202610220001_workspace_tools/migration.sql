CREATE TABLE "Interview" (
 "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "startAt" DATETIME NOT NULL, "timeZone" TEXT NOT NULL, "duration" INTEGER NOT NULL DEFAULT 60,
 "interviewer" TEXT NOT NULL DEFAULT '', "location" TEXT NOT NULL DEFAULT '', "meetingUrl" TEXT NOT NULL DEFAULT '',
 "preparation" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "state" TEXT NOT NULL DEFAULT 'Scheduled',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Interview_startAt_idx" ON "Interview"("startAt");
CREATE TABLE "StatusEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "status" TEXT NOT NULL,
 "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StatusEvent_applicationId_occurredAt_idx" ON "StatusEvent"("applicationId", "occurredAt");
CREATE TABLE "EmailReview" (
 "id" TEXT NOT NULL PRIMARY KEY, "fingerprint" TEXT NOT NULL, "subject" TEXT NOT NULL,
 "sender" TEXT NOT NULL DEFAULT '', "body" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL DEFAULT '',
 "evidence" TEXT NOT NULL DEFAULT '', "proposedStatus" TEXT NOT NULL DEFAULT '', "state" TEXT NOT NULL DEFAULT 'pending',
 "applicationId" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" DATETIME
);
CREATE UNIQUE INDEX "EmailReview_fingerprint_key" ON "EmailReview"("fingerprint");
CREATE TABLE "GmailMessage" ("key" TEXT NOT NULL PRIMARY KEY, "messageId" TEXT NOT NULL, "reviewId" TEXT NOT NULL DEFAULT '', "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
