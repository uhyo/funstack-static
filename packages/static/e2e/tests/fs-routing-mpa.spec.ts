import { expect, test, type Page } from "@playwright/test";

/**
 * Marks the current document, so that a later check can tell whether a
 * navigation replaced the document (the mark is gone) or was handled as a
 * soft client-side navigation within it (the mark survives).
 */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __document_mark: boolean }).__document_mark = true;
  });
}

async function isSameDocument(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window as unknown as { __document_mark?: boolean }).__document_mark ===
      true,
  );
}

test.describe("File-system routing (mpa) build output", () => {
  test("generates an HTML file per route", async ({ request }) => {
    for (const path of [
      "/",
      "/about",
      "/blog/featured",
      "/blog/hello",
      "/blog/world",
      "/dashboard",
      "/dashboard/settings",
      "/en",
      "/ja",
      "/en/client",
      "/ja/client",
    ]) {
      const response = await request.get(path);
      expect(response.ok(), `expected ${path} to be served`).toBe(true);
      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("funstack__/fun__rsc-payload/");
    }
  });

  test("server-renders each page's own content", async ({ request }) => {
    const about = await (await request.get("/about")).text();
    expect(about).toContain(">about<");
    expect(about).not.toContain(">home<");

    const post = await (await request.get("/blog/world")).text();
    expect(post).toContain(">blog-post<");
    expect(post).toContain('data-testid="slug">world<');
  });
});

test.describe("File-system routing (mpa) rendering", () => {
  test("renders the index page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
  });

  test("renders a static nested page", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("renders a static page instead of a dynamic sibling route", async ({
    page,
  }) => {
    await page.goto("/blog/featured");
    await expect(page.getByTestId("page-id")).toHaveText("blog-featured");
  });

  test("statically generates dynamic routes with params", async ({ page }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("page-id")).toHaveText("blog-post");
    await expect(page.getByTestId("slug")).toHaveText("hello");
    await expect(page.getByTestId("live-slug")).toHaveText("hello");

    await page.goto("/blog/world");
    await expect(page.getByTestId("slug")).toHaveText("world");
    await expect(page.getByTestId("live-slug")).toHaveText("world");
  });

  test("wraps nested pages in their layout", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-layout")).toHaveText(
      "dashboard-layout",
    );
    await expect(page.getByTestId("page-id")).toHaveText("dashboard");

    await page.goto("/dashboard/settings");
    await expect(page.getByTestId("dashboard-layout")).toHaveText(
      "dashboard-layout",
    );
    await expect(page.getByTestId("page-id")).toHaveText("dashboard-settings");
  });

  test("a Client Component layout and page receive the matched params", async ({
    page,
  }) => {
    for (const lang of ["en", "ja"]) {
      await page.goto(`/${lang}`);
      await expect(page.getByTestId("lang-layout-pathname")).toHaveText(
        `/${lang}`,
      );
      await expect(page.getByTestId("lang-layout-lang")).toHaveText(lang);
      await expect(page.getByTestId("lang-page-lang")).toHaveText(lang);

      await page.goto(`/${lang}/client`);
      await expect(page.getByTestId("client-page-lang")).toHaveText(lang);
      await expect(page.getByTestId("client-page-hook-lang")).toHaveText(lang);
    }
  });

  test("hydrates without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    for (const path of ["/", "/blog/hello", "/dashboard/settings", "/ja"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Client-side state proves the page is interactive (hydrated).
      await page.getByTestId("nav-counter").click();
      await expect(page.getByTestId("nav-counter")).toHaveText("1");
    }
    expect(errors).toEqual([]);
  });
});

test.describe("File-system routing (mpa) navigation", () => {
  test("a link click loads the destination as a new document", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
    await page.getByTestId("nav-counter").click();
    await expect(page.getByTestId("nav-counter")).toHaveText("1");
    await markDocument(page);

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByTestId("page-id")).toHaveText("about");
    expect(page.url()).toMatch(/\/about$/);
    // No soft navigation: the document was replaced and shell state reset.
    expect(await isSameDocument(page)).toBe(false);
    await expect(page.getByTestId("nav-counter")).toHaveText("0");
  });

  test("navigating between pages of a dynamic route loads each page's own document", async ({
    page,
  }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("slug")).toHaveText("hello");
    await markDocument(page);

    await page.getByTestId("link-world").click();
    await expect(page.getByTestId("slug")).toHaveText("world");
    await expect(page.getByTestId("live-slug")).toHaveText("world");
    expect(await isSameDocument(page)).toBe(false);

    await page.goBack();
    await expect(page.getByTestId("slug")).toHaveText("hello");
    await expect(page.getByTestId("live-slug")).toHaveText("hello");
  });

  test("navigating under a Client Component layout loads a new document", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("ja");
    await markDocument(page);

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("en");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("en");
    expect(await isSameDocument(page)).toBe(false);

    await page.getByTestId("link-en-client").click();
    await expect(page.getByTestId("client-page-hook-lang")).toHaveText("en");
    await page.getByTestId("link-ja-client").click();
    await expect(page.getByTestId("client-page-hook-lang")).toHaveText("ja");
  });

  test("no JavaScript errors while navigating", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByTestId("page-id")).toHaveText("dashboard");
    await page.getByRole("link", { name: "Hello post" }).click();
    await expect(page.getByTestId("live-slug")).toHaveText("hello");
    expect(errors).toEqual([]);
  });
});
