CREATE TABLE "Application" (
 "id" TEXT NOT NULL PRIMARY KEY, "company" TEXT NOT NULL, "position" TEXT NOT NULL,
 "jobUrl" TEXT NOT NULL DEFAULT '', "location" TEXT NOT NULL DEFAULT '',
 "arrangement" TEXT NOT NULL DEFAULT 'Unspecified', "term" TEXT NOT NULL DEFAULT '',
 "deadline" TEXT NOT NULL DEFAULT '', "dateApplied" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'Saved', "priority" TEXT NOT NULL DEFAULT 'Medium',
 "nextAction" TEXT NOT NULL DEFAULT '', "nextActionDue" TEXT NOT NULL DEFAULT '',
 "contactName" TEXT NOT NULL DEFAULT '', "contactEmail" TEXT NOT NULL DEFAULT '',
 "resume" TEXT NOT NULL DEFAULT '', "coverLetter" TEXT NOT NULL DEFAULT '',
 "notes" TEXT NOT NULL DEFAULT '', "sourceEmailUrl" TEXT NOT NULL DEFAULT '',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Activity" (
 "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "type" TEXT NOT NULL,
 "message" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Activity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE INDEX "Activity_applicationId_createdAt_idx" ON "Activity"("applicationId", "createdAt");
