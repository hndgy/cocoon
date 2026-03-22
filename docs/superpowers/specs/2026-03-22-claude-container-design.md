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
| `claude-container --version` | Show claude-container and Claude Code versions |

### Flags

| Flag | Description |
|------|-------------|
| `--dir <path>` | Project directory to mount (default: `$PWD`) |
| `--mount <host>:<container>:<mode>` | Additional mount (repeatable) |
| `--env <KEY=VALUE>` | Additional environment variable (repeatable) |

## Container Management

### Naming

Container name: `claude-container-<sha256(absolute-project-path)[:12]>`

The project path is always resolved to an absolute path before hashing (including when provided via `--dir`). This ensures the same physical directory always maps to the same container regardless of how it's referenced.

### Image

Built locally from a `Dockerfile` bundled with the package:

- **Base:** `node:lts-slim`
- **Installs:** `@anthropic-ai/claude-code` globally via npm
- **Installs:** `git`, `build-essential`, and common dev tools
- **User:** Non-root `claude` user

**UID/GID matching:** The image is built with `--build-arg UID=$(id -u) --build-arg GID=$(id -g)` so the container user's UID/GID matches the host user. This ensures files written in `/workspace` have correct ownership on the host.

The image is built automatically on first run if it doesn't exist. Rebuild is triggered by `--reset` or when the Dockerfile changes (detected via content hash stored as an image label).

### Lifecycle

1. **First run:** Build image (if needed) → create container → start → attach
2. **Subsequent runs:** Start container (if stopped) → attach
3. **On detach:** Container stays running
4. **On `--stop`:** Container is stopped
5. **On `--reset`:** Container is destroyed and recreated from scratch

### TTY Handling

The CLI spawns `docker exec -it <container> claude [args...]` as a child process, inheriting the parent's stdio. This provides reliable TTY passthrough without reimplementing terminal handling via the Docker API.

- Stdin, stdout, stderr are inherited from the parent process
- Terminal size is forwarded automatically by Docker
- SIGINT (Ctrl-C) is forwarded to the `claude` process inside the container
- SIGTERM triggers graceful shutdown of the `claude` process, then stops the container
- Interactive mode works identically to running `claude` directly

### Signal Handling

| Signal | Behavior |
|--------|----------|
| SIGINT (Ctrl-C) | Forwarded to `claude` inside container (default `docker exec` behavior) |
| SIGTERM | Forward to `claude`, wait for exit, leave container running |
| SIGWINCH | Terminal resize propagated automatically by Docker |

### Container Exit Behavior

When the `claude` process exits (session ends normally), the container is **left running** in the background for fast re-entry. The CLI process exits with the same exit code as `claude`.

Idle containers consume minimal resources (stopped processes, no CPU). Users can reclaim resources with `claude-container --stop` or `claude-container --list` to see what's running.

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

## Environment Variables

### Authentication

Claude Code authenticates via subscription (OAuth login). The session is persisted in `~/.claude` which is mounted read-write into the container. No API keys are involved — the user logs in once on the host and the session carries over.

### Forwarding strategy

All environment variables matching `CLAUDE_*` are forwarded from the host into the container (model overrides, max turns, etc.).

Additional env vars can be configured in `.claude-container.json`:

```json
{
  "env": {
    "CUSTOM_VAR": "value"
  }
}
```

Or via CLI flag: `--env KEY=VALUE` (repeatable).

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
| `env` | Object | `{}` | Additional environment variables |
| `image` | String | `claude-container:latest` | Image name to use/build |
| `dockerfile` | String | bundled Dockerfile | Path to custom Dockerfile |

**`image` and `dockerfile` interaction:** `dockerfile` specifies what to build; `image` specifies the tag to apply. If only `image` is set to an existing image, no build occurs. If `dockerfile` is set, the image is built from it and tagged with `image`. They are complementary, not conflicting.

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
| `dockerode` | Docker Engine API client (image build, container create/start/stop/inspect) |
| `commander` | CLI argument parsing |

TTY attachment uses `docker exec -it` via `child_process.spawn` (inheriting stdio) rather than the `dockerode` attach API, which avoids TTY passthrough complexity.

Dev dependencies: `typescript`, `@types/node`, `@types/dockerode`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Docker not running | Exit with clear message: "Docker is not running. Please start Docker and try again." |
| Image not built | Auto-build on first run |
| Container in bad state | Suggest `--reset` |
| Required mount doesn't exist (`~/.claude`) | Exit with error: "`~/.claude` not found. Run `claude` on the host first to set up authentication." |
| Optional mount doesn't exist | Warning, skip the mount |
| Config file invalid | Exit with validation error pointing to the problematic field |

## Security Considerations

- Container runs as non-root user
- Host filesystem access is limited to explicitly mounted directories
- `~/.claude` is mounted read-write (required for auth persistence)
- No `--privileged` flag
- No host network mode — container uses default bridge network (outbound HTTPS access to Anthropic API is allowed via default bridge NAT)
- No capability escalation
