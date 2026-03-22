import { spawn } from "child_process";
import { warn } from "./ui.js";

export function shellInContainer(containerName: string): Promise<number> {
  return execCommand(containerName, ["bash"]);
}

export function execInContainer(
  containerName: string,
  args: string[],
): Promise<number> {
  const claudeArgs = ["claude", "--dangerously-skip-permissions", ...args];
  warn("Claude has full autonomy inside the cocoon. All actions auto-approved.");
  return execCommand(containerName, claudeArgs);
}

function execCommand(
  containerName: string,
  command: string[],
): Promise<number> {
  return new Promise((resolve) => {
    const dockerArgs = [
      "exec",
      "-it",
      "-w", "/workspace",
      containerName,
      ...command,
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
