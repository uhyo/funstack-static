import { expect, test } from "@playwright/test";

test.describe("SSR with defer()", () => {
  test("deferred content is server-rendered in HTML", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const html = await response.text();

    // The deferred component's content should be present in SSR HTML
    expect(html).toContain("Hello from deferred component");
    // Nested deferred content is server-rendered too
    expect(html).toContain("Hello from nested deferred component");
  });

  test("page renders without errors", async ({ page }) => {
    const errors: string[] = [];
    const failedPayloadRequests: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    // A deferred payload referencing a payload that was not emitted under
    // the referenced name would surface as a failed /funstack__/ request.
    page.on("response", (response) => {
      if (response.url().includes("/funstack__/") && !response.ok()) {
        failedPayloadRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("SSR Defer Test");
    await expect(page.getByTestId("server-rendered")).toHaveText(
      "Server rendered content",
    );
    await expect(page.getByTestId("deferred-content")).toHaveText(
      "Hello from deferred component",
    );
    await expect(page.getByTestId("nested-deferred-content")).toHaveText(
      "Hello from nested deferred component",
    );

    expect(errors).toEqual([]);
    expect(failedPayloadRequests).toEqual([]);
  });

  // Server `useId()` counts from zero in every Flight render; deferred
  // payloads are separate renders, so without a per-payload prefix their ids
  // would repeat the main payload's (#198).
  const probeLabels = [
    "main-1",
    "deferred-1",
    "deferred-2",
    "nested-1",
    "main-2",
  ];

  test("server useId ids are unique across main and deferred payloads in SSR HTML", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    const html = await response.text();

    const ids = [...html.matchAll(/data-probe-id="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
    expect(ids).toHaveLength(probeLabels.length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^_[A-Za-z0-9_-]*S_[0-9a-v]+_$/);
    }
  });

  test("server useId ids stay unique after hydration", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    // A mismatch between SSR HTML and the payloads' ids would be reported
    // as a hydration error on the console.
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });

    await page.goto("/");
    for (const label of probeLabels) {
      await expect(page.getByTestId(`id-probe-${label}`)).toBeVisible();
    }
    // Let hydration of the deferred content settle before checking the DOM.
    await page.waitForTimeout(500);

    const ids = await page
      .locator("[data-probe-id]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-probe-id")),
      );
    expect(ids).toHaveLength(probeLabels.length);
    expect(new Set(ids).size).toBe(ids.length);

    const duplicateDomIds = await page.evaluate(() => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const element of document.querySelectorAll("[id]")) {
        if (seen.has(element.id)) {
          duplicates.push(element.id);
        }
        seen.add(element.id);
      }
      return duplicates;
    });
    expect(duplicateDomIds).toEqual([]);
    expect(errors).toEqual([]);
  });
});
