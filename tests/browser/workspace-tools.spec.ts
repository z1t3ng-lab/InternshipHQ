import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  for (const a of await (await request.get("/api/applications")).json())
    await request.delete(`/api/applications/${a.id}`, { data: {} });
});

test("plan and edit an interview, inspect document usage, and read honest funnel metrics", async ({
  page,
  request,
}) => {
  const doc = await (
    await request.post("/api/documents", {
      multipart: {
        name: "Usage CV",
        version: "v1",
        kind: "CV",
        file: {
          name: "cv.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.7\nusage fixture"),
        },
      },
    })
  ).json();
  const app = await (
    await request.post("/api/applications", {
      data: {
        data: {
          company: "Planner Test",
          position: "Research Intern",
          status: "Applied",
          dateApplied: "2026-10-01",
          resumeDocumentId: doc.id,
        },
      },
    })
  ).json();
  await page.goto("/#interviews");
  await page
    .getByRole("button", { name: "Plan interview", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Round / title").fill("Research discussion");
  await dialog.getByLabel("Date and time").fill("2027-04-12T10:30");
  await dialog.getByLabel("Time zone", { exact: true }).fill("Europe/Paris");
  await dialog.getByLabel("Meeting URL").fill("https://example.test/interview");
  await dialog
    .getByLabel("Preparation", { exact: true })
    .fill("Read the team's recent project");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Save interview" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Research discussion", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Europe/Paris · 60 minutes")).toBeVisible();
  await page.getByRole("button", { name: "Edit interview" }).click();
  await dialog.getByLabel("Interview state").selectOption("Completed");
  await dialog.getByLabel("Notes & follow-up").fill("Send thank you note");
  await dialog.getByRole("button", { name: "Save interview" }).click();
  await page.getByLabel("Show interviews").selectOption("past");
  await expect(
    page.getByText("Send thank you note", { exact: true }),
  ).toBeVisible();
  await page.goto(`/#document-usage?document=${doc.id}`);
  await expect(
    page.getByRole("button", { name: "Planner Test · Research Intern" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Planner Test · Research Intern" })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await request.patch(`/api/applications/${app.id}`, {
    data: { data: { status: "Interview" } },
  });
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application funnel" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Application funnel" }),
  ).toBeVisible();
  await expect(page.getByText("Median · 1 dated sample").first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("email review changes only accepted fields and preserves duplicate decisions", async ({
  page,
  request,
}) => {
  const app = await (
    await request.post("/api/applications", {
      data: {
        data: {
          company: "Email Test",
          position: "Design Intern",
          status: "Applied",
          notes: "Preserve notes",
        },
      },
    })
  ).json();
  await page.goto("/#email");
  await page
    .getByText("Paste an email or import an .eml file", { exact: true })
    .click();
  await page
    .getByLabel("Email subject", { exact: true })
    .fill("Email Test interview invitation");
  await page
    .getByLabel("Email text", { exact: true })
    .fill("We invite you to an interview for Design Intern.");
  await page.getByRole("button", { name: "Review pasted email" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Proposed status")).toHaveValue("Interview");
  expect(
    (await (await request.get("/api/applications")).json())[0].status,
  ).toBe("Applied");
  await dialog.getByLabel("Apply to application").selectOption(app.id);
  await dialog
    .getByLabel("Next action (optional)")
    .fill("Confirm interview time");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Accept update" }).click();
  await expect(dialog).not.toBeVisible();
  let apps = await (await request.get("/api/applications")).json();
  expect(apps[0].status).toBe("Interview");
  expect(apps[0].notes).toBe("Preserve notes");
  expect(apps[0].nextAction).toBe("Confirm interview time");
  await page.getByRole("button", { name: "Review pasted email" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "already accepted" }),
  ).toBeVisible();
  await page.getByLabel("Review state").selectOption("accepted");
  await expect(
    page.getByRole("heading", {
      name: "Email Test interview invitation",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Import .eml", { exact: true })
    .setInputFiles({
      name: "reply.eml",
      mimeType: "message/rfc822",
      buffer: Buffer.from(
        "From: jobs@example.test\nSubject: French confirmation\nContent-Type: text/plain; charset=UTF-8\n\nNous avons bien reçu votre candidature.",
      ),
    });
  await expect(dialog.getByLabel("Proposed status")).toHaveValue("Applied");
  await dialog.getByRole("button", { name: "Dismiss suggestion" }).click();
  await expect(dialog).not.toBeVisible();
  apps = await (await request.get("/api/applications")).json();
  expect(apps[0].status).toBe("Interview");
  await page
    .getByLabel("Import Google client JSON")
    .setInputFiles({
      name: "wrong.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"web":{}}'),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Desktop app client" }),
  ).toBeVisible();
});

test("backup preview, restore confirmation, downloaded copy, and recovery undo", async ({
  page,
  request,
}) => {
  await request.post("/api/applications", {
    data: { data: { company: "Backup baseline", position: "Intern" } },
  });
  await page.goto("/#backups");
  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Backup created" }),
  ).toBeVisible();
  const data = await (await request.get("/api/backups")).json();
  const backup = data.backups.find(
    (b: { kind: string }) => b.kind === "manual",
  );
  expect(
    (
      await request.get(`/api/backups?name=${backup.name}&download=1`)
    ).headers()["content-disposition"],
  ).toContain(backup.name);
  await request.post("/api/applications", {
    data: { data: { company: "After backup", position: "Intern" } },
  });
  await page
    .getByRole("button", {
      name: `Preview & restore ${backup.name}`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Restore workspace" }),
  ).toBeDisabled();
  await dialog.getByLabel("Type RESTORE to confirm").fill("RESTORE");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Restore workspace" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await (await request.get("/api/applications")).json()).length).toBe(
    1,
  );
  await expect(
    page.getByRole("heading", { name: "Before restore backup" }).first(),
  ).toBeVisible();
  const copies = await (await request.get("/api/backups")).json();
  const recovery = copies.backups.find(
    (b: { kind: string }) => b.kind === "recovery",
  );
  await page
    .getByRole("button", {
      name: `Preview & restore ${recovery.name}`,
      exact: true,
    })
    .click();
  await dialog.getByLabel("Type RESTORE to confirm").fill("RESTORE");
  await dialog.getByRole("button", { name: "Restore workspace" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await (await request.get("/api/applications")).json()).length).toBe(
    2,
  );
  const rejected = await request.post("/api/backups", {
    headers: { origin: "https://unrelated.test" },
    data: { action: "restore", name: backup.name, confirmation: "RESTORE" },
  });
  expect(rejected.status()).toBe(403);
  await page
    .getByLabel("Import backup file", { exact: true })
    .setInputFiles({
      name: "bad.db",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a database"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "SQLite backup" }),
  ).toBeVisible();
});

test("all new screens fit mobile and expose accessible controls", async ({
  page,
}) => {
  for (const route of [
    "backups",
    "interviews",
    "document-usage",
    "insights",
    "email",
  ]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      route,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});
