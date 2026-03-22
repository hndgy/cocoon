import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bold, dim, yellow, red, green, gray,
  stripAnsi, banner, createSpinner, log, warn, success, setDebug,
} from "../src/ui.js";

describe("color helpers", () => {
  it("bold wraps text with ANSI bold codes", () => {
    expect(bold("hello")).toBe("\x1b[1mhello\x1b[0m");
  });

  it("dim wraps text with ANSI dim codes", () => {
    expect(dim("hello")).toBe("\x1b[2mhello\x1b[0m");
  });

  it("yellow wraps text with ANSI yellow codes", () => {
    expect(yellow("hello")).toBe("\x1b[33mhello\x1b[0m");
  });

  it("red wraps text with ANSI red codes", () => {
    expect(red("hello")).toBe("\x1b[31mhello\x1b[0m");
  });

  it("green wraps text with ANSI green codes", () => {
    expect(green("hello")).toBe("\x1b[32mhello\x1b[0m");
  });

  it("gray wraps text with ANSI gray codes", () => {
    expect(gray("hello")).toBe("\x1b[90mhello\x1b[0m");
  });
});

describe("stripAnsi", () => {
  it("removes ANSI escape sequences", () => {
    const colored = bold("hello") + " " + red("world");
    expect(stripAnsi(colored)).toBe("hello world");
  });

  it("returns plain text unchanged", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("handles nested ANSI codes", () => {
    const nested = yellow(bold("test"));
    expect(stripAnsi(nested)).toBe("test");
  });
});

describe("banner", () => {
  it("contains the version string", () => {
    const output = banner("1.2.3");
    expect(stripAnsi(output)).toContain("v1.2.3");
  });

  it("contains the cocoon title", () => {
    const output = banner("0.1.0");
    expect(stripAnsi(output)).toContain("cocoon");
  });

  it("contains the subtitle", () => {
    const output = banner("0.1.0");
    expect(stripAnsi(output)).toContain("Claude's cozy isolated shell");
  });

  it("has tilde border characters", () => {
    const output = stripAnsi(banner("0.1.0"));
    expect(output).toContain("~");
  });

  it("produces ten lines", () => {
    const lines = banner("0.1.0").split("\n");
    expect(lines).toHaveLength(10);
  });
});

describe("createSpinner", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setDebug(true);
    vi.useFakeTimers();
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    writeSpy.mockRestore();
    setDebug(false);
  });

  it("writes spinner frame on start", () => {
    const spinner = createSpinner("loading");
    spinner.start();
    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("loading");
    spinner.stop();
  });

  it("advances frames over time", () => {
    const spinner = createSpinner("working");
    spinner.start();
    const callsBefore = writeSpy.mock.calls.length;
    vi.advanceTimersByTime(160);
    expect(writeSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    spinner.stop();
  });

  it("update changes the message", () => {
    const spinner = createSpinner("first");
    spinner.start();
    spinner.update("second");
    vi.advanceTimersByTime(80);
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("second");
    spinner.stop();
  });

  it("success stops and prints a check mark", () => {
    const spinner = createSpinner("doing");
    spinner.start();
    spinner.success("done!");
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("✔");
    expect(stripAnsi(output)).toContain("done!");
  });
});

describe("styled log functions", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("log writes prefixed message to stderr", () => {
    log("hello world");
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ·");
    expect(stripAnsi(output)).toContain("hello world");
  });

  it("warn writes prefixed warning to stderr", () => {
    warn("danger");
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ⚠");
    expect(stripAnsi(output)).toContain("danger");
  });

  it("success writes prefixed success to stderr", () => {
    success("all good");
    const output = writeSpy.mock.calls.map(c => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ✔");
    expect(stripAnsi(output)).toContain("all good");
  });
});
