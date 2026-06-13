import { spawn } from "child_process";
import { debug, warn } from "./ui.js";

export function shellInContainer(containerName: string): Promise<number> {
  return execCommand(containerName, ["bash"]);
}

export function loginInContainer(containerName: string): Promise<number> {
  return execCommand(containerName, ["claude", "login"]);
}

/**
 * Writes host credentials into the container's config directory, but only if it
 * isn't already authenticated — so a token refreshed or a `cocoon --login` done
 * inside the container is never clobbered. The JSON is piped via stdin (not argv)
 * to keep the secret out of the process list. Best-effort: failures are logged at
 * debug level and don't abort the run (Claude will just prompt to log in).
 */
export function seedCredentialsInContainer(
  containerName: string,
  credentialsJson: string,
): Promise<void> {
  return new Promise((resolvePromise) => {
    // Always consume stdin (avoids EPIPE), then install only if no creds exist.
    const script = [
      "set -e",
      'CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/home/claude/.claude-config}"',
      "tmp=$(mktemp)",
      'cat > "$tmp"',
      'if [ ! -s "$CONFIG_DIR/.credentials.json" ]; then',
      '  install -m 600 "$tmp" "$CONFIG_DIR/.credentials.json"',
      "fi",
      'rm -f "$tmp"',
    ].join("\n");

    const child = spawn("docker", ["exec", "-i", containerName, "sh", "-c", script], {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdin?.on("error", () => {
      /* ignore EPIPE if the container closed stdin early */
    });

    child.on("error", (err) => {
      debug(`Could not seed credentials: ${err.message}`);
      resolvePromise();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        debug(`Credential seeding exited with code ${code}: ${stderr.trim()}`);
      }
      resolvePromise();
    });

    child.stdin?.write(credentialsJson);
    child.stdin?.end();
  });
}

export function execInContainer(containerName: string, args: string[]): Promise<number> {
  const claudeArgs = ["claude", "--dangerously-skip-permissions", ...args];
  warn("Claude has full autonomy inside the cocoon. All actions auto-approved.");
  return execCommand(containerName, claudeArgs);
}

function execCommand(containerName: string, command: string[]): Promise<number> {
  return new Promise((resolve) => {
    const isPrint = command.includes("--print") || command.includes("-p");
    const dockerArgs = ["exec"];
    if (isPrint) {
      // --print: non-interactive, no TTY needed — skip -i/-t so Claude
      // doesn't hang waiting on stdin and output flows back to the caller
    } else if (process.stdin.isTTY) {
      dockerArgs.push("-it");
    } else {
      dockerArgs.push("-i");
    }
    dockerArgs.push("-w", "/workspace", containerName, ...command);

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
