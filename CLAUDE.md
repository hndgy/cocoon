# CLAUDE.md

Guidance for Claude Code (and humans) working **on** cocoon itself.

## What this is

Cocoon is a small TypeScript CLI that runs [Claude Code](https://claude.ai/download)
inside a disposable Docker container, so Claude can run with
`--dangerously-skip-permissions` without touching the host. The CLI builds an
image, manages one container per project directory, mounts the project at
`/workspace`, and execs `claude` inside it.

## Commands

```bash
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite
npm run lint       # ESLint (flat config, eslint.config.js)
npm run format     # Prettier --write
npm run typecheck  # tsc --noEmit over src + tests (tsconfig.eslint.json)
npm run check      # everything CI runs: lint + format check + typecheck + test
```

Run `npm run check` before committing — it mirrors `.github/workflows/ci.yml`.

## Architecture

The CLI entry point is `src/index.ts`; it parses flags with commander, resolves
config, then delegates to focused modules:

| Module                | Responsibility                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| `src/index.ts`        | CLI parsing, flag dispatch, arg forwarding to `claude`                 |
| `src/config.ts`       | `.cocoon.json` parsing/validation + merge with CLI flags               |
| `src/image.ts`        | Build/rebuild the Docker image; cache by Dockerfile hash label         |
| `src/container.ts`    | Container lifecycle (create/start/stop/reset), mount + env assembly    |
| `src/exec.ts`         | `docker exec` into the container (claude / shell / login / seed creds) |
| `src/credentials.ts`  | Resolve host Claude login (creds file or macOS Keychain)               |
| `src/pathSecurity.ts` | Block mounting sensitive host paths                                    |
| `src/ui.ts`           | Colors, spinner, banner, logging (all to **stderr**)                   |
| `src/utils.ts`        | Path/tilde/hash helpers, prompts                                       |

`Dockerfile` + `entrypoint.sh` define the container; they're copied into the
build context by `image.ts`.

## Conventions

- **ESM + Node16 module resolution.** Always import local files with the `.js`
  extension (e.g. `import { log } from "./ui.js"`), even though the source is
  `.ts`. TypeScript requires this under `moduleResolution: Node16`.
- **stdout vs stderr.** Human-facing UI (banner, logs, spinners) goes to
  **stderr** so stdout stays clean for `--print`/piped output flowing back from
  Claude. Use the helpers in `ui.ts`; don't `console.log` UI.
- **Security is layered.** Mount validation runs both at the CLI boundary
  (`index.ts`) and again in `container.ts` (`buildMountBinds`) as
  defense-in-depth. Keep it that way — don't remove the "redundant" check.
- **Path checks are home-aware.** `getBlockedReason` takes an injectable `home`
  so behavior is deterministic and a user's own home subtree stays usable even
  when `HOME` is under a blocked prefix (e.g. running as root). Pass an explicit
  home in tests rather than relying on the ambient `homedir()`.

## Testing

Vitest, in `tests/`. The suite is pure unit tests — it does **not** require
Docker to run. When touching path-security or config logic, add cases there;
prefer deterministic inputs (explicit `home`, fixed paths) over environment
state.
