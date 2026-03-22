import { createHash } from "crypto";
import { homedir } from "os";
import { resolve } from "path";
import { createInterface } from "readline";

export function expandTilde(filePath: string): string {
  if (filePath === "~") {
    return homedir();
  }
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
  return `cocoon-${hashProjectPath(absolute)}`;
}

export function promptUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
