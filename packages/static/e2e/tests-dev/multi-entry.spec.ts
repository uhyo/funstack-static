import { expect, test } from "@playwright/test";

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
