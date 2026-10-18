import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRenderErrorHandler,
  createRenderErrorsError,
  type RenderError,
} from "./renderErrors";

describe("createRenderErrorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs and records errors with their source", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const errors: RenderError[] = [];
    const onError = createRenderErrorHandler(errors, 'HTML of "index.html"');
    const error = new Error("boom");

    onError(error);

    expect(errors).toEqual([{ source: 'HTML of "index.html"', error }]);
    expect(consoleError).toHaveBeenCalledWith(
      '[funstack] Error while rendering HTML of "index.html":',
      error,
    );
  });
});

describe("createRenderErrorsError", () => {
  it("lists every error with its source", () => {
    const first = new Error("first");
    const error = createRenderErrorsError([
      { source: 'RSC payload of "index.html"', error: first },
      { source: "a deferred component", error: "not an Error" },
    ]);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([first, "not an Error"]);
    expect(error.message).toContain("2 error(s) occurred");
    expect(error.message).toContain('  - RSC payload of "index.html": first');
    expect(error.message).toContain("  - a deferred component: not an Error");
    expect(error.message).toContain("failOnRenderError: false");
  });
});
