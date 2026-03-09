import { expect, test } from "@playwright/test";

test.describe("Client-side hydration", () => {
  test("renders server content", async ({ page }) => {
    await page.goto("/");

    // Verify server-rendered content is visible
    await expect(page.locator("h1")).toHaveText("E2E Test App");
    await expect(page.getByTestId("server-rendered")).toHaveText(
      "Server rendered content",
    );
  });

  test("client counter component hydrates and displays initial state", async ({
    page,
  }) => {
    await page.goto("/");

    const counter = page.getByTestId("counter");
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText("Count: 0");
  });

  test("clicking counter button increments the count", async ({ page }) => {
    await page.goto("/");

    const counter = page.getByTestId("counter");

    // Click and verify increment
    await counter.click();
    await expect(counter).toHaveText("Count: 1");

    // Click again
    await counter.click();
    await expect(counter).toHaveText("Count: 2");

    // Click multiple times
    await counter.click();
    await counter.click();
    await expect(counter).toHaveText("Count: 4");
  });

  test("no JavaScript errors in console", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");

    // Wait for hydration to complete by verifying counter is interactive
    const counter = page.getByTestId("counter");
    await counter.click();
    await expect(counter).toHaveText("Count: 1");

    expect(errors).toEqual([]);
  });

  test("RSC payload files are fetched", async ({ page }) => {
    const rscRequests: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("funstack__/fun:rsc-payload/") && url.endsWith(".txt")) {
        rscRequests.push(url);
      }
    });

    await page.goto("/");

    // Wait for page to fully load
    await page.waitForLoadState("networkidle");

    // At least one RSC payload should have been fetched
    expect(rscRequests.length).toBeGreaterThan(0);
  });
});
