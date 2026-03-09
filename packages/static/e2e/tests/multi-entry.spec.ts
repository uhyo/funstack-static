import { expect, test } from "@playwright/test";

test.describe("Multi-entry build output", () => {
  test("generates index.html with expected HTML structure", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
    expect(html).toContain("funstack__/fun:rsc-payload/");
  });

  test("generates about.html with expected HTML structure", async ({
    request,
  }) => {
    const response = await request.get("/about");
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
    expect(html).toContain("funstack__/fun:rsc-payload/");
  });

  test("each page has its own RSC payload", async ({ request }) => {
    const homeResponse = await request.get("/");
    const homeHtml = await homeResponse.text();

    const aboutResponse = await request.get("/about");
    const aboutHtml = await aboutResponse.text();

    // Both pages should reference RSC payloads
    const homePayloadMatch = homeHtml.match(
      /funstack__\/fun:rsc-payload\/[^"'\s]+\.txt/,
    );
    const aboutPayloadMatch = aboutHtml.match(
      /funstack__\/fun:rsc-payload\/[^"'\s]+\.txt/,
    );

    expect(homePayloadMatch).not.toBeNull();
    expect(aboutPayloadMatch).not.toBeNull();

    // Each page should have a different RSC payload (different content)
    expect(homePayloadMatch![0]).not.toBe(aboutPayloadMatch![0]);

    // Both RSC payloads should be fetchable
    const homePayloadResponse = await request.get("/" + homePayloadMatch![0]);
    expect(homePayloadResponse.ok()).toBe(true);

    const aboutPayloadResponse = await request.get("/" + aboutPayloadMatch![0]);
    expect(aboutPayloadResponse.ok()).toBe(true);
  });
});

test.describe("Multi-entry page rendering", () => {
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
