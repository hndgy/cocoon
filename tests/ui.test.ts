import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bold,
  dim,
  yellow,
  red,
  green,
  gray,
  stripAnsi,
  banner,
  createSpinner,
  log,
  warn,
  success,
  setDebug,
  visibleLength,
  padCell,
  clampLine,
  formatTable,
  formatDuration,
  statusDot,
  renderCocoonList,
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

describe("visibleLength", () => {
  it("ignores ANSI codes when measuring width", () => {
    expect(visibleLength(yellow("hello"))).toBe(5);
    expect(visibleLength("plain")).toBe(5);
  });
});

describe("padCell", () => {
  it("pads a plain cell to the requested width", () => {
    expect(padCell("hi", 5)).toBe("hi   ");
  });

  it("pads by visible width, not raw length", () => {
    const padded = padCell(green("ok"), 4);
    expect(stripAnsi(padded)).toBe("ok  ");
  });

  it("leaves cells wider than the target untouched", () => {
    expect(padCell("toolong", 3)).toBe("toolong");
  });
});

describe("clampLine", () => {
  it("returns short lines unchanged", () => {
    expect(clampLine("short", 20)).toBe("short");
  });

  it("truncates with an ellipsis", () => {
    expect(clampLine("abcdefghij", 5)).toBe("abcd…");
  });

  it("strips ANSI before measuring", () => {
    expect(clampLine(green("abcdefghij"), 5)).toBe("abcd…");
  });

  it("returns empty string for non-positive width", () => {
    expect(clampLine("anything", 0)).toBe("");
  });
});

describe("formatTable", () => {
  it("aligns columns to the widest cell", () => {
    const out = stripAnsi(
      formatTable(
        ["a", "bb"],
        [
          ["x", "yy"],
          ["zzz", "w"],
        ],
      ),
    );
    const lines = out.split("\n");
    expect(lines[1]).toBe("x    yy");
    expect(lines[2]).toBe("zzz  w");
  });

  it("aligns using visible width when cells are colored", () => {
    const out = stripAnsi(formatTable([], [[green("ok"), "next"]]));
    expect(out).toBe("ok  next");
  });
});

describe("formatDuration", () => {
  it("renders seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });
  it("renders minutes", () => {
    expect(formatDuration(3 * 60_000)).toBe("3m");
  });
  it("renders hours", () => {
    expect(formatDuration(2 * 3_600_000)).toBe("2h");
  });
  it("renders days", () => {
    expect(formatDuration(4 * 86_400_000)).toBe("4d");
  });
  it("clamps negatives to zero seconds", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });
});

describe("statusDot", () => {
  it("is green when running", () => {
    expect(statusDot("running")).toBe(green("●"));
  });
  it("is gray when stopped", () => {
    expect(statusDot("exited")).toBe(gray("●"));
    expect(statusDot("created")).toBe(gray("●"));
  });
  it("is yellow for anything else", () => {
    expect(statusDot("restarting")).toBe(yellow("●"));
  });
});

describe("renderCocoonList", () => {
  it("shows an empty-state hint when there are no cocoons", () => {
    expect(stripAnsi(renderCocoonList([]))).toContain("No cocoons yet");
  });

  it("prefers the project dir over the container name", () => {
    const out = stripAnsi(
      renderCocoonList([
        { name: "cocoon-abc123", projectDir: "/home/user/proj", state: "running", status: "Up 3m" },
      ]),
    );
    expect(out).toContain("/home/user/proj");
    expect(out).toContain("running");
    expect(out).toContain("Up 3m");
    expect(out).not.toContain("cocoon-abc123");
  });

  it("falls back to the container name when no project dir is labeled", () => {
    const out = stripAnsi(
      renderCocoonList([{ name: "cocoon-old", state: "exited", status: "Exited" }]),
    );
    expect(out).toContain("cocoon-old");
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
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
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
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("second");
    spinner.stop();
  });

  it("success stops and prints a check mark", () => {
    const spinner = createSpinner("doing");
    spinner.start();
    spinner.success("done!");
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("✔");
    expect(stripAnsi(output)).toContain("done!");
  });
});

describe("createSpinner TTY gating", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    setDebug(false);
    vi.useFakeTimers();
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    originalIsTTY = process.stderr.isTTY;
  });

  afterEach(() => {
    vi.useRealTimers();
    writeSpy.mockRestore();
    Object.defineProperty(process.stderr, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("animates without --debug when stderr is a TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    const spinner = createSpinner("loading");
    spinner.start();
    spinner.success("ready");
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("ready");
  });

  it("stays silent without --debug when stderr is not a TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
    const spinner = createSpinner("loading");
    spinner.start();
    spinner.success("ready");
    expect(writeSpy).not.toHaveBeenCalled();
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
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ·");
    expect(stripAnsi(output)).toContain("hello world");
  });

  it("warn writes prefixed warning to stderr", () => {
    warn("danger");
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ⚠");
    expect(stripAnsi(output)).toContain("danger");
  });

  it("success writes prefixed success to stderr", () => {
    success("all good");
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(stripAnsi(output)).toContain("cocoon ✔");
    expect(stripAnsi(output)).toContain("all good");
  });
});
