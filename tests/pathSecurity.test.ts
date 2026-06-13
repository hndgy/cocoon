import { describe, it, expect } from "vitest";
import { homedir } from "os";
import { resolve } from "path";
import {
  getBlockedReason,
  validateMount,
  validateMounts,
  validateProjectDir,
} from "../src/pathSecurity.js";

// Use a fixed, non-root home so these assertions are deterministic regardless of
// which user runs the suite (e.g. root in CI, where the real HOME is /root).
const HOME = "/home/testuser";

describe("getBlockedReason", () => {
  it("blocks root path /", () => {
    expect(getBlockedReason("/", HOME)).toBeDefined();
  });

  it("blocks /etc", () => {
    expect(getBlockedReason("/etc", HOME)).toBeDefined();
  });

  it("blocks /etc/shadow", () => {
    expect(getBlockedReason("/etc/shadow", HOME)).toBeDefined();
  });

  it("blocks /etc/passwd", () => {
    expect(getBlockedReason("/etc/passwd", HOME)).toBeDefined();
  });

  it("blocks /var/run/docker.sock", () => {
    expect(getBlockedReason("/var/run/docker.sock", HOME)).toBeDefined();
  });

  it("blocks /run/docker.sock", () => {
    expect(getBlockedReason("/run/docker.sock", HOME)).toBeDefined();
  });

  it("blocks /proc and subpaths", () => {
    expect(getBlockedReason("/proc", HOME)).toBeDefined();
    expect(getBlockedReason("/proc/1/mem", HOME)).toBeDefined();
  });

  it("blocks /sys and subpaths", () => {
    expect(getBlockedReason("/sys", HOME)).toBeDefined();
    expect(getBlockedReason("/sys/kernel", HOME)).toBeDefined();
  });

  it("blocks /dev and subpaths", () => {
    expect(getBlockedReason("/dev", HOME)).toBeDefined();
    expect(getBlockedReason("/dev/sda", HOME)).toBeDefined();
  });

  it("blocks ~/.ssh", () => {
    expect(getBlockedReason(resolve(HOME, ".ssh"), HOME)).toBeDefined();
  });

  it("blocks ~/.ssh subpaths", () => {
    expect(getBlockedReason(resolve(HOME, ".ssh/id_rsa"), HOME)).toBeDefined();
  });

  it("blocks ~/.gnupg", () => {
    expect(getBlockedReason(resolve(HOME, ".gnupg"), HOME)).toBeDefined();
  });

  it("blocks ~/.aws", () => {
    expect(getBlockedReason(resolve(HOME, ".aws"), HOME)).toBeDefined();
  });

  it("blocks ~/.docker", () => {
    expect(getBlockedReason(resolve(HOME, ".docker"), HOME)).toBeDefined();
  });

  it("blocks ~/.config", () => {
    expect(getBlockedReason(resolve(HOME, ".config"), HOME)).toBeDefined();
  });

  it("allows normal project paths", () => {
    expect(getBlockedReason("/home/user/projects/myapp", HOME)).toBeUndefined();
  });

  it("allows /tmp", () => {
    expect(getBlockedReason("/tmp", HOME)).toBeUndefined();
  });

  it("allows ~/.gitconfig (not in blocked list)", () => {
    expect(getBlockedReason(resolve(HOME, ".gitconfig"), HOME)).toBeUndefined();
  });

  it("allows a project inside the user's own home", () => {
    expect(getBlockedReason(resolve(HOME, "projects/app"), HOME)).toBeUndefined();
  });

  it("allows a home subtree even when home is under a blocked prefix (running as root)", () => {
    // Regression: with HOME=/root, /root/projects/app must stay usable...
    expect(getBlockedReason("/root/projects/app", "/root")).toBeUndefined();
    expect(getBlockedReason(resolve("/root", ".gitconfig"), "/root")).toBeUndefined();
    // ...but sensitive subdirs are still blocked.
    expect(getBlockedReason("/root/.ssh", "/root")).toBeDefined();
  });

  it("handles paths with trailing slashes", () => {
    expect(getBlockedReason("/etc/", HOME)).toBeDefined();
  });

  it("resolves .. segments", () => {
    expect(getBlockedReason("/etc/../etc", HOME)).toBeDefined();
    expect(getBlockedReason("/tmp/../etc", HOME)).toBeDefined();
  });

  it("blocks tilde-prefixed sensitive paths", () => {
    expect(getBlockedReason("~/.ssh", HOME)).toBeDefined();
    expect(getBlockedReason("~/.aws", HOME)).toBeDefined();
  });

  it("blocks /etc subpaths like /etc/sudoers", () => {
    expect(getBlockedReason("/etc/sudoers", HOME)).toBeDefined();
    expect(getBlockedReason("/etc/crontab", HOME)).toBeDefined();
  });

  it("blocks another user's /root", () => {
    expect(getBlockedReason("/root", HOME)).toBeDefined();
    expect(getBlockedReason("/root/.bashrc", HOME)).toBeDefined();
  });

  it("blocks /boot", () => {
    expect(getBlockedReason("/boot", HOME)).toBeDefined();
  });

  it("does not false-positive on prefix-similar paths", () => {
    expect(getBlockedReason("/processed", HOME)).toBeUndefined();
    expect(getBlockedReason("/developer", HOME)).toBeUndefined();
    expect(getBlockedReason("/systems", HOME)).toBeUndefined();
    expect(getBlockedReason("/etcetera", HOME)).toBeUndefined();
  });

  it("rejects paths with null bytes", () => {
    expect(() => getBlockedReason("/etc\0anything", HOME)).toThrow(/null bytes/i);
  });
});

describe("validateMount", () => {
  it("throws for a blocked host path", () => {
    const mount = { host: "/etc/shadow", container: "/data", mode: "ro" as const };
    expect(() => validateMount(mount, "cli")).toThrow(/blocked/i);
  });

  it("includes source in error message", () => {
    const mount = { host: "/etc", container: "/data", mode: "ro" as const };
    expect(() => validateMount(mount, "config file")).toThrow(/config file/);
  });

  it("does not throw for an allowed host path", () => {
    const mount = { host: "/tmp", container: "/data", mode: "ro" as const };
    expect(() => validateMount(mount, "cli")).not.toThrow();
  });
});

describe("validateMounts", () => {
  it("throws on first blocked mount", () => {
    const mounts = [
      { host: "/tmp", container: "/a", mode: "ro" as const },
      { host: "/etc", container: "/b", mode: "ro" as const },
    ];
    expect(() => validateMounts(mounts, "cli")).toThrow(/blocked/i);
  });

  it("passes when all mounts are allowed", () => {
    const mounts = [
      { host: "/tmp", container: "/a", mode: "ro" as const },
      { host: "/home/user/project", container: "/b", mode: "rw" as const },
    ];
    expect(() => validateMounts(mounts, "cli")).not.toThrow();
  });

  it("passes for empty array", () => {
    expect(() => validateMounts([], "cli")).not.toThrow();
  });
});

describe("validateProjectDir", () => {
  it("throws for / as project dir", () => {
    expect(() => validateProjectDir("/")).toThrow(/blocked/i);
  });

  it("throws for /etc as project dir", () => {
    expect(() => validateProjectDir("/etc")).toThrow(/blocked/i);
  });

  it("throws for ~/.ssh as project dir", () => {
    expect(() => validateProjectDir(resolve(homedir(), ".ssh"))).toThrow(/blocked/i);
  });

  it("allows normal project directories", () => {
    expect(() => validateProjectDir("/home/user/projects/myapp")).not.toThrow();
  });

  it("allows /tmp as project dir", () => {
    expect(() => validateProjectDir("/tmp")).not.toThrow();
  });
});
