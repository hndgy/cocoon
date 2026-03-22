```
          ~~~~~~~~~~
        ~  ▗▄~~~~▄▖  ~
      ~   ▐▛███▜▌   ~
     ~   ▝▜█████▛▘   ~
      ~    ▘▘ ▝▝    ~
        ~          ~
         ~~~~~~~~~~
```

# cocoon

**Claude's cozy isolated shell** — run [Claude Code](https://claude.ai/download) inside Docker containers so it can go full-auto without touching your host.

Cocoon wraps your project in a disposable Linux container with Claude Code pre-installed. Claude gets `--dangerously-skip-permissions` by default, meaning it can freely install packages, run scripts, and modify files — all safely contained. Your host stays clean; the container is the blast radius.

## Why

- **Let Claude loose.** No permission prompts. Claude can `npm install`, `rm -rf node_modules`, run arbitrary commands — inside the container.
- **Reproducible environments.** Same Dockerfile, same image, every time. No "works on my machine."
- **Zero-config start.** Point cocoon at a directory and go. It builds the image, creates a container, mounts your project, and launches Claude.
- **Persistent sessions.** Containers survive restarts. Credentials persist in a Docker volume. Pick up where you left off.
- **Safe experimentation.** `--reset` and you're back to a clean slate.

## Install

```bash
# Requires Node.js 18+ and Docker
npm install -g cocoon
```

Or add to your project:

```bash
npm install cocoon
```

Or clone and link locally:

```bash
git clone https://github.com/hndgy/cocoon.git
cd cocoon
npm install
npm run build
npm link
```

## Quick start

```bash
# Run Claude in a container against the current directory
cocoon

# Run Claude with a prompt
cocoon "refactor the auth module to use JWT"

# Open a shell inside the container
cocoon --shell

# Pass any Claude Code flags through
cocoon --model sonnet --verbose
```

## How it works

```
┌─ your machine ──────────────────────────────────┐
│                                                  │
│  cocoon CLI                                      │
│    │                                             │
│    ├─ builds Docker image (cached by content)    │
│    ├─ creates container with your project at     │
│    │  /workspace                                 │
│    ├─ forwards CLAUDE_* env vars                 │
│    └─ execs claude --dangerously-skip-permissions│
│                                                  │
│  ┌─ container ────────────────────────────────┐  │
│  │  /workspace  ← your project (read-write)   │  │
│  │  Claude Code (full permissions)            │  │
│  │  Node.js, git, build-essential, curl       │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## CLI reference

```
cocoon [options] [claude-args...]
```

| Option | Description |
|---|---|
| `--dir <path>` | Project directory to mount (default: cwd) |
| `--mount <spec...>` | Additional mounts as `host:container:mode` |
| `--env <vars...>` | Environment variables as `KEY=VALUE` |
| `--share-tmpdir` | Mount host `$TMPDIR` read-only (macOS drag-and-drop) |
| `--shell` | Open a bash shell inside the container |
| `--login` | Log in to Claude inside the container |
| `--status` | Show container status for current project |
| `--list` | List all cocoon instances |
| `--stop` | Stop the container for current project |
| `--reset` | Destroy and recreate the container |
| `--clear` | Remove image and container, full rebuild |
| `--debug` | Verbose Docker and startup logs |
| `-y, --yes` | Auto-accept config file mounts |

Any unrecognized flags and positional arguments are forwarded to Claude Code.

## Configuration

Drop a `.cocoon.json` in your project root for per-project settings:

```json
{
  "mounts": [
    {
      "host": "/path/to/data",
      "container": "/data",
      "mode": "ro"
    }
  ],
  "env": {
    "DATABASE_URL": "postgres://localhost:5432/dev"
  },
  "image": "cocoon:latest",
  "dockerfile": "./custom/Dockerfile",
  "shareTempDir": false
}
```

All fields are optional. CLI flags override config file values.

When a config file includes mounts, cocoon will prompt for confirmation before proceeding (bypass with `--yes`).

## Container lifecycle

Cocoon manages one container per project directory (named by hashing the path):

- **First run** — builds the image and creates a fresh container.
- **Subsequent runs** — reuses the existing container (starts it if stopped).
- **`--reset`** — destroys the container; a new one is created on next run.
- **`--clear`** — destroys both the container and image, forcing a full rebuild.
- **Credentials** are stored in a Docker volume (`<name>-config`) that survives container resets. Log in once, use forever.

## Security

Cocoon is a sandbox, not a fortress. The design philosophy: give Claude maximum autonomy *inside the container* while keeping your host safe.

**What cocoon does:**
- Mounts your project directory read-write (it needs to edit your code)
- Mounts host Claude credentials read-only (so you don't need to log in again)
- Blocks mounting sensitive host paths (`/`, `/etc`, `~/.ssh`, `~/.aws`, `~/.gnupg`, etc.)
- Prompts before honoring mounts from `.cocoon.json`

**What cocoon does not do (yet):**
- Drop Linux capabilities
- Enforce CPU/memory limits
- Restrict network access
- Run as a non-root user inside the container (it uses a `claude` user, but no user namespace remapping)

See [`docs/SECURITY-AUDIT-2026-03-22.md`](docs/SECURITY-AUDIT-2026-03-22.md) for a full audit.

If you're running untrusted code, add your own hardening on top.

## Development

```bash
npm install          # install dependencies
npm run build        # compile TypeScript
npm run dev          # watch mode
npm test             # run tests
npm run test:watch   # watch tests
```

### Project structure

```
src/
  index.ts          CLI entry point
  container.ts      Docker container lifecycle
  exec.ts           Command execution inside container
  config.ts         .cocoon.json parsing and merging
  image.ts          Docker image building
  pathSecurity.ts   Mount path validation
  ui.ts             Terminal colors, spinner, banner
  utils.ts          Helper functions
tests/              Vitest test suites
Dockerfile          Container image definition
entrypoint.sh       Container startup script
```

## Contributing

Contributions welcome! Please open an issue first for non-trivial changes so we can discuss the approach.

```bash
# Fork, clone, branch
git checkout -b my-feature

# Make changes, add tests
npm test

# Open a PR
```

## License

[MIT](LICENSE)
