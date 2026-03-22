import { describe, it, expect } from "vitest";
import { hashProjectPath, expandTilde, resolveProjectDir, containerName } from "../src/utils.js";
import { homedir } from "os";
import { resolve } from "path";

describe("expandTilde", () => {
  it("expands ~ to home directory", () => {
    const result = expandTilde("~/foo/bar");
    expect(result).toBe(`${homedir()}/foo/bar`);
  });

  it("leaves absolute paths unchanged", () => {
    const result = expandTilde("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  it("leaves relative paths unchanged", () => {
    const result = expandTilde("relative/path");
    expect(result).toBe("relative/path");
  });
});

describe("hashProjectPath", () => {
  it("returns a 12-char hex string", () => {
    const result = hashProjectPath("/some/project");
    expect(result).toMatch(/^[a-f0-9]{12}$/);
  });

  it("is deterministic", () => {
    const a = hashProjectPath("/some/project");
    const b = hashProjectPath("/some/project");
    expect(a).toBe(b);
  });

  it("differs for different paths", () => {
    const a = hashProjectPath("/project/a");
    const b = hashProjectPath("/project/b");
    expect(a).not.toBe(b);
  });
});

describe("resolveProjectDir", () => {
  it("resolves relative paths to absolute", () => {
    const result = resolveProjectDir("./foo");
    expect(result).toBe(resolve("./foo"));
  });

  it("keeps absolute paths as-is", () => {
    const result = resolveProjectDir("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  it("expands tilde", () => {
    const result = resolveProjectDir("~/projects/foo");
    expect(result).toBe(`${homedir()}/projects/foo`);
  });
});

describe("containerName", () => {
  it("returns cocoon-<hash> format", () => {
    const result = containerName("/some/project");
    expect(result).toMatch(/^cocoon-[a-f0-9]{12}$/);
  });
});
