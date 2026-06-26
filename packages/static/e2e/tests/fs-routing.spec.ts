import { expect, test } from "@playwright/test";

test.describe("File-system routing build output", () => {
  test("generates an HTML file per route", async ({ request }) => {
    for (const path of [
      "/",
      "/about",
      "/blog",
      "/blog/hello",
      "/blog/world",
      "/dashboard",
      "/dashboard/settings",
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
