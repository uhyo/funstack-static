import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

const fixtureDir = path.resolve(import.meta.dirname, "../fixture-render-error");

type Scenario = "ok" | "rsc-error" | "defer-error" | "ssr-error";

/**
 * Runs `vite build` in the render-error fixture and returns its exit code,
 * combined output and public output directory.
 */
async function build(
  scenario: Scenario,
  options: { ssr: boolean; failOnRenderError?: boolean },
) {
  const failOnRenderError = options.failOnRenderError ?? true;
  const outDir = path.join(
    fixtureDir,
    "dist",
    `${scenario}-${options.ssr ? "ssr" : "csr"}${failOnRenderError ? "" : "-nofail"}`,
    "public",
  );
  try {
    const { stdout, stderr } = await execFileAsync("pnpm", ["vite", "build"], {
      cwd: fixtureDir,
      env: {
        ...process.env,
        RENDER_ERROR_SCENARIO: scenario,
        RENDER_ERROR_SSR: String(options.ssr),
        RENDER_ERROR_FAIL: String(failOnRenderError),
      },
    });
    return { exitCode: 0, output: stdout + stderr, outDir };
  } catch (error) {
    const { code, stdout, stderr } = error as {
      code: number;
      stdout: string;
      stderr: string;
    };
    return { exitCode: code, output: stdout + stderr, outDir };
  }
}

async function readRscPayloads(outDir: string): Promise<string[]> {
  const dir = path.join(outDir, "funstack__", "fun__rsc-payload");
  const files = await readdir(dir);
  return Promise.all(
    files.map((file) => readFile(path.join(dir, file), "utf8")),
  );
}

test.describe("Build fails on render errors (#194)", () => {
  // Each build takes a few seconds.
  test.setTimeout(60000);

  for (const ssr of [false, true]) {
    test.describe(ssr ? "SSR on" : "SSR off", () => {
      test("succeeds without render errors", async () => {
        const result = await build("ok", { ssr });
        expect(result.output).not.toContain("Error while rendering");
        expect(result.exitCode).toBe(0);
      });

      test("fails when a Server Component render errors", async () => {
        const result = await build("rsc-error", { ssr });
        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(
          'RSC payload of "index.html": Functions cannot be passed directly to Client Components',
        );
        // Nothing is written for the broken page
        await expect(
          readFile(path.join(result.outDir, "index.html")),
        ).rejects.toThrow();
      });

      test("fails when a deferred component errors", async () => {
        const result = await build("defer-error", { ssr });
        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(
          'deferred component "Throws": Throws: error thrown in a deferred component',
        );
      });

      test("emits the output with failOnRenderError: false", async () => {
        const result = await build("rsc-error", {
          ssr,
          failOnRenderError: false,
        });
        expect(result.exitCode).toBe(0);
        // The error is still logged
        expect(result.output).toContain("Error while rendering");
        const payloads = await readRscPayloads(result.outDir);
        expect(payloads.some((payload) => /^\w+:E\{/m.test(payload))).toBe(
          true,
        );
        if (ssr) {
          const html = await readFile(
            path.join(result.outDir, "index.html"),
            "utf8",
          );
          expect(html).toContain("<!--$!-->");
        }
      });
    });
  }

  test("fails when prerendering a Client Component errors", async () => {
    const result = await build("ssr-error", { ssr: true });
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain(
      'HTML of "index.html": ThrowOnServer: error thrown during SSR',
    );
  });
});
