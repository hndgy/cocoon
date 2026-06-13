import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

/**
 * Service name Claude Code uses for its macOS Keychain credential entry.
 * On macOS the OAuth credentials live in the login Keychain rather than in
 * `~/.claude/.credentials.json`, so the on-disk file is absent there.
 */
export const KEYCHAIN_SERVICE = "Claude Code-credentials";

export interface CredentialSource {
  /** Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Defaults to the OS home directory. */
  home?: string;
  /** Defaults to `process.env.CLAUDE_CONFIG_DIR`. */
  configDirEnv?: string;
  /** Reads a file as UTF-8, returning undefined if it can't be read. Injectable for tests. */
  readFile?: (path: string) => string | undefined;
  /** Returns the raw Keychain secret, or undefined if unavailable. Injectable for tests. */
  readKeychain?: () => string | undefined;
}

function defaultReadFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

function defaultReadKeychain(): string | undefined {
  try {
    return execFileSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
      encoding: "utf-8",
    });
  } catch {
    return undefined;
  }
}

function isCredentialJson(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

/** Absolute path to the host's Claude credentials file for the given source. */
export function hostCredentialsFilePath(opts: CredentialSource = {}): string {
  const home = opts.home ?? homedir();
  const configDir = opts.configDirEnv ?? process.env.CLAUDE_CONFIG_DIR ?? resolve(home, ".claude");
  return resolve(configDir, ".credentials.json");
}

/**
 * Resolves the host's Claude OAuth credentials JSON, or undefined if the host
 * isn't logged in. Checks the on-disk credentials file first (Linux and some
 * macOS setups), then falls back to the macOS login Keychain.
 *
 * Returns the raw JSON string exactly as stored, so it can be written verbatim
 * into the container's config directory.
 */
export function resolveHostCredentials(opts: CredentialSource = {}): string | undefined {
  const platform = opts.platform ?? process.platform;
  const readFile = opts.readFile ?? defaultReadFile;

  const fileContents = readFile(hostCredentialsFilePath(opts));
  if (fileContents && isCredentialJson(fileContents)) {
    return fileContents.trim();
  }

  if (platform === "darwin") {
    const readKeychain = opts.readKeychain ?? defaultReadKeychain;
    const keychainSecret = readKeychain();
    if (keychainSecret && isCredentialJson(keychainSecret)) {
      return keychainSecret.trim();
    }
  }

  return undefined;
}
