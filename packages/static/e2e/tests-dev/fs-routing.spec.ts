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

  test("a Client Component layout receives live params on soft navigation", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("ja");

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("en");
  });

  test("a Client Component reads live params via the route object", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("live-lang")).toHaveText("ja");

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("live-lang")).toHaveText("en");
  });

  test("a Server Component page re-renders with the destination's params", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("ja");

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-page-lang")).toHaveText("en");
  });

  test("a Server Component layout under a dynamic segment updates on soft navigation", async ({
    page,
  }) => {
    await page.goto("/en/info");
    await expect(page.getByTestId("info-layout-lang")).toHaveText("en");

    await page.getByTestId("link-ja-info").click();
    await expect(page.getByTestId("info-layout-lang")).toHaveText("ja");
    await expect(page.getByTestId("info-page-lang")).toHaveText("ja");
  });
});
