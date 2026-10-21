import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const htmlHeaders = { Accept: "text/html" };

test.describe("File-system routing MPA (dev server)", () => {
  test("serves complete HTML without the client runtime", async ({
    request,
  }) => {
    const response = await request.get("/blog/hello", { headers: htmlHeaders });
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain('data-testid="slug">hello<');
    // No inline RSC payload and no client entry: only the reload script
    // connecting to Vite's HMR channel.
    expect(html).not.toContain("__FLIGHT_DATA");
    expect(html).not.toContain("virtual:vite-rsc/entry-browser");
    expect(html).toContain("/@vite/client");
  });

  test("renders pages, layouts and params", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");

    await page.goto("/blog/world");
    await expect(page.getByTestId("blog-layout")).toHaveText("blog-layout");
    await expect(page.getByTestId("slug")).toHaveText("world");
    await expect(page.getByTestId("live-slug")).toHaveText("world");

    await page.goto("/ja");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("ja");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("ja");
  });

  test("links are full page navigations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL("/about");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("a Client Component is not hydrated, as in production", async ({
    page,
  }) => {
    await page.goto("/counter");
    const counter = page.getByTestId("counter");
    await expect(counter).toHaveText("Count: 0");
    await counter.click();
    await page.waitForTimeout(200);
    await expect(counter).toHaveText("Count: 0");
  });

  test("no JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.goto("/blog/hello");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("File-system routing MPA HMR (dev server)", () => {
  const hmrPagePath = fileURLToPath(
    new URL(
      "../fixture-fs-routing-mpa/src/pages/hmr/page.tsx",
      import.meta.url,
    ),
  );

  test("a server code change reloads the page", async ({ page }) => {
    const originalSource = await readFile(hmrPagePath, "utf-8");
    try {
      await page.goto("/hmr");
      await expect(page.getByTestId("hmr-content")).toHaveText(
        "initial content",
      );

      await writeFile(
        hmrPagePath,
        originalSource.replace("initial content", "updated content"),
      );

      // Without a client runtime, the edit is picked up by reloading the page.
      await expect(page.getByTestId("hmr-content")).toHaveText(
        "updated content",
        { timeout: 15000 },
      );
      await expect(page.getByTestId("page-id")).toHaveText("hmr");
    } finally {
      await writeFile(hmrPagePath, originalSource);
    }
  });
});
