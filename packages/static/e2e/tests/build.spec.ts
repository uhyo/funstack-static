import { expect, test } from "@playwright/test";

test.describe("Build output verification", () => {
  test("generates index.html with expected HTML structure", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const html = await response.text();

    // Verify HTML structure
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("lang=");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");

    // Verify funstack static app entry marker is present (used for hydration)
    expect(html).toContain("__FUNSTACK_APP_ENTRY__");
    // Verify the RSC payload is preloaded
    expect(html).toContain('rel="preload"');
    expect(html).toContain("funstack__/fun:rsc-payload/");
  });

  test("generates RSC payload files at /funstack__/*.txt", async ({
    request,
  }) => {
    // First get the index.html to find the RSC payload path
    const indexResponse = await request.get("/");
    const html = await indexResponse.text();

    // Look for the RSC payload in preload link or FUNSTACK config
    const rscPayloadMatch = html.match(
      /funstack__\/fun:rsc-payload\/[^"'\s]+\.txt/,
    );
    expect(rscPayloadMatch).not.toBeNull();

    const rscPayloadPath = "/" + rscPayloadMatch![0];
    const rscResponse = await request.get(rscPayloadPath);
    expect(rscResponse.ok()).toBe(true);

    const rscPayload = await rscResponse.text();
    // RSC payloads contain React Flight format data
    expect(rscPayload.length).toBeGreaterThan(0);
  });

  test("generates JavaScript bundles in /assets/", async ({ request }) => {
    const indexResponse = await request.get("/");
    const html = await indexResponse.text();

    // Look for dynamic import or script tags pointing to assets
    const scriptMatch = html.match(/import\("\/assets\/([^"]+\.js)"\)/);
    expect(scriptMatch).not.toBeNull();

    // Extract and verify the script is loadable
    const scriptPath = "/assets/" + scriptMatch![1];
    const scriptResponse = await request.get(scriptPath);
    expect(scriptResponse.ok()).toBe(true);
  });
});
