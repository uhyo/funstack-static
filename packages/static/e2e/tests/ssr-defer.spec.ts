import { expect, test } from "@playwright/test";

test.describe("SSR with defer()", () => {
  test("deferred content is server-rendered in HTML", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const html = await response.text();

    // The deferred component's content should be present in SSR HTML
    expect(html).toContain("Hello from deferred component");
  });

  test("page renders without errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("SSR Defer Test");
    await expect(page.getByTestId("server-rendered")).toHaveText(
      "Server rendered content",
    );
    await expect(page.getByTestId("deferred-content")).toHaveText(
      "Hello from deferred component",
    );

    expect(errors).toEqual([]);
  });
});
