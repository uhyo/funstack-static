import { expect, test } from "@playwright/test";

test.describe("File-system routing build output", () => {
  test("generates an HTML file per route", async ({ request }) => {
    for (const path of [
      "/",
      "/about",
      "/blog",
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
});

test.describe("File-system routing rendering", () => {
  test("renders the index page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
  });

  test("renders a static nested page", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("renders the directory index page", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByTestId("page-id")).toHaveText("blog-index");
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

    await page.goto("/blog/world");
    await expect(page.getByTestId("slug")).toHaveText("world");
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

  test("navigates between routes on the client", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByTestId("page-id")).toHaveText("about");

    await page.getByRole("link", { name: "Blog", exact: true }).click();
    await expect(page.getByTestId("page-id")).toHaveText("blog-index");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByTestId("dashboard-layout")).toHaveText(
      "dashboard-layout",
    );
    await expect(page.getByTestId("page-id")).toHaveText("dashboard");
  });

  test("renders correct params when a dynamic page is loaded directly", async ({
    page,
  }) => {
    for (const lang of ["en", "ja"]) {
      await page.goto(`/${lang}`);
      await expect(page.getByTestId("lang-layout-lang")).toHaveText(lang);
      await expect(page.getByTestId("lang-page-lang")).toHaveText(lang);
      await expect(page.getByTestId("live-lang")).toHaveText(lang);
    }
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
    expect(errors).toEqual([]);
  });
});

test.describe("Dynamic params on soft client-side navigation", () => {
  test("a Client Component layout receives live params", async ({ page }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("ja");

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-layout-pathname")).toHaveText("/en");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("en");
  });

  test("a Client Component page receives live params", async ({ page }) => {
    await page.goto("/en/client");
    await expect(page.getByTestId("client-page-lang")).toHaveText("en");

    await page.getByTestId("link-ja-client").click();
    await expect(page.getByTestId("client-page-lang")).toHaveText("ja");
  });

  test("a Client Component reads live params via the route object under a Server Component page", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("live-lang")).toHaveText("ja");

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("live-lang")).toHaveText("en");
    // The Server Component page's own output was rendered at build time and
    // keeps its build-time params — the documented static-hosting limitation.
    await expect(page.getByTestId("lang-page-lang")).toHaveText("ja");
  });

  test("no JavaScript errors while navigating between dynamic pages", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.goto("/ja");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("en");
    await page.getByTestId("link-en-client").click();
    await expect(page.getByTestId("client-page-lang")).toHaveText("en");
    expect(errors).toEqual([]);
  });
});
