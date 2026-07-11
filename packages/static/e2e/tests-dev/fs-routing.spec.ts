import { expect, test } from "@playwright/test";

test.describe("File-system routing (dev server)", () => {
  test("renders the index page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
  });

  test("renders a static nested page", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });

  test("renders a dynamic route with params", async ({ page }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("slug")).toHaveText("hello");
  });

  test("renders a static page instead of a dynamic sibling route", async ({
    page,
  }) => {
    await page.goto("/blog/featured");
    await expect(page.getByTestId("page-id")).toHaveText("blog-featured");
  });

  test("wraps nested pages in their layout", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByTestId("dashboard-layout")).toHaveText(
      "dashboard-layout",
    );
    await expect(page.getByTestId("page-id")).toHaveText("dashboard-settings");
  });

  test("navigates between routes on the client", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByTestId("page-id")).toHaveText("about");
  });
});
