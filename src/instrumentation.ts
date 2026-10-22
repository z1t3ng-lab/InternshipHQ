export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startBackupScheduler } = await import("./lib/backups");
    startBackupScheduler();
    const { startGmailScheduler } = await import("./lib/email/gmail");
    startGmailScheduler();
  }
}
