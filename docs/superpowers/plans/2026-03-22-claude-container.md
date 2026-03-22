# claude-container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI (`claude-container`) that transparently runs Claude Code inside a Docker container for sandboxing and security.

**Architecture:** Thin CLI wrapper using `commander` for arg parsing, `dockerode` for Docker API operations (build, create, start, stop, inspect), and `child_process.spawn` for TTY-attached `docker exec`. One persistent container per project, identified by a hash of the absolute project path.

**Tech Stack:** TypeScript, Node.js, dockerode, commander, Docker

---

## File Structure

```
claude-container/
├── package.json              # Package manifest, bin entry, scripts
├── tsconfig.json             # TypeScript config
├── Dockerfile                # Container image definition
├── src/
│   ├── index.ts              # CLI entry point — parse args, dispatch commands
│   ├── config.ts             # Load/validate .claude-container.json, merge defaults
│   ├── image.ts              # Build image, check if rebuild needed
│   ├── container.ts          # Create/start/stop/reset/inspect containers
│   ├── exec.ts               # Spawn docker exec with TTY, signal forwarding
│   └── utils.ts              # Path resolution, hashing, tilde expansion, logging
├── tests/
│   ├── config.test.ts        # Config loading and validation
│   ├── utils.test.ts         # Hashing, path resolution, tilde expansion
│   ├── image.test.ts         # Image build logic
│   ├── container.test.ts     # Container lifecycle logic
│   └── integration.test.ts   # End-to-end with real Docker
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/nicolasdeguyenne/code/claude-container
npm init -y
```

Then edit `package.json`:

```json
{
  "name": "claude-container",
  "version": "0.1.0",
  "description": "Run Claude Code in a Docker container for sandboxing and security",
  "main": "dist/index.js",
  "bin": {
    "claude-container": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["claude", "docker", "container", "sandbox"],
  "license": "MIT",
  "type": "module"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install dockerode commander
npm install -D typescript @types/node @types/dockerode vitest
```

- [ ] **Step 4: Create placeholder entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
console.log("claude-container");
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
node dist/index.js
```

Expected: prints "claude-container"

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/index.ts package-lock.json
git commit -m "feat: scaffold project with TypeScript, dockerode, commander"
```

---

### Task 2: Utility Functions

**Files:**
- Create: `src/utils.ts`
- Create: `tests/utils.test.ts`

- [ ] **Step 1: Write failing tests for utils**

Create `tests/utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashProjectPath, expandTilde, resolveProjectDir, containerName } from "../src/utils.js";
import { homedir } from "os";
import { resolve } from "path";

describe("expandTilde", () => {
  it("expands ~ to home directory", () => {
    const result = expandTilde("~/foo/bar");
    expect(result).toBe(`${homedir()}/foo/bar`);
  });

  it("leaves absolute paths unchanged", () => {
    const result = expandTilde("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  it("leaves relative paths unchanged", () => {
    const result = expandTilde("relative/path");
    expect(result).toBe("relative/path");
  });
});

describe("hashProjectPath", () => {
  it("returns a 12-char hex string", () => {
    const result = hashProjectPath("/some/project");
    expect(result).toMatch(/^[a-f0-9]{12}$/);
  });

  it("is deterministic", () => {
    const a = hashProjectPath("/some/project");
    const b = hashProjectPath("/some/project");
    expect(a).toBe(b);
  });

  it("differs for different paths", () => {
    const a = hashProjectPath("/project/a");
    const b = hashProjectPath("/project/b");
    expect(a).not.toBe(b);
  });
});

describe("resolveProjectDir", () => {
  it("resolves relative paths to absolute", () => {
    const result = resolveProjectDir("./foo");
    expect(result).toBe(resolve("./foo"));
  });

  it("keeps absolute paths as-is", () => {
    const result = resolveProjectDir("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  it("expands tilde", () => {
    const result = resolveProjectDir("~/projects/foo");
    expect(result).toBe(`${homedir()}/projects/foo`);
  });
});

describe("containerName", () => {
  it("returns claude-container-<hash> format", () => {
    const result = containerName("/some/project");
    expect(result).toMatch(/^claude-container-[a-f0-9]{12}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/utils.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement utils**

Create `src/utils.ts`:

```typescript
import { createHash } from "crypto";
import { homedir } from "os";
import { resolve } from "path";

export function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return `${homedir()}/${filePath.slice(2)}`;
  }
  return filePath;
}

export function hashProjectPath(absolutePath: string): string {
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 12);
}

export function resolveProjectDir(dir: string): string {
  const expanded = expandTilde(dir);
  return resolve(expanded);
}

export function containerName(projectDir: string): string {
  const absolute = resolveProjectDir(projectDir);
  return `claude-container-${hashProjectPath(absolute)}`;
}

export function log(message: string): void {
  console.error(`[claude-container] ${message}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/utils.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils.ts tests/utils.test.ts
git commit -m "feat: add utility functions — hashing, tilde expansion, path resolution"
```

---

### Task 3: Configuration Loading

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing tests for config**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, mergeConfig, type Config, type MountConfig } from "../src/config.js";
import { homedir } from "os";

describe("mergeConfig", () => {
  it("returns defaults when no config file", () => {
    const config = mergeConfig(undefined, { mounts: [], envs: [] });
    expect(config.mounts).toEqual([]);
    expect(config.env).toEqual({});
    expect(config.image).toBe("claude-container:latest");
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/config.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement config**

Create `src/config.ts`:

```typescript
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
  const parsed = JSON.parse(raw);
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/config.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config loading and merging from .claude-container.json"
```

---

### Task 4: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
FROM node:lts-slim

ARG UID=1000
ARG GID=1000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git \
      build-essential \
      curl \
      ca-certificates \
      openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

RUN groupadd -g ${GID} claude || true && \
    useradd -m -u ${UID} -g ${GID} -s /bin/bash claude

USER claude
WORKDIR /workspace

ENTRYPOINT ["sleep", "infinity"]
```

- [ ] **Step 2: Verify Dockerfile syntax**

```bash
docker build --check -f Dockerfile . 2>/dev/null || docker build --dry-run -f Dockerfile . 2>/dev/null || echo "Dockerfile created — will validate during image build"
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile with Claude Code, dev tools, non-root user"
```

---

### Task 5: Image Build Module

**Files:**
- Create: `src/image.ts`
- Create: `tests/image.test.ts`

- [ ] **Step 1: Write failing tests for image module**

Create `tests/image.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { dockerfileHash } from "../src/image.js";

describe("dockerfileHash", () => {
  it("returns a hex string for given content", () => {
    const hash = dockerfileHash("FROM node:lts-slim\nRUN echo hello");
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    const content = "FROM node:lts-slim";
    expect(dockerfileHash(content)).toBe(dockerfileHash(content));
  });

  it("differs for different content", () => {
    const a = dockerfileHash("FROM node:20");
    const b = dockerfileHash("FROM node:22");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/image.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement image module**

Create `src/image.ts`:

```typescript
import Docker from "dockerode";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { log } from "./utils.js";

const docker = new Docker();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function dockerfileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function bundledDockerfilePath(): string {
  // In dist/, the Dockerfile is at the package root (one level up from dist/)
  return resolve(__dirname, "..", "Dockerfile");
}

export async function ensureImage(imageName: string, customDockerfile?: string): Promise<void> {
  const dockerfilePath = customDockerfile ?? bundledDockerfilePath();
  const dockerfileContent = readFileSync(dockerfilePath, "utf-8");
  const currentHash = dockerfileHash(dockerfileContent);

  const needsBuild = await shouldBuild(imageName, currentHash);
  if (!needsBuild) {
    return;
  }

  log("Building container image (this may take a minute on first run)...");

  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;

  const buildContext = dirname(dockerfilePath);

  const stream = await docker.buildImage(
    { context: buildContext, src: ["."] },
    {
      t: imageName,
      buildargs: { UID: String(uid), GID: String(gid) },
      labels: { "claude-container.dockerfile-hash": currentHash },
      dockerfile: "Dockerfile",
    },
  );

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    }, (event: { stream?: string }) => {
      if (event.stream) {
        const line = event.stream.trim();
        if (line) log(line);
      }
    });
  });

  log("Image built successfully.");
}

async function shouldBuild(imageName: string, currentHash: string): Promise<boolean> {
  try {
    const image = docker.getImage(imageName);
    const info = await image.inspect();
    const storedHash = info.Config?.Labels?.["claude-container.dockerfile-hash"];
    if (storedHash === currentHash) {
      return false;
    }
    log("Dockerfile has changed, rebuilding image...");
    return true;
  } catch {
    // Image doesn't exist
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/image.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/image.ts tests/image.test.ts
git commit -m "feat: add image build module with hash-based rebuild detection"
```

---

### Task 6: Container Lifecycle Module

**Files:**
- Create: `src/container.ts`
- Create: `tests/container.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/container.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildMountBinds, buildEnvVars } from "../src/container.js";
import { homedir } from "os";

describe("buildMountBinds", () => {
  it("includes required mounts for project and claude config", () => {
    const binds = buildMountBinds("/my/project", []);
    expect(binds).toContain("/my/project:/workspace:rw");
    expect(binds).toContain(`${homedir()}/.claude:/home/claude/.claude:rw`);
  });

  it("includes additional configured mounts with tilde expansion", () => {
    const extra = [{ host: "~/.gitconfig", container: "/home/claude/.gitconfig", mode: "ro" as const }];
    const binds = buildMountBinds("/my/project", extra);
    expect(binds).toContain(`${homedir()}/.gitconfig:/home/claude/.gitconfig:ro`);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/container.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement container lifecycle**

Create `src/container.ts`:

```typescript
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
    `${claudeDir}:/home/claude/.claude:rw`,
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

  // Forward CLAUDE_* from host
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("CLAUDE_") && value !== undefined) {
      envs.push(`${key}=${value}`);
    }
  }

  // Add custom env vars
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

  // Check required mount
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
    // Container doesn't exist, create it
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/container.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/container.ts tests/container.test.ts
git commit -m "feat: add container lifecycle — create, start, stop, reset, status, list"
```

---

### Task 7: Exec Module (TTY Attach)

**Files:**
- Create: `src/exec.ts`

- [ ] **Step 1: Implement exec module**

Create `src/exec.ts`:

```typescript
import { spawn } from "child_process";

export function execInContainer(
  containerName: string,
  args: string[],
): Promise<number> {
  return new Promise((resolve) => {
    const dockerArgs = [
      "exec",
      "-it",
      "-w", "/workspace",
      containerName,
      "claude",
      ...args,
    ];

    const child = spawn("docker", dockerArgs, {
      stdio: "inherit",
    });

    // SIGTERM: forward to child, let it exit gracefully
    const onSigterm = () => {
      child.kill("SIGTERM");
    };
    process.on("SIGTERM", onSigterm);

    child.on("close", (code) => {
      process.removeListener("SIGTERM", onSigterm);
      resolve(code ?? 1);
    });

    child.on("error", (err) => {
      process.removeListener("SIGTERM", onSigterm);
      console.error(`Failed to start docker exec: ${err.message}`);
      resolve(1);
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/exec.ts
git commit -m "feat: add exec module — TTY-attached docker exec with signal forwarding"
```

---

### Task 8: CLI Entry Point

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Implement CLI entry point**

Replace `src/index.ts`:

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveProjectDir, log } from "./utils.js";
import { loadConfig, mergeConfig, type MountConfig } from "./config.js";
import { ensureImage } from "./image.js";
import { ensureContainer, stopContainer, resetContainer, getContainerStatus, listContainers } from "./container.js";
import { execInContainer } from "./exec.js";
import Docker from "dockerode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

async function checkDocker(): Promise<void> {
  try {
    const docker = new Docker();
    await docker.ping();
  } catch {
    console.error("Docker is not running. Please start Docker and try again.");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("claude-container")
    .description("Run Claude Code in a Docker container")
    .version(pkg.version)
    .option("--dir <path>", "Project directory to mount", process.cwd())
    .option("--mount <spec...>", "Additional mount in host:container:mode format")
    .option("--env <vars...>", "Additional env vars in KEY=VALUE format")
    .option("--status", "Show container status for current project")
    .option("--stop", "Stop the container for current project")
    .option("--reset", "Destroy and recreate the container")
    .option("--list", "List all claude-container instances")
    .allowUnknownOption(true)
    .allowExcessArguments(true);

  program.parse(process.argv);
  const opts = program.opts();

  await checkDocker();

  const projectDir = resolveProjectDir(opts.dir);

  // Management commands
  if (opts.list) {
    console.log(await listContainers());
    return;
  }

  if (opts.status) {
    console.log(await getContainerStatus(projectDir));
    return;
  }

  if (opts.stop) {
    await stopContainer(projectDir);
    return;
  }

  if (opts.reset) {
    await resetContainer(projectDir);
    log("Container reset. It will be recreated on next run.");
    return;
  }

  // Parse CLI mounts
  const cliMounts: MountConfig[] = (opts.mount ?? []).map((spec: string) => {
    const parts = spec.split(":");
    if (parts.length < 2) {
      console.error(`Invalid mount format: ${spec}. Expected host:container[:mode]`);
      process.exit(1);
    }
    return {
      host: parts[0],
      container: parts[1],
      mode: (parts[2] as "ro" | "rw") ?? "rw",
    };
  });

  // Load and merge config
  const fileConfig = loadConfig(projectDir);
  const config = mergeConfig(fileConfig, { mounts: cliMounts, envs: opts.env ?? [] });

  // Ensure image exists
  await ensureImage(config.image, config.dockerfile);

  // Ensure container is running
  const name = await ensureContainer(projectDir, config.image, config.mounts, config.env);

  // Forward remaining args to claude
  // Collect args that aren't our flags
  const claudeArgs = process.argv.slice(2).filter((arg) => {
    if (arg === "--status" || arg === "--stop" || arg === "--reset" || arg === "--list") return false;
    if (arg === "--dir" || arg === "--mount" || arg === "--env") return false;
    // Skip values for our flags
    return true;
  });

  // Better approach: use everything after our known flags
  const knownFlags = new Set(["--dir", "--mount", "--env", "--status", "--stop", "--reset", "--list", "--version", "-V"]);
  const forwardArgs: string[] = [];
  const rawArgs = process.argv.slice(2);
  let skip = false;
  for (const arg of rawArgs) {
    if (skip) {
      skip = false;
      continue;
    }
    if (knownFlags.has(arg)) {
      if (arg === "--dir" || arg === "--mount" || arg === "--env") {
        skip = true; // skip the next arg (the value)
      }
      continue;
    }
    forwardArgs.push(arg);
  }

  const exitCode = await execInContainer(name, forwardArgs);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Build and verify compilation**

```bash
npm run build
```

Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with arg parsing and command dispatch"
```

---

### Task 9: Integration Test

**Files:**
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = resolve(__dirname, "..", "dist", "index.js");

describe("CLI integration", () => {
  it("shows version with --version", () => {
    const output = execSync(`node ${cli} --version`, { encoding: "utf-8" });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows help with --help", () => {
    const output = execSync(`node ${cli} --help`, { encoding: "utf-8" });
    expect(output).toContain("claude-container");
    expect(output).toContain("--dir");
    expect(output).toContain("--mount");
  });
});
```

- [ ] **Step 2: Build and run integration tests**

```bash
npm run build && npx vitest run tests/integration.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add CLI integration tests for version and help"
```

---

### Task 10: Final Wiring and npm Link

- [ ] **Step 1: Build the full project**

```bash
npm run build
```

Expected: clean compilation

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Link globally for local testing**

```bash
npm link
```

- [ ] **Step 4: Verify the command works**

```bash
claude-container --version
claude-container --help
claude-container --list
```

Expected: version prints, help shows all options, list shows no containers

- [ ] **Step 5: Test with a real project (manual)**

```bash
cd /tmp && mkdir test-project && cd test-project
claude-container --status
```

Expected: builds image on first run, shows container status

- [ ] **Step 6: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final wiring and polish"
```
