import { describe, it, expect } from "vitest";
import { homedir } from "os";
import { resolve } from "path";
import { getBlockedReason, validateMount, validateMounts, validateProjectDir } from "../src/pathSecurity.js";

describe("getBlockedReason", () => {
  it("blocks root path /", () => {
    expect(getBlockedReason("/")).toBeDefined();
  });

  it("blocks /etc", () => {
    expect(getBlockedReason("/etc")).toBeDefined();
  });

  it("blocks /etc/shadow", () => {
    expect(getBlockedReason("/etc/shadow")).toBeDefined();
  });

  it("blocks /etc/passwd", () => {
    expect(getBlockedReason("/etc/passwd")).toBeDefined();
  });

  it("blocks /var/run/docker.sock", () => {
    expect(getBlockedReason("/var/run/docker.sock")).toBeDefined();
  });

  it("blocks /run/docker.sock", () => {
    expect(getBlockedReason("/run/docker.sock")).toBeDefined();
  });

  it("blocks /proc and subpaths", () => {
    expect(getBlockedReason("/proc")).toBeDefined();
    expect(getBlockedReason("/proc/1/mem")).toBeDefined();
  });

  it("blocks /sys and subpaths", () => {
    expect(getBlockedReason("/sys")).toBeDefined();
    expect(getBlockedReason("/sys/kernel")).toBeDefined();
  });

  it("blocks /dev and subpaths", () => {
    expect(getBlockedReason("/dev")).toBeDefined();
    expect(getBlockedReason("/dev/sda")).toBeDefined();
  });

  it("blocks ~/.ssh", () => {
    expect(getBlockedReason(resolve(homedir(), ".ssh"))).toBeDefined();
  });

  it("blocks ~/.ssh subpaths", () => {
    expect(getBlockedReason(resolve(homedir(), ".ssh/id_rsa"))).toBeDefined();
  });

  it("blocks ~/.gnupg", () => {
    expect(getBlockedReason(resolve(homedir(), ".gnupg"))).toBeDefined();
  });

  it("blocks ~/.aws", () => {
    expect(getBlockedReason(resolve(homedir(), ".aws"))).toBeDefined();
  });

  it("blocks ~/.docker", () => {
    expect(getBlockedReason(resolve(homedir(), ".docker"))).toBeDefined();
  });

  it("blocks ~/.config", () => {
    expect(getBlockedReason(resolve(homedir(), ".config"))).toBeDefined();
  });

  it("allows normal project paths", () => {
    expect(getBlockedReason("/home/user/projects/myapp")).toBeUndefined();
  });

  it("allows /tmp", () => {
    expect(getBlockedReason("/tmp")).toBeUndefined();
  });

  it("allows ~/.gitconfig (not in blocked list)", () => {
    expect(getBlockedReason(resolve(homedir(), ".gitconfig"))).toBeUndefined();
  });

  it("handles paths with trailing slashes", () => {
    expect(getBlockedReason("/etc/")).toBeDefined();
  });

  it("resolves .. segments", () => {
    expect(getBlockedReason("/etc/../etc")).toBeDefined();
    expect(getBlockedReason("/tmp/../etc")).toBeDefined();
  });

  it("blocks tilde-prefixed sensitive paths", () => {
    expect(getBlockedReason("~/.ssh")).toBeDefined();
    expect(getBlockedReason("~/.aws")).toBeDefined();
  });

  it("blocks /etc subpaths like /etc/sudoers", () => {
    expect(getBlockedReason("/etc/sudoers")).toBeDefined();
    expect(getBlockedReason("/etc/crontab")).toBeDefined();
  });

  it("blocks /root", () => {
    expect(getBlockedReason("/root")).toBeDefined();
    expect(getBlockedReason("/root/.bashrc")).toBeDefined();
  });

  it("blocks /boot", () => {
    expect(getBlockedReason("/boot")).toBeDefined();
  });

  it("does not false-positive on prefix-similar paths", () => {
    expect(getBlockedReason("/processed")).toBeUndefined();
    expect(getBlockedReason("/developer")).toBeUndefined();
    expect(getBlockedReason("/systems")).toBeUndefined();
    expect(getBlockedReason("/etcetera")).toBeUndefined();
  });

  it("rejects paths with null bytes", () => {
    expect(() => getBlockedReason("/etc\0anything")).toThrow(/null bytes/i);
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
