import Docker from "dockerode";
import { existsSync } from "fs";
import { expandTilde, containerName } from "./utils.js";
import { log } from "./ui.js";
import type { MountConfig } from "./config.js";
import { validateProjectDir, validateMounts } from "./pathSecurity.js";

const docker = new Docker();

export function buildMountBinds(projectDir: string, extraMounts: MountConfig[]): string[] {
  // Defense-in-depth: validate even if callers already checked
  validateProjectDir(projectDir);
  validateMounts(extraMounts, "mount");

  const binds = [
    `${projectDir}:/workspace:rw`,
  ];

  for (const mount of extraMounts) {
    const hostPath = expandTilde(mount.host);
    if (!existsSync(hostPath)) {
      log(`Warning: mount source '${mount.host}' does not exist, skipping`);
      continue;
    }
    binds.push(`${hostPath}:${mount.container}:${mount.mode}`);
  }

  return binds;
}

export function buildEnvVars(customEnv: Record<string, string>): string[] {
  const envs: string[] = [];

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("CLAUDE_") && value !== undefined) {
      envs.push(`${key}=${value}`);
    }
  }

  for (const [key, value] of Object.entries(customEnv)) {
    envs.push(`${key}=${value}`);
  }

  return envs;
}

export async function ensureContainer(
  projectDir: string,
  imageName: string,
  mounts: MountConfig[],
  env: Record<string, string>,
): Promise<string> {
  const name = containerName(projectDir);

  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();

    if (!info.State.Running) {
      log("Waking up cocoon...");
      await container.start();
      log("Cocoon is awake.");
    } else {
      log("Cocoon already running.");
    }

    return name;
  } catch {
    log("Spinning up a fresh cocoon...");

    const binds = buildMountBinds(projectDir, mounts);
    const envVars = buildEnvVars(env);

    await docker.createContainer({
      name,
      Image: imageName,
      Env: envVars,
      WorkingDir: "/workspace",
      HostConfig: {
        Binds: binds,
        Mounts: [{
          Target: "/home/claude/.claude-config",
          Source: `${name}-config`,
          Type: "volume" as const,
        }],
      },
      Tty: true,
      OpenStdin: true,
    });

    const container = docker.getContainer(name);
    await container.start();
    log("Cocoon spun up and running.");
    return name;
  }
}

export async function stopContainer(projectDir: string): Promise<void> {
  const name = containerName(projectDir);
  try {
    const container = docker.getContainer(name);
    await container.stop();
    log("Cocoon tucked away.");
  } catch {
    log("Cocoon is already asleep.");
  }
}

export async function resetContainer(projectDir: string): Promise<void> {
  const name = containerName(projectDir);
  try {
    const container = docker.getContainer(name);
    try { await container.stop(); } catch { /* already stopped */ }
    await container.remove();
    log("Cocoon unwrapped.");
  } catch {
    log("No cocoon to unwrap.");
  }
}

export async function getContainerStatus(projectDir: string): Promise<string> {
  const name = containerName(projectDir);
  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();
    return `Container: ${name}\nStatus: ${info.State.Status}\nCreated: ${info.Created}`;
  } catch {
    return `No container found for this project (would be named ${name})`;
  }
}

export async function listContainers(): Promise<string> {
  const containers = await docker.listContainers({ all: true });
  const ours = containers.filter((c) =>
    c.Names.some((n) => n.replace(/^\//, "").startsWith("cocoon-")),
  );

  if (ours.length === 0) {
    return "No cocoon instances found.";
  }

  const lines = ours.map((c) => {
    const name = c.Names[0].replace(/^\//, "");
    return `  ${name}  ${c.State}  ${c.Status}`;
  });
  return `Cocoon instances:\n${lines.join("\n")}`;
}
