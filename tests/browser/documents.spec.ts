import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const fixture = Buffer.from("%PDF-1.7\nFictional document test only\n%%EOF");
test("upload immutable versions, select CV/letter/transcript, download originals, archive and restore", async ({
  page,
  request,
}) => {
  await page.goto("/#documents");
  await expect(
    page.getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upload version", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a document name" }),
  ).toBeVisible();
  for (const [kind, name, version] of [
    ["CV", "Engineering CV", "v1"],
    ["CV", "Engineering CV", "v2"],
    ["Motivation letter", "Research letter", "v1"],
    ["Transcript", "Grade transcript", "Fall 2026"],
  ]) {
    await page.getByLabel("Document type", { exact: true }).selectOption(kind);
    await page.getByLabel("Document name", { exact: true }).fill(name);
    await page.getByLabel("Version label", { exact: true }).fill(version);
    await page.getByLabel("PDF or DOCX file", { exact: true }).setInputFiles({
      name: `${name}.pdf`,
      mimeType: "application/pdf",
      buffer: fixture,
    });
    await page
      .getByRole("button", { name: "Upload version", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      `Uploaded ${name} · ${version}`,
    );
  }
  const docs = await (await request.get("/api/documents")).json();
  const cv1 = docs.find(
    (d: { name: string; version: string }) =>
      d.name === "Engineering CV" && d.version === "v1",
  );
  const cv2 = docs.find(
    (d: { name: string; version: string }) =>
      d.name === "Engineering CV" && d.version === "v2",
  );
  const letter = docs.find(
    (d: { name: string }) => d.name === "Research letter",
  );
  const transcript = docs.find(
    (d: { name: string }) => d.name === "Grade transcript",
  );
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download Engineering CV v1", exact: true })
    .click();
  const download = await downloadEvent;
  expect(await readFile((await download.path())!)).toEqual(fixture);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Company", { exact: false })
    .fill("Fictional Document Company");
  await dialog.getByLabel("Position", { exact: false }).fill("Research Intern");
  await dialog.getByLabel("CV / resume", { exact: true }).selectOption(cv1.id);
  await dialog
    .getByLabel("Cover / motivation letter", { exact: true })
    .selectOption(letter.id);
  await dialog
    .getByLabel("Grade transcript", { exact: true })
    .selectOption(transcript.id);
  await dialog
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: /^Applications/ }).click();
  await page
    .getByRole("button", { name: "Edit Fictional Document Company" })
    .click();
  await expect(dialog.getByLabel("CV / resume", { exact: true })).toHaveValue(
    cv1.id,
  );
  await expect(
    dialog.getByLabel("Grade transcript", { exact: true }),
  ).toHaveValue(transcript.id);
  await expect(
    dialog.getByLabel("Cover / motivation letter", { exact: true }),
  ).toHaveValue(letter.id);
  await expect(
    dialog.getByRole("link", { name: "Engineering CV.pdf" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Archive Engineering CV v1", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Engineering CV v1", exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Show archived", { exact: true }).check();
  await expect(
    page.getByRole("article", { name: "Engineering CV v1", exact: true }),
  ).toContainText("Used in 1 application");
  await page.getByRole("link", { name: /^Applications/ }).click();
  await page
    .getByRole("button", { name: "Edit Fictional Document Company" })
    .click();
  await expect(dialog.getByLabel("CV / resume", { exact: true })).toHaveValue(
    cv1.id,
  );
  await expect(
    dialog.getByLabel("CV / resume", { exact: true }).locator("option:checked"),
  ).toContainText("archived");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(
    dialog
      .getByLabel("CV / resume", { exact: true })
      .locator(`option[value="${cv1.id}"]`),
  ).toHaveCount(0);
  await dialog.getByLabel("CV / resume", { exact: true }).selectOption(cv2.id);
  await dialog
    .getByRole("button", { name: "Upload a new version here", exact: true })
    .click();
  await dialog
    .getByLabel("Document type", { exact: true })
    .selectOption("Cover letter");
  await dialog
    .getByLabel("Document name", { exact: true })
    .fill("Inline letter");
  await dialog.getByLabel("Version label", { exact: true }).fill("v3");
  await dialog.getByLabel("PDF or DOCX file", { exact: true }).setInputFiles({
    name: "inline.pdf",
    mimeType: "application/pdf",
    buffer: fixture,
  });
  await dialog
    .getByRole("button", { name: "Upload version", exact: true })
    .click();
  await expect(
    dialog
      .getByLabel("Cover / motivation letter", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Inline letter · v3");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page.getByLabel("Show archived", { exact: true }).check();
  await page
    .getByRole("button", { name: "Restore Engineering CV v1", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Engineering CV v1", exact: true }),
  ).not.toContainText("Archived");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("document API rejects invalid files, oversized payloads, wrong categories and cross-origin writes", async ({
  request,
}) => {
  const fields = { name: "Fictional CV", kind: "CV", version: "v1" };
  expect(
    (
      await request.post("/api/documents", {
        multipart: {
          ...fields,
          file: {
            name: "fake.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("not a pdf"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/documents", {
        headers: { Origin: "https://untrusted.example" },
        multipart: {
          ...fields,
          file: {
            name: "cv.pdf",
            mimeType: "application/pdf",
            buffer: fixture,
          },
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/documents", {
        multipart: {
          ...fields,
          file: {
            name: "big.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
          },
        },
      })
    ).status(),
  ).toBe(413);
  const docx = await request.post("/api/documents", {
    multipart: {
      ...fields,
      kind: "Cover letter",
      file: {
        name: "letter.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.concat([
          Buffer.from([0x50, 0x4b, 3, 4]),
          Buffer.from("word/document.xml"),
        ]),
      },
    },
  });
  expect(docx.status()).toBe(201);
  const doc = await docx.json();
  expect(
    (await request.get(`/api/documents/${doc.id}`)).headers()["content-type"],
  ).toContain("wordprocessingml");
  expect(
    (
      await request.post("/api/applications", {
        data: {
          data: {
            company: "Fictional Wrong Type",
            position: "Intern",
            resumeDocumentId: doc.id,
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/documents/missing")).status()).toBe(404);
});
