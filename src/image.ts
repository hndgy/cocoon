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
  return resolve(__dirname, "..", "Dockerfile");
}

export async function ensureImage(imageName: string, customDockerfile?: string): Promise<void> {
  const dockerfilePath = customDockerfile ?? bundledDockerfilePath();
  let dockerfileContent: string;
  try {
    dockerfileContent = readFileSync(dockerfilePath, "utf-8");
  } catch {
    try {
      await docker.getImage(imageName).inspect();
      return;
    } catch {
      throw new Error(`Image '${imageName}' not found and no Dockerfile available to build it.`);
    }
  }
  const currentHash = dockerfileHash(dockerfileContent);

  const needsBuild = await shouldBuild(imageName, currentHash);
  if (!needsBuild) {
    return;
  }

  log("Building container image (this may take a minute on first run)...");

  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;

  const buildContext = dirname(dockerfilePath);
  const dockerfileName = dockerfilePath.split("/").pop()!;

  const srcFiles = [dockerfileName];
  try {
    readFileSync(resolve(buildContext, ".dockerignore"));
    srcFiles.push(".dockerignore");
  } catch { /* no .dockerignore, that's fine */ }

  const stream = await docker.buildImage(
    { context: buildContext, src: srcFiles },
    {
      t: imageName,
      buildargs: { UID: String(uid), GID: String(gid) },
      labels: { "claude-container.dockerfile-hash": currentHash },
      dockerfile: dockerfileName,
    },
  );

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    }, (event: { stream?: string; error?: string; errorDetail?: { message?: string } }) => {
      if (event.error) {
        reject(new Error(event.errorDetail?.message ?? event.error));
      }
      if (event.stream) {
        const line = event.stream.trim();
        if (line) log(line);
      }
    });
  });

  log("Image built successfully.");
}

export async function removeImage(imageName: string): Promise<void> {
  try {
    const image = docker.getImage(imageName);
    await image.remove({ force: true });
    log(`Image ${imageName} removed.`);
  } catch {
    log("No existing image to remove.");
  }
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
    return true;
  }
}
