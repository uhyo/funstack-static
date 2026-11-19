import { expect, test } from "@playwright/test";

// The fixture does not install the optional `@funstack/router` peer
// dependency (#203).
test.describe("App without @funstack/router", () => {
  test("renders, loads deferred content and hydrates", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText("No Router App");
    await expect(page.getByTestId("deferred-section")).toHaveText(
      "Deferred section content",
    );

    // The button is server-rendered, so wait for hydration before clicking.
    const counter = page.getByTestId("counter");
    await expect(counter).toHaveAttribute("data-hydrated", "true");
    await counter.click();
    await expect(counter).toHaveText("Count: 1");

    expect(errors).toEqual([]);
  });
});
