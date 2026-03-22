import { describe, it, expect } from "vitest";
import { buildMountBinds, buildEnvVars } from "../src/container.js";
import { homedir } from "os";

describe("buildMountBinds", () => {
  it("includes required mounts for project and claude config", () => {
    const binds = buildMountBinds("/my/project", []);
    expect(binds).toContain("/my/project:/workspace:rw");
    expect(binds).toContain(`${homedir()}/.claude:/home/claude/.claude:rw`);
  });

  it("includes additional configured mounts when host path exists", () => {
    const extra = [{ host: "/tmp", container: "/data", mode: "ro" as const }];
    const binds = buildMountBinds("/my/project", extra);
    expect(binds).toContain("/tmp:/data:ro");
  });

  it("skips mounts when host path does not exist", () => {
    const extra = [{ host: "/nonexistent/path", container: "/data", mode: "ro" as const }];
    const binds = buildMountBinds("/my/project", extra);
    expect(binds).not.toContain("/nonexistent/path:/data:ro");
  });
});

describe("buildEnvVars", () => {
  it("forwards CLAUDE_* env vars from host", () => {
    const original = process.env.CLAUDE_MODEL;
    process.env.CLAUDE_MODEL = "sonnet";
    const envs = buildEnvVars({});
    expect(envs).toContain("CLAUDE_MODEL=sonnet");
    if (original === undefined) delete process.env.CLAUDE_MODEL;
    else process.env.CLAUDE_MODEL = original;
  });

  it("includes custom env vars", () => {
    const envs = buildEnvVars({ FOO: "bar" });
    expect(envs).toContain("FOO=bar");
  });
});
