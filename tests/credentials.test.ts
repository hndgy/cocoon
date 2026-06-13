import { describe, it, expect } from "vitest";
import { resolveHostCredentials, hostCredentialsFilePath } from "../src/credentials.js";

const CREDS = '{"claudeAiOauth":{"accessToken":"abc"}}';

describe("hostCredentialsFilePath", () => {
  it("defaults to ~/.claude/.credentials.json", () => {
    expect(hostCredentialsFilePath({ home: "/home/alice" })).toBe(
      "/home/alice/.claude/.credentials.json",
    );
  });

  it("honors a CLAUDE_CONFIG_DIR override", () => {
    expect(hostCredentialsFilePath({ home: "/home/alice", configDirEnv: "/custom/cfg" })).toBe(
      "/custom/cfg/.credentials.json",
    );
  });
});

describe("resolveHostCredentials", () => {
  it("reads the on-disk credentials file when present", () => {
    const result = resolveHostCredentials({
      platform: "linux",
      home: "/home/alice",
      readFile: (p) => (p === "/home/alice/.claude/.credentials.json" ? CREDS : undefined),
    });
    expect(result).toBe(CREDS);
  });

  it("trims surrounding whitespace from the file contents", () => {
    const result = resolveHostCredentials({
      platform: "linux",
      home: "/home/alice",
      readFile: () => `\n${CREDS}\n`,
    });
    expect(result).toBe(CREDS);
  });

  it("falls back to the macOS Keychain when the file is absent", () => {
    const result = resolveHostCredentials({
      platform: "darwin",
      home: "/Users/alice",
      readFile: () => undefined,
      readKeychain: () => CREDS,
    });
    expect(result).toBe(CREDS);
  });

  it("prefers the on-disk file over the Keychain when both exist", () => {
    const result = resolveHostCredentials({
      platform: "darwin",
      home: "/Users/alice",
      readFile: () => CREDS,
      readKeychain: () => '{"from":"keychain"}',
    });
    expect(result).toBe(CREDS);
  });

  it("does not consult the Keychain on non-macOS platforms", () => {
    let keychainCalled = false;
    const result = resolveHostCredentials({
      platform: "linux",
      home: "/home/alice",
      readFile: () => undefined,
      readKeychain: () => {
        keychainCalled = true;
        return CREDS;
      },
    });
    expect(result).toBeUndefined();
    expect(keychainCalled).toBe(false);
  });

  it("returns undefined when the host isn't logged in anywhere", () => {
    const result = resolveHostCredentials({
      platform: "darwin",
      home: "/Users/alice",
      readFile: () => undefined,
      readKeychain: () => undefined,
    });
    expect(result).toBeUndefined();
  });

  it("ignores non-JSON garbage from either source", () => {
    const result = resolveHostCredentials({
      platform: "darwin",
      home: "/Users/alice",
      readFile: () => "not json",
      readKeychain: () => "still not json",
    });
    expect(result).toBeUndefined();
  });

  it("ignores a JSON file that isn't an object (e.g. a bare string)", () => {
    const result = resolveHostCredentials({
      platform: "linux",
      home: "/home/alice",
      readFile: () => '"a string"',
    });
    expect(result).toBeUndefined();
  });
});
