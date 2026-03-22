import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface MountConfig {
  host: string;
  container: string;
  mode: "ro" | "rw";
}

export interface Config {
  mounts: MountConfig[];
  env?: Record<string, string>;
  image?: string;
  dockerfile?: string;
}

export interface ResolvedConfig {
  mounts: MountConfig[];
  env: Record<string, string>;
  image: string;
  dockerfile?: string;
}

const DEFAULTS: ResolvedConfig = {
  mounts: [],
  env: {},
  image: "claude-container:latest",
};

export function loadConfig(projectDir: string): Config | undefined {
  const configPath = join(projectDir, ".claude-container.json");
  if (!existsSync(configPath)) {
    return undefined;
  }
  const raw = readFileSync(configPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${configPath}: ${(e as Error).message}`);
  }
  return validateConfig(parsed);
}

function validateConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const config: Config = { mounts: [] };

  if (obj.mounts !== undefined) {
    if (!Array.isArray(obj.mounts)) {
      throw new Error("Config 'mounts' must be an array");
    }
    config.mounts = obj.mounts.map((m: unknown, i: number) => {
      if (typeof m !== "object" || m === null) {
        throw new Error(`Config 'mounts[${i}]' must be an object`);
      }
      const mount = m as Record<string, unknown>;
      if (typeof mount.host !== "string") throw new Error(`Config 'mounts[${i}].host' must be a string`);
      if (typeof mount.container !== "string") throw new Error(`Config 'mounts[${i}].container' must be a string`);
      const mode = mount.mode ?? "rw";
      if (mode !== "ro" && mode !== "rw") throw new Error(`Config 'mounts[${i}].mode' must be "ro" or "rw"`);
      return { host: mount.host, container: mount.container, mode: mode as "ro" | "rw" };
    });
  }

  if (obj.env !== undefined) {
    if (typeof obj.env !== "object" || obj.env === null || Array.isArray(obj.env)) {
      throw new Error("Config 'env' must be an object");
    }
    config.env = obj.env as Record<string, string>;
  }

  if (obj.image !== undefined) {
    if (typeof obj.image !== "string") throw new Error("Config 'image' must be a string");
    config.image = obj.image;
  }

  if (obj.dockerfile !== undefined) {
    if (typeof obj.dockerfile !== "string") throw new Error("Config 'dockerfile' must be a string");
    config.dockerfile = obj.dockerfile;
  }

  return config;
}

export function mergeConfig(
  fileConfig: Config | undefined,
  cliOverrides: { mounts: MountConfig[]; envs: string[] },
): ResolvedConfig {
  const base = fileConfig ?? { mounts: [] };

  const env: Record<string, string> = { ...(base.env ?? {}) };
  for (const entry of cliOverrides.envs) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex > 0) {
      env[entry.slice(0, eqIndex)] = entry.slice(eqIndex + 1);
    }
  }

  return {
    mounts: [...(base.mounts ?? []), ...cliOverrides.mounts],
    env,
    image: base.image ?? DEFAULTS.image,
    dockerfile: base.dockerfile,
  };
}
