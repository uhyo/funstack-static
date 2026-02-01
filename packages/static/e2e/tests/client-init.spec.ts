import { expect, test } from "@playwright/test";

test.describe("Client initialization", () => {
  test("clientInit module runs before React hydration", async ({ page }) => {
    await page.goto("/");

    // Wait for React hydration to complete
    const counter = page.getByTestId("counter");
    await counter.click();
    await expect(counter).toHaveText("Count: 1");

    // Verify client init ran
    const clientInitRan = await page.evaluate(() => window.__CLIENT_INIT_RAN__);
    expect(clientInitRan).toBe(true);

    // Verify client init ran before React hydration
    const timestamps = await page.evaluate(() => ({
      clientInit: window.__CLIENT_INIT_TIMESTAMP__,
      reactHydrated: window.__REACT_HYDRATED_TIMESTAMP__,
    }));

    expect(timestamps.clientInit).toBeDefined();
    expect(timestamps.reactHydrated).toBeDefined();
    expect(timestamps.clientInit).toBeLessThanOrEqual(
      timestamps.reactHydrated!,
    );
  });

  test("clientInit globals are available during React render", async ({
    page,
  }) => {
    // Listen for console messages to verify no errors
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");

    // Verify no errors occurred (client init should be available)
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);

    // Verify the global is set
    const clientInitRan = await page.evaluate(() => window.__CLIENT_INIT_RAN__);
    expect(clientInitRan).toBe(true);
  });
});
