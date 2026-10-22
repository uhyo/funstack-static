import { expect, test, type Page } from "@playwright/test";

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

test.describe("File-system routing (mpa, dev server)", () => {
  test("renders the index page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
  });

  test("renders a dynamic route with params", async ({ page }) => {
    await page.goto("/blog/hello");
    await expect(page.getByTestId("slug")).toHaveText("hello");
    await expect(page.getByTestId("live-slug")).toHaveText("hello");
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

  test("a Client Component layout receives the matched params", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("ja");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("ja");
  });

  test("a link click loads the destination as a new document", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-id")).toHaveText("home");
    await markDocument(page);

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByTestId("page-id")).toHaveText("about");
    expect(await isSameDocument(page)).toBe(false);
  });

  test("navigating between pages of a dynamic route loads a new document", async ({
    page,
  }) => {
    await page.goto("/ja");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("ja");
    await markDocument(page);

    await page.getByTestId("link-en").click();
    await expect(page.getByTestId("lang-layout-lang")).toHaveText("en");
    await expect(page.getByTestId("lang-page-lang")).toHaveText("en");
    expect(await isSameDocument(page)).toBe(false);
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
