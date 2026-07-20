import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const htmlHeaders = { Accept: "text/html" };

test.describe("Multi-entry dev server response", () => {
  test("serves index page with expected HTML structure", async ({
    request,
  }) => {
    const response = await request.get("/", { headers: htmlHeaders });
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
  });

  test("serves about page with expected HTML structure", async ({
    request,
  }) => {
    const response = await request.get("/about", { headers: htmlHeaders });
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
  });

  test("SPA fallback: serves index.html for unmatched routes", async ({
    request,
  }) => {
    const response = await request.get("/non-existent", {
      headers: htmlHeaders,
    });
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
  });
});

test.describe("Multi-entry page rendering (dev server)", () => {
  test("home page renders correct content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Home Page");
    await expect(page.getByTestId("page-id")).toHaveText("home");
  });

  test("about page renders correct content", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toHaveText("About Page");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("no JavaScript errors on home page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("no JavaScript errors on about page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("Destructive mount detection (dev server)", () => {
  test("warns about Root content that a production mount would destroy", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/destructive");
    await expect(page.locator("h1")).toHaveText("Destructive Page");

    // In dev the full tree (including Root) is rendered by React, so the
    // content survives — the console error is the only signal of the problem
    await expect(page.getByTestId("doomed-header")).toBeVisible();

    const warning = consoleErrors.find((m) => m.includes("[@funstack/static]"));
    expect(warning).toBeDefined();
    expect(warning).toContain("<header>");
  });

  test("does not warn when {children} is alone in its parent", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Home Page");

    expect(
      consoleErrors.filter((m) => m.includes("[@funstack/static]")),
    ).toEqual([]);
  });
});

test.describe("Multi-entry HMR (dev server)", () => {
  const hmrPagePath = fileURLToPath(
    new URL("../fixture-multi-entry/src/pages/HmrTest.tsx", import.meta.url),
  );

  test("server code change re-renders the current non-first entry", async ({
    page,
  }) => {
    const originalSource = await readFile(hmrPagePath, "utf-8");
    try {
      await page.goto("/hmr-test");
      await expect(page.locator("h1")).toHaveText("HMR Test Page");
      await expect(page.getByTestId("hmr-content")).toHaveText(
        "initial content",
      );

      await writeFile(
        hmrPagePath,
        originalSource.replace("initial content", "updated content"),
      );

      // The edited content should appear via HMR without a page reload
      await expect(page.getByTestId("hmr-content")).toHaveText(
        "updated content",
        { timeout: 15000 },
      );
      // The page must still show this entry's tree, not the first entry's
      await expect(page.locator("h1")).toHaveText("HMR Test Page");
      await expect(page.getByTestId("page-id")).toHaveText("hmr-test");
    } finally {
      await writeFile(hmrPagePath, originalSource);
    }
  });
});
