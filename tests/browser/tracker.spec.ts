import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  const rows = await (await request.get("/api/applications")).json();
  for (const row of rows)
    await request.delete(`/api/applications/${row.id}`, { data: {} });
});

test("create, validate, edit, status history, complete action, duplicate warning, and confirmed delete", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(
    dialog.getByText("Company is required.", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Company", { exact: false })
    .fill("Fictional Test Co");
  await dialog.getByLabel("Position", { exact: false }).fill("Software Intern");
  await dialog
    .getByLabel("Notes", { exact: true })
    .fill("Preserve these notes");
  await dialog
    .getByLabel("Application deadline", { exact: true })
    .fill("2027-01-12");
  await dialog.getByLabel("Next action", { exact: true }).fill("Tailor resume");
  await dialog
    .getByLabel("Next action due", { exact: true })
    .fill("2026-01-01");
  await dialog
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Fictional Test Co", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Applications/ }).click();
  await page
    .getByRole("combobox", {
      name: "Status for Fictional Test Co Software Intern",
    })
    .selectOption("Interview");
  await expect(page.getByRole("status")).toContainText(
    "Moved Fictional Test Co to Interview",
  );
  await page.getByRole("button", { name: "Edit Fictional Test Co" }).click();
  await expect(dialog.getByLabel("Notes", { exact: true })).toHaveValue(
    "Preserve these notes",
  );
  await expect(
    dialog.getByLabel("Application deadline", { exact: true }),
  ).toHaveValue("2027-01-12");
  await expect(
    dialog.getByText("Status changed from Saved to Interview"),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Save & complete current action" })
    .click();
  await page.getByLabel("Next action (optional)").fill("Prepare questions");
  await page
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Edit Fictional Test Co" }).click();
  await expect(dialog.getByText(/Completed: Tailor resume/)).toBeVisible();
  await expect(dialog.getByLabel("Next action", { exact: true })).toHaveValue(
    "Prepare questions",
  );
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    dialog.getByText(
      "This permanently deletes the application and its activity history.",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Keep application" }).click();
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue(
    "Fictional Test Co",
  );
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Yes, delete application" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Your next chapter starts here")).toBeVisible();
});

test("filter combinations, board movement, counts, import preview and CSV export", async ({
  page,
  request,
}) => {
  for (const data of [
    {
      company: "Fictional Alpha",
      position: "Intern",
      location: "Toronto",
      status: "Saved",
      priority: "High",
      term: "Summer 2027",
      arrangement: "Remote",
    },
    {
      company: "Fictional Beta",
      position: "Designer",
      location: "Toronto",
      status: "Applied",
      priority: "High",
      term: "Summer 2027",
      arrangement: "Remote",
      dateApplied: "2026-10-01",
    },
    {
      company: "Fictional Gamma",
      position: "Intern",
      priority: "Low",
      status: "Offer",
    },
  ])
    expect(
      (await request.post("/api/applications", { data: { data } })).ok(),
    ).toBeTruthy();
  await page.goto("/#applications");
  await page
    .getByRole("textbox", { name: "Search applications" })
    .fill("toronto");
  await page.getByLabel("Filter priority").selectOption("High");
  await page.getByLabel("Filter term").selectOption("Summer 2027");
  await page.getByLabel("Filter arrangement").selectOption("Remote");
  await page.getByLabel("Filter status").selectOption("Saved");
  await expect(
    page.getByText("1 of 3 applications match your filters"),
  ).toBeVisible();
  await page.getByLabel("Sort applications").selectOption("company");
  await page.getByRole("button", { name: "Reset filters & sort" }).click();
  await expect(
    page.getByText("3 of 3 applications in your workspace"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Status for Fictional Alpha Intern" })
    .selectOption("Interview");
  await expect(page.getByRole("status")).toContainText(
    "Moved Fictional Alpha to Interview",
  );
  await page.getByRole("link", { name: "Overview" }).click();
  const stats = page.locator(".stat-card");
  await expect(stats.nth(0).locator("strong")).toHaveText("03");
  await expect(stats.nth(1).locator("strong")).toHaveText("02");
  await expect(stats.nth(2).locator("strong")).toHaveText("01");
  await expect(stats.nth(3).locator("strong")).toHaveText("01");
  await expect(stats.nth(4).locator("strong")).toHaveText("01");
  await page.getByRole("link", { name: "Import & export" }).click();
  await page.getByLabel("Upload CSV file").setInputFiles({
    name: "migration.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'Company Name,Role,deadline,notes\nFictional Alpha,Intern,,duplicate\nFictional Delta,Intern,2027-02-30,bad date\n"Fictional Epsilon, Studio",Intern,,"Line one\nLine two"',
    ),
  });
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByText("Skip · duplicate")).toBeVisible();
  await expect(page.getByText("Skip · invalid")).toBeVisible();
  await expect(
    page.getByText("Ready to import", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import applications", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Imported" }),
  ).toContainText("Imported 1 application. Skipped 2 rows.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export all applications" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "internshiphq-backup.csv",
  );
});

test("keyboard navigation, dialog focus and accessibility on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Add application", exact: true }).first(),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add application", exact: true }).first(),
  ).toBeFocused();
  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    desktop.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/desktop-empty.png",
    fullPage: true,
  });
  for (const size of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    if (size.width === 375) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: /^Applications/ }).click();
      await expect(
        page.getByRole("heading", { name: /Your applications/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: "Overview" }).click();
      const mobile = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        mobile.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            message: n.failureSummary,
          })),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: "test-results/mobile-empty.png",
        fullPage: true,
      });
    }
  }
});

test("populated screens remain accessible and fit mobile; duplicate warning keeps user input", async ({
  page,
  request,
}) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  for (const [i, status] of [
    "Saved",
    "Preparing",
    "Applied",
    "Assessment",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
  ].entries()) {
    const result = await request.post("/api/applications", {
      data: {
        data: {
          company: `Fictional Studio ${i + 1}`,
          position: "Engineering Intern",
          status,
          priority: ["Low", "Medium", "High"][i % 3],
          nextAction: "Review my project notes",
          nextActionDue: today,
          deadline: today,
          dateApplied: i > 1 ? today : "",
          term: "Summer 2027",
          notes: "Fictional test record",
          jobUrl: `https://example.com/job/${i}`,
        },
      },
    });
    expect(result.ok()).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const view of [
    "dashboard",
    "applications",
    "board",
    "today",
    "import",
    "email",
  ]) {
    await page.goto(`/#${view}`);
    await expect(page.locator("main h1")).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          message: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    if (view === "dashboard")
      await page.screenshot({
        path: "test-results/desktop-populated.png",
        fullPage: true,
      });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    if (view === "applications")
      await page.screenshot({
        path: "test-results/mobile-populated.png",
        fullPage: true,
      });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("/#applications");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Company", { exact: false })
    .fill("Fictional Studio 1");
  await dialog
    .getByLabel("Position", { exact: false })
    .fill("Engineering Intern");
  await dialog
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "A similar application already exists",
  );
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue(
    "Fictional Studio 1",
  );
  const modalAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    modalAudit.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await dialog
    .getByRole("button", { name: "Save as separate application" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("9 of 9 applications in your workspace"),
  ).toBeVisible();
});
