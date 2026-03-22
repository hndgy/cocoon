# claude-container Design Spec

## Purpose

A Node.js CLI that transparently runs Claude Code inside a Docker container, providing sandboxing and security isolation. The user types `claude-container` instead of `claude` — all arguments are forwarded, and the experience is identical to running Claude directly.

## Goals

- **Sandboxing:** Claude's file edits and shell commands are isolated inside a container, protecting the host system.
- **Security:** Claude cannot access host files outside the mounted project directory and explicitly shared directories.
- **Transparency:** The CLI behaves as a drop-in wrapper — users pass the same arguments they would to `claude`.
- **Persistence:** One container per project, kept alive between sessions for fast re-entry.

## Non-Goals

- Port forwarding (user runs/tests code on the host)
- Multi-runtime support (Docker only, no Podman)
- Pre-built images (local build only)
- Dev Container spec compatibility

## CLI Interface

### Primary usage

```
claude-container [claude args...]
```

All arguments are forwarded to `claude` inside the container. Examples:

```bash
claude-container "fix the bug in auth.ts"
claude-container --model sonnet
claude-container   # interactive mode
```

### Management commands

| Command | Description |
|---------|-------------|
| `claude-container --status` | Show container state for current project |
| `claude-container --reset` | Destroy and recreate the container |
| `claude-container --stop` | Stop the container |
| `claude-container --list` | List all claude-container instances |

### Flags

| Flag | Description |
|------|-------------|
| `--dir <path>` | Project directory to mount (default: `$PWD`) |
| `--mount <host>:<container>:<mode>` | Additional mount (repeatable) |

## Container Management

### Naming

Container name: `claude-container-<sha256(absolute-project-path)[:12]>`

Deterministic — the same project directory always maps to the same container.

### Image

Built locally from a `Dockerfile` bundled with the package:

- **Base:** `node:lts-slim`
- **Installs:** `@anthropic-ai/claude-code` globally via npm
- **Installs:** `git`, `build-essential`, and common dev tools
- **User:** Non-root `claude` user (UID/GID matched to host user for file permission consistency)

The image is built automatically on first run if it doesn't exist. Rebuild is triggered by `--reset` or when the Dockerfile changes (detected via content hash stored as an image label).

### Lifecycle

1. **First run:** Build image (if needed) → create container → start → attach
2. **Subsequent runs:** Start container (if stopped) → attach
3. **On detach:** Container stays running
4. **On `--stop`:** Container is stopped
5. **On `--reset`:** Container is destroyed and recreated from scratch

### TTY Handling

The CLI attaches to the container with full TTY support:
- Stdin, stdout, stderr are connected
- Terminal size is forwarded and tracked (SIGWINCH)
- Interactive mode works identically to running `claude` directly

## Mounts

### Always mounted (non-removable)

| Host | Container | Mode |
|------|-----------|------|
| Project dir (`$PWD` or `--dir`) | `/workspace` | read-write |
| `~/.claude` | `/home/claude/.claude` | read-write |

### Configurable mounts

Additional mounts are configured via `.claude-container.json` in the project root:

```json
{
  "mounts": [
    { "host": "~/.gitconfig", "container": "/home/claude/.gitconfig", "mode": "ro" },
    { "host": "~/.ssh", "container": "/home/claude/.ssh", "mode": "ro" }
  ]
}
```

Or via the `--mount` CLI flag for one-off use:

```bash
claude-container --mount ~/.ssh:/home/claude/.ssh:ro "help me set up git"
```

`~` in host paths is expanded to the user's home directory. Relative paths are resolved from the project directory.

## Configuration

### `.claude-container.json`

Located in the project root. All fields are optional:

```json
{
  "mounts": [
    { "host": "~/.gitconfig", "container": "/home/claude/.gitconfig", "mode": "ro" }
  ],
  "image": "claude-container:latest",
  "dockerfile": "./custom.Dockerfile"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mounts` | Array | `[]` | Additional bind mounts |
| `image` | String | `claude-container:latest` | Image name to use/build |
| `dockerfile` | String | bundled Dockerfile | Path to custom Dockerfile |

## Project Structure

```
claude-container/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts          # CLI entry point, arg parsing
│   ├── container.ts      # Docker container lifecycle
│   ├── image.ts          # Image build management
│   ├── config.ts         # Load .claude-container.json, merge defaults
│   └── utils.ts          # Hashing, path resolution, logging
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `dockerode` | Docker Engine API client |
| `commander` | CLI argument parsing |

Dev dependencies: `typescript`, `@types/node`, `@types/dockerode`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Docker not running | Exit with clear message: "Docker is not running. Please start Docker and try again." |
| Image not built | Auto-build on first run |
| Container in bad state | Suggest `--reset` |
| Mount path doesn't exist | Warning, skip the mount |
| Config file invalid | Exit with validation error pointing to the problematic field |

## Security Considerations

- Container runs as non-root user
- Host filesystem access is limited to explicitly mounted directories
- `~/.claude` is mounted read-write (required for auth persistence)
- No `--privileged` flag
- No host network mode — container uses default bridge network
- No capability escalation
