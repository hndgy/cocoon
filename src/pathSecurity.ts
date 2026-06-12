import { resolve } from "path";
import { homedir } from "os";
import { expandTilde } from "./utils.js";
import type { MountConfig } from "./config.js";

const BLOCKED_PATHS: string[] = ["/", "/var/run/docker.sock", "/run/docker.sock"];

const BLOCKED_HOME_RELATIVE: string[] = [".ssh", ".gnupg", ".aws", ".config", ".docker"];

const BLOCKED_PREFIXES: string[] = ["/proc", "/sys", "/dev", "/etc", "/boot", "/root"];

function normalizePath(p: string, home: string): string {
  if (p.includes("\0")) {
    throw new Error("Path contains null bytes, which is not allowed.");
  }
  const expanded = expandTilde(p, home);
  const resolved = resolve(expanded);
  // Strip trailing slashes (but keep "/" as-is)
  return resolved === "/" ? "/" : resolved.replace(/\/+$/, "");
}

/**
 * Returns a reason string if the path is blocked, or undefined if allowed.
 * Checks exact matches, the current user's home subtree, and system prefixes.
 *
 * The `home` parameter is injectable (defaults to the OS home directory) so the
 * logic is deterministic and testable. It also fixes a real bug: paths inside
 * the current user's own home must stay usable even when that home falls under a
 * blocked system prefix — e.g. running as root, where HOME is `/root`. Without
 * this, a root user's legitimate project at `/root/projects/app` would be
 * blocked. Sensitive subdirectories (`~/.ssh`, etc.) remain blocked regardless.
 *
 * Note: This does not follow symlinks (realpathSync fails on non-existent paths).
 * A determined attacker with host write access could create symlinks to bypass this,
 * but that requires a different threat model (pre-existing host compromise).
 */
export function getBlockedReason(hostPath: string, home: string = homedir()): string | undefined {
  const normalized = normalizePath(hostPath, home);

  // Exact match
  if (BLOCKED_PATHS.includes(normalized)) {
    return `'${normalized}' is a sensitive system path`;
  }

  // The current user's own home subtree is governed by the home-relative
  // blocklist, NOT the broad system-prefix list. This keeps paths like
  // ~/projects or ~/.gitconfig usable even when HOME is under a blocked prefix.
  if (normalized === home || normalized.startsWith(home + "/")) {
    for (const rel of BLOCKED_HOME_RELATIVE) {
      const sensitiveDir = resolve(home, rel);
      if (normalized === sensitiveDir || normalized.startsWith(sensitiveDir + "/")) {
        return `'${normalized}' is under the sensitive '~/${rel}' directory`;
      }
    }
    return undefined;
  }

  // Prefix match for everything outside the current home
  // (e.g., /proc/1/mem, /sys/kernel, /dev/sda, another user's /root).
  for (const prefix of BLOCKED_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + "/")) {
      return `'${normalized}' is under the sensitive '${prefix}' hierarchy`;
    }
  }

  return undefined;
}

export function validateMount(mount: MountConfig, source: string): void {
  const reason = getBlockedReason(mount.host);
  if (reason) {
    throw new Error(
      `Blocked mount from ${source}: ${reason}. Mounting this path is not allowed for security reasons.`,
    );
  }
}

export function validateMounts(mounts: MountConfig[], source: string): void {
  for (const mount of mounts) {
    validateMount(mount, source);
  }
}

export function validateProjectDir(projectDir: string): void {
  const reason = getBlockedReason(projectDir);
  if (reason) {
    throw new Error(
      `Blocked project directory: ${reason}. This path cannot be used as a project directory.`,
    );
  }
}
