#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveProjectDir, promptUser } from "./utils.js";
import { log, warn, success, banner, createSpinner, yellow } from "./ui.js";
import { loadConfig, mergeConfig, type MountConfig } from "./config.js";
import { validateProjectDir, validateMounts } from "./pathSecurity.js";
import { ensureImage, removeImage } from "./image.js";
import { ensureContainer, stopContainer, resetContainer, getContainerStatus, listContainers } from "./container.js";
import { execInContainer, shellInContainer } from "./exec.js";
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
    .name("cocoon")
    .description("Claude's cozy isolated shell")
    .version(pkg.version)
    .option("--dir <path>", "Project directory to mount", process.cwd())
    .option("--mount <spec...>", "Additional mount in host:container:mode format")
    .option("--env <vars...>", "Additional env vars in KEY=VALUE format")
    .option("--status", "Show container status for current project")
    .option("--stop", "Stop the container for current project")
    .option("--reset", "Destroy and recreate the container")
    .option("--list", "List all cocoon instances")
    .option("--clear", "Remove image and container, rebuild from scratch")
    .option("--shell", "Open a bash shell inside the container")
    .option("-y, --yes", "Auto-accept config file mounts without prompting")
    .allowUnknownOption(true)
    .allowExcessArguments(true);

  program.parse(process.argv);
  const opts = program.opts();

  await checkDocker();

  process.stderr.write(banner(pkg.version) + "\n\n");

  const projectDir = resolveProjectDir(opts.dir);
  validateProjectDir(projectDir);

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
    success("Cocoon unwrapped. A fresh one will be spun on next run.");
    return;
  }

  if (opts.clear) {
    const fileConfig = loadConfig(projectDir);
    const config = mergeConfig(fileConfig, { mounts: [], envs: [] });
    await resetContainer(projectDir);
    await removeImage(config.image);
    success("Cocoon and image cleared. Everything will be rebuilt from scratch.");
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

  // Validate CLI mounts early
  validateMounts(cliMounts, "cli");

  // Load and merge config
  const fileConfig = loadConfig(projectDir);

  // Warn user about config-file mounts (untrusted source)
  if (fileConfig?.mounts && fileConfig.mounts.length > 0) {
    validateMounts(fileConfig.mounts, "config file");
    if (opts.yes) {
      log("Auto-accepting config file mounts (--yes flag).");
    } else {
      warn(`.cocoon.json requests ${fileConfig.mounts.length} host mount(s):`);
      for (const m of fileConfig.mounts) {
        log(`  ${m.host} -> ${m.container} (${m.mode})`);
      }
      const answer = await promptUser(`${yellow("cocoon \u26A0")} Allow these mounts? [y/N] `);
      if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
        log("Aborted by user.");
        process.exit(1);
      }
    }
  }

  const config = mergeConfig(fileConfig, { mounts: cliMounts, envs: opts.env ?? [] });

  // Ensure image exists
  const spinner = createSpinner("Preparing isolated environment...");
  spinner.start();
  await ensureImage(config.image, config.dockerfile);
  spinner.success("Environment image ready.");

  // Ensure container is running
  const cocoonSpinner = createSpinner("Spinning up cocoon...");
  cocoonSpinner.start();
  const name = await ensureContainer(projectDir, config.image, config.mounts, config.env);
  cocoonSpinner.success("Cocoon ready. Claude is getting cozy.");

  if (opts.shell) {
    log("Opening shell inside cocoon...");
    const exitCode = await shellInContainer(name);
    process.exit(exitCode);
  }

  // Forward remaining args to claude.
  // program.args contains positional args not consumed by our options.
  // program.parseOptions separates known from unknown flags.
  // We need both positional args (prompts) and unknown flags (claude's flags).
  const parsed = program.parseOptions(process.argv.slice(2));
  // Operands include positional args AND values consumed by our flags (--dir value).
  // program.args has only the non-consumed positional args after parse().
  const forwardArgs = [...program.args, ...parsed.unknown];

  log("Releasing Claude into the cocoon...");
  const exitCode = await execInContainer(name, forwardArgs);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
