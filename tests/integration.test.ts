import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = resolve(__dirname, "..", "dist", "index.js");

describe("CLI integration", () => {
  it("shows version with --version", () => {
    const output = execSync(`node ${cli} --version`, { encoding: "utf-8" });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows help with --help", () => {
    const output = execSync(`node ${cli} --help`, { encoding: "utf-8" });
    expect(output).toContain("cocoon");
    expect(output).toContain("--dir");
    expect(output).toContain("--mount");
  });
});
