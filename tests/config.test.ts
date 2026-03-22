import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, mergeConfig, type Config, type MountConfig } from "../src/config.js";
import { homedir } from "os";

describe("mergeConfig", () => {
  it("returns defaults when no config file", () => {
    const config = mergeConfig(undefined, { mounts: [], envs: [] });
    expect(config.mounts).toEqual([]);
    expect(config.env).toEqual({});
    expect(config.image).toBe("cocoon:latest");
  });

  it("merges file config with CLI overrides", () => {
    const fileConfig: Config = {
      mounts: [{ host: "~/.gitconfig", container: "/home/claude/.gitconfig", mode: "ro" as const }],
      env: { FOO: "bar" },
      image: "custom:latest",
    };
    const cliOverrides = {
      mounts: [{ host: "/tmp/data", container: "/data", mode: "rw" as const }],
      envs: ["BAZ=qux"],
    };
    const merged = mergeConfig(fileConfig, cliOverrides);
    expect(merged.mounts).toHaveLength(2);
    expect(merged.env).toEqual({ FOO: "bar", BAZ: "qux" });
    expect(merged.image).toBe("custom:latest");
  });

  it("CLI --env overrides file env for same key", () => {
    const fileConfig: Config = {
      mounts: [],
      env: { FOO: "from-file" },
    };
    const merged = mergeConfig(fileConfig, { mounts: [], envs: ["FOO=from-cli"] });
    expect(merged.env).toEqual({ FOO: "from-cli" });
  });
});
