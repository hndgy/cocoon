import Docker from "dockerode";
import { homedir } from "os";
import { existsSync } from "fs";
import { expandTilde, containerName, log } from "./utils.js";
import type { MountConfig } from "./config.js";

const docker = new Docker();

export function buildMountBinds(projectDir: string, extraMounts: MountConfig[]): string[] {
  const claudeDir = `${homedir()}/.claude`;
  const binds = [
    `${projectDir}:/workspace:rw`,
    `${claudeDir}:/home/claude/.claude-config:rw`,
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

  const claudeDir = `${homedir()}/.claude`;
  if (!existsSync(claudeDir)) {
    throw new Error(
      "~/.claude not found. Run `claude` on the host first to set up authentication.",
    );
  }

  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();

    if (!info.State.Running) {
      log("Starting existing container...");
      await container.start();
    }

    return name;
  } catch {
    log("Creating new container...");

    const binds = buildMountBinds(projectDir, mounts);
    const envVars = buildEnvVars(env);

    await docker.createContainer({
      name,
      Image: imageName,
      Env: envVars,
      WorkingDir: "/workspace",
      HostConfig: {
        Binds: binds,
      },
      Tty: true,
      OpenStdin: true,
    });

    const container = docker.getContainer(name);
    await container.start();
    log("Container started.");
    return name;
  }
}

export async function stopContainer(projectDir: string): Promise<void> {
  const name = containerName(projectDir);
  try {
    const container = docker.getContainer(name);
    await container.stop();
    log(`Container ${name} stopped.`);
  } catch {
    log("Container is not running.");
  }
}

export async function resetContainer(projectDir: string): Promise<void> {
  const name = containerName(projectDir);
  try {
    const container = docker.getContainer(name);
    try { await container.stop(); } catch { /* already stopped */ }
    await container.remove();
    log(`Container ${name} removed.`);
  } catch {
    log("No existing container to remove.");
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
    c.Names.some((n) => n.replace(/^\//, "").startsWith("claude-container-")),
  );

  if (ours.length === 0) {
    return "No claude-container instances found.";
  }

  const lines = ours.map((c) => {
    const name = c.Names[0].replace(/^\//, "");
    return `  ${name}  ${c.State}  ${c.Status}`;
  });
  return `Claude containers:\n${lines.join("\n")}`;
}
