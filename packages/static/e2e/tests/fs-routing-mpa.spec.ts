import { expect, test } from "@playwright/test";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const allPages = [
  "/",
  "/about",
  "/blog",
  "/blog/hello",
  "/blog/world",
  "/counter",
  "/en",
  "/ja",
];

test.describe("File-system routing MPA build output", () => {
  test("generates a complete HTML file per route with no JavaScript", async ({
    request,
  }) => {
    for (const path of allPages) {
      const response = await request.get(path);
      expect(response.ok(), `expected ${path} to be served`).toBe(true);
      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      // No bootstrap script, no client manifest, no RSC payload reference,
      // and no preload of client chunks nothing would import.
      expect(html).not.toContain("<script");
      expect(html).not.toContain("FUNSTACK_STATIC_");
      expect(html).not.toContain("funstack__/");
      expect(html).not.toContain("modulepreload");
    }
  });

  test("writes no RSC payload files", async () => {
    const payloadDir = fileURLToPath(
      new URL(
        "../fixture-fs-routing-mpa/dist/public/funstack__",
        import.meta.url,
      ),
    );
    await expect(access(payloadDir)).rejects.toThrow();
  });

  test("links the stylesheet imported by the root", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<link rel="stylesheet"[^>]*\.css"/);
  });
});

test.describe("File-system routing MPA rendering", () => {
  test("renders static pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
    await page.goto("/about");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("wraps pages in a Server Component layout", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByTestId("blog-layout")).toHaveText("blog-layout");
    await expect(page.getByTestId("page-id")).toHaveText("blog-index");
  });

  test("statically generates dynamic routes with params", async ({ page }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("blog-layout")).toHaveText("blog-layout");
    await expect(page.getByTestId("slug")).toHaveText("hello");
    // A Client Component reading params via the route object renders them
    // at build time, without being hydrated.
    await expect(page.getByTestId("live-slug")).toHaveText("hello");

    await page.goto("/blog/world");
    await expect(page.getByTestId("slug")).toHaveText("world");
    await expect(page.getByTestId("live-slug")).toHaveText("world");
  });

  test("renders a Client Component layout with the page's params and pathname", async ({
    page,
  }) => {
    for (const lang of ["en", "ja"]) {
      await page.goto(`/${lang}`);
      await expect(page.getByTestId("lang-layout-pathname")).toHaveText(
        `/${lang}`,
      );
      await expect(page.getByTestId("lang-layout-lang")).toHaveText(lang);
      await expect(page.getByTestId("lang-page-lang")).toHaveText(lang);
    }
  });

  test("links are full page navigations", async ({ page }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("slug")).toHaveText("hello");
    // A marker on the window survives soft navigation only; a new document
    // starts without it.
    await page.evaluate(() => {
      (window as unknown as { __marker: boolean }).__marker = true;
    });

    await page.getByTestId("link-world").click();
    await expect(page).toHaveURL("/blog/world");
    await expect(page.getByTestId("slug")).toHaveText("world");
    await expect(page.getByTestId("live-slug")).toHaveText("world");
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: boolean }).__marker,
      ),
    ).toBeUndefined();
  });

  test("a Client Component renders its initial HTML but is not hydrated", async ({
    page,
  }) => {
    await page.goto("/counter");
    const counter = page.getByTestId("counter");
    await expect(counter).toHaveText("Count: 0");
    await counter.click();
    // No JavaScript ships, so the click changes nothing.
    await page.waitForTimeout(200);
    await expect(counter).toHaveText("Count: 0");
  });

  test("no JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    for (const path of allPages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });
});
