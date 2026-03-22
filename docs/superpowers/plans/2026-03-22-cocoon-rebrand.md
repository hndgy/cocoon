# Cocoon Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand `claude-container` to `cocoon` with colored output, spinner animations, a startup banner, and playful log messages matching Claude Code's visual style.

**Architecture:** Add a new `src/ui.ts` module for all terminal UI concerns (ANSI colors, spinner, banner, styled logging). Update all source files and tests to replace `claude-container` references with `cocoon`. Rename config file from `.claude-container.json` to `.cocoon.json`. Update package.json binary name.

**Tech Stack:** Node.js, TypeScript, ANSI escape codes (no external deps for colors/spinners — keep it lightweight like Claude Code does).

---

### Task 1: Create `src/ui.ts` — the terminal UI module

**Files:**
- Create: `src/ui.ts`
- Test: `tests/ui.test.ts`

This module provides all visual output: ANSI color helpers, the braille spinner, the startup banner, and the styled `log`/`warn`/`success` functions that replace the old plain `log()`.

- [ ] **Step 1: Write the failing tests for color helpers**

```typescript
// tests/ui.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dim, bold, yellow, red, green, gray, stripAnsi } from "../src/ui.js";

describe("color helpers", () => {
  it("wraps text in ANSI codes", () => {
    expect(bold("hello")).toContain("\x1b[1m");
    expect(bold("hello")).toContain("hello");
    expect(bold("hello")).toContain("\x1b[0m");
  });

  it("dim produces dim text", () => {
    expect(dim("test")).toContain("\x1b[2m");
  });

  it("yellow produces yellow text", () => {
    expect(yellow("test")).toContain("\x1b[33m");
  });

  it("red produces red text", () => {
    expect(red("test")).toContain("\x1b[31m");
  });

  it("green produces green text", () => {
    expect(green("test")).toContain("\x1b[32m");
  });

  it("gray produces gray text", () => {
    expect(gray("test")).toContain("\x1b[90m");
  });

  it("stripAnsi removes all escape codes", () => {
    expect(stripAnsi(bold(yellow("hello")))).toBe("hello");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement color helpers and stripAnsi in `src/ui.ts`**

```typescript
// src/ui.ts

const esc = (code: string) => `\x1b[${code}m`;
const wrap = (code: string, text: string) => `${esc(code)}${text}${esc("0")}`;

export const bold = (t: string) => wrap("1", t);
export const dim = (t: string) => wrap("2", t);
export const yellow = (t: string) => wrap("33", t);
export const red = (t: string) => wrap("31", t);
export const green = (t: string) => wrap("32", t);
export const gray = (t: string) => wrap("90", t);

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui.test.ts`
Expected: PASS

- [ ] **Step 5: Add banner test**

```typescript
// Append to tests/ui.test.ts
import { banner } from "../src/ui.js";

describe("banner", () => {
  it("includes cocoon name", () => {
    const output = banner("0.1.0");
    const plain = stripAnsi(output);
    expect(plain).toContain("cocoon");
  });

  it("includes version", () => {
    const output = banner("1.2.3");
    const plain = stripAnsi(output);
    expect(plain).toContain("1.2.3");
  });

  it("uses box-drawing characters", () => {
    const output = banner("0.1.0");
    const plain = stripAnsi(output);
    expect(plain).toContain("╭");
    expect(plain).toContain("╰");
  });
});
```

- [ ] **Step 6: Implement `banner()` in `src/ui.ts`**

```typescript
export function banner(version: string): string {
  const title = `${yellow("cocoon")} ${dim(`v${version}`)}`;
  const subtitle = dim("Claude's cozy isolated shell");
  const titlePlain = `cocoon v${version}`;
  const subtitlePlain = "Claude's cozy isolated shell";
  const width = Math.max(titlePlain.length, subtitlePlain.length) + 4;
  const top = `  ${dim("╭" + "─".repeat(width) + "╮")}`;
  const bot = `  ${dim("╰" + "─".repeat(width) + "╯")}`;
  const pad = (plain: string, styled: string) => {
    const right = width - plain.length - 2;
    return `  ${dim("│")}  ${styled}${" ".repeat(right)}${dim("│")}`;
  };
  return [top, pad(titlePlain, title), pad(subtitlePlain, subtitle), bot].join("\n");
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/ui.test.ts`
Expected: PASS

- [ ] **Step 8: Add spinner test**

```typescript
// Append to tests/ui.test.ts
import { createSpinner } from "../src/ui.js";

describe("createSpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an object with start, update, stop, success", () => {
    const spinner = createSpinner("test");
    expect(spinner).toHaveProperty("start");
    expect(spinner).toHaveProperty("stop");
    expect(spinner).toHaveProperty("success");
    expect(spinner).toHaveProperty("update");
    spinner.stop();
  });
});
```

- [ ] **Step 9: Implement `createSpinner()` in `src/ui.ts`**

```typescript
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  start(): void;
  stop(): void;
  update(message: string): void;
  success(message: string): void;
}

export function createSpinner(message: string): Spinner {
  let frameIndex = 0;
  let currentMessage = message;
  let interval: ReturnType<typeof setInterval> | null = null;

  const clearLine = () => {
    process.stderr.write("\r\x1b[K");
  };

  const render = () => {
    clearLine();
    const frame = yellow(SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]);
    process.stderr.write(`${frame} ${currentMessage}`);
    frameIndex++;
  };

  return {
    start() {
      render();
      interval = setInterval(render, 80);
    },
    stop() {
      if (interval) clearInterval(interval);
      clearLine();
    },
    update(msg: string) {
      currentMessage = msg;
    },
    success(msg: string) {
      if (interval) clearInterval(interval);
      clearLine();
      process.stderr.write(`${green("✔")} ${msg}\n`);
    },
  };
}
```

- [ ] **Step 10: Add styled log functions**

```typescript
// Append to src/ui.ts

export function log(message: string): void {
  process.stderr.write(`${gray("cocoon ·")} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${yellow("cocoon ⚠")} ${red(message)}\n`);
}

export function success(message: string): void {
  process.stderr.write(`${green("cocoon ✔")} ${message}\n`);
}
```

- [ ] **Step 11: Run all tests**

Run: `npx vitest run tests/ui.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/ui.ts tests/ui.test.ts
git commit -m "feat: add ui module with colors, spinner, banner, and styled logging"
```

---

### Task 2: Rename all `claude-container` references to `cocoon`

**Files:**
- Modify: `package.json`
- Modify: `src/utils.ts`
- Modify: `src/config.ts`
- Modify: `src/container.ts`
- Modify: `src/image.ts`
- Modify: `src/index.ts`
- Modify: `src/exec.ts`
- Modify: `src/pathSecurity.ts` (only if it references the old name — it doesn't, skip)
- Modify: `Dockerfile` (label prefix)
- Modify: `tests/utils.test.ts`
- Modify: `tests/config.test.ts`
- Modify: `tests/container.test.ts`
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Update `package.json`**

Change:
- `"name": "claude-container"` → `"name": "cocoon"`
- `"claude-container": "dist/index.js"` → `"cocoon": "dist/index.js"`
- `"description"` → `"Cocoon — Claude's cozy isolated shell"`

- [ ] **Step 2: Update `src/utils.ts`**

Change `containerName()` to return `cocoon-<hash>` instead of `claude-container-<hash>`.
Remove the old `log()` function (replaced by `ui.ts`). Keep `promptUser` but update its prompt prefix.

```typescript
export function containerName(projectDir: string): string {
  const absolute = resolveProjectDir(projectDir);
  return `cocoon-${hashProjectPath(absolute)}`;
}
```

Remove:
```typescript
export function log(message: string): void {
  console.error(`[claude-container] ${message}`);
}
```

Update `promptUser` prompt styling (will be handled in Task 3 when wiring up UI).

- [ ] **Step 3: Update `src/config.ts`**

Change:
- Default image: `"claude-container:latest"` → `"cocoon:latest"`
- Config file name: `".claude-container.json"` → `".cocoon.json"`

- [ ] **Step 4: Update `src/image.ts`**

Change Docker label prefix:
- `"claude-container.dockerfile-hash"` → `"cocoon.dockerfile-hash"`

Replace `log()` import from `./utils.js` with `log` from `./ui.js`.

- [ ] **Step 5: Update `src/container.ts`**

Replace `log` import from `./utils.js` with `log` from `./ui.js`.
The container name prefix change is handled by `utils.ts`.

Change filter in `listContainers`:
- `n.replace(/^\//, "").startsWith("claude-container-")` → `n.replace(/^\//, "").startsWith("cocoon-")`

Change output string:
- `"No claude-container instances found."` → `"No cocoon instances found."`
- `"Claude containers:\n"` → `"Cocoon instances:\n"`

- [ ] **Step 6: Update `src/exec.ts`**

Replace `log` import from `./utils.js` with `log`, `warn` from `./ui.js`.

- [ ] **Step 7: Update `src/index.ts`**

- `.name("claude-container")` → `.name("cocoon")`
- `.description(...)` → `.description("Claude's cozy isolated shell")`
- Replace `log` import from `./utils.js` with imports from `./ui.js`
- Update prompt string from `"[claude-container] Allow..."` → use styled prompt

- [ ] **Step 8: Update `Dockerfile`**

Change label reference comment if any. The label is set at build time in `image.ts`, so only update comments.

- [ ] **Step 9: Update `tests/utils.test.ts`**

Change containerName test expectation:
- `expect(result).toMatch(/^claude-container-[a-f0-9]{12}$/)` → `expect(result).toMatch(/^cocoon-[a-f0-9]{12}$/)`

- [ ] **Step 10: Update `tests/config.test.ts`**

Change default image expectation:
- `expect(config.image).toBe("claude-container:latest")` → `expect(config.image).toBe("cocoon:latest")`

- [ ] **Step 11: Update `tests/container.test.ts`**

No name-specific assertions — the container name comes from `utils.containerName()` which is already updated.

- [ ] **Step 12: Update `tests/integration.test.ts`**

Change:
- `expect(output).toContain("claude-container")` → `expect(output).toContain("cocoon")`

- [ ] **Step 13: Build and run tests**

Run: `npm run build && npx vitest run`
Expected: all tests PASS

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor: rename claude-container to cocoon across all files"
```

---

### Task 3: Wire up UI module — replace plain logs with styled output

**Files:**
- Modify: `src/index.ts`
- Modify: `src/container.ts`
- Modify: `src/image.ts`
- Modify: `src/exec.ts`
- Modify: `src/utils.ts`

This task replaces all `log()` calls with the new styled UI functions (spinners, colored log/warn/success, banner).

- [ ] **Step 1: Update `src/index.ts` — add banner and spinners**

At the top of `main()`, after parsing, print the banner:
```typescript
import { banner, log, warn, success, createSpinner, yellow, dim, green } from "./ui.js";

// After program.parse and checkDocker:
process.stderr.write(banner(pkg.version) + "\n\n");
```

Replace image build section with a spinner:
```typescript
const spinner = createSpinner("Preparing isolated environment...");
spinner.start();
await ensureImage(config.image, config.dockerfile);
spinner.success("Environment image ready.");
```

Replace container launch with a spinner:
```typescript
const containerSpinner = createSpinner("Spinning up cocoon...");
containerSpinner.start();
const name = await ensureContainer(projectDir, config.image, config.mounts, config.env);
containerSpinner.success("Cocoon ready. Claude is getting cozy.");
```

For the shell path:
```typescript
log("Opening shell inside cocoon...");
```

For the claude launch:
```typescript
log("Releasing Claude into the cocoon...");
```

For `--stop`:
```typescript
// use log("Unwrapping cocoon...")
```

For `--reset`:
```typescript
success("Cocoon unwrapped. A fresh one will be spun on next run.");
```

For `--clear`:
```typescript
success("Cocoon and image cleared. Everything will be rebuilt from scratch.");
```

- [ ] **Step 2: Update `src/container.ts` — use styled logging**

Replace `import { log } from "./utils.js"` with `import { log, success } from "./ui.js"`.

Messages:
- `"Resuming existing isolated environment..."` → `"Waking up cocoon..."`
- `"Environment resumed."` → `"Cocoon is awake."`
- `"Reusing active isolated environment."` → `"Cocoon already running."`
- `"Provisioning new isolated environment..."` → `"Spinning up a fresh cocoon..."`
- `"Isolated environment provisioned and running."` → `"Cocoon spun up and running."`
- `"Container ${name} stopped."` → `"Cocoon tucked away."`
- `"Container is not running."` → `"Cocoon is already asleep."`
- `"Container ${name} removed."` → `"Cocoon unwrapped."`
- `"No existing container to remove."` → `"No cocoon to unwrap."`

- [ ] **Step 3: Update `src/image.ts` — use styled logging**

Replace `import { log } from "./utils.js"` with `import { log, dim } from "./ui.js"`.

Messages:
- `"Building container image (this may take a minute on first run)..."` → `"Weaving cocoon image (first run takes a moment)..."`
- `"Image built successfully."` → (this will be handled by the spinner in index.ts)
- `"Dockerfile has changed, rebuilding image..."` → `"Cocoon blueprint changed, reweaving..."`
- Build progress lines: wrap in `dim()` so they're subtle

- [ ] **Step 4: Update `src/exec.ts` — use styled logging**

Replace `import { log } from "./utils.js"` with `import { log, warn } from "./ui.js"`.

Messages:
- `"Attaching shell to isolated environment..."` → (handled by caller in index.ts)
- `"WARNING: Claude is running with --dangerously-skip-permissions..."` → `warn("Claude has full autonomy inside the cocoon. All actions auto-approved.")`
- `"Starting Claude inside isolated environment..."` → (handled by caller in index.ts)

- [ ] **Step 5: Update `src/utils.ts` — remove old log, update promptUser**

Remove the `log` function entirely. Update `promptUser` to use styled prefix:

```typescript
import { yellow } from "./ui.js";

export function promptUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
```

The caller in `index.ts` will compose the styled prompt string.

- [ ] **Step 6: Build and run tests**

Run: `npm run build && npx vitest run`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire up cocoon UI with colors, spinners, banner, and playful messages"
```

---

### Task 4: Final polish and verification

**Files:**
- Modify: `src/index.ts` (mount warning styling)
- Verify: all tests pass
- Verify: build succeeds

- [ ] **Step 1: Style the mount warning prompt**

In `index.ts`, update the config-file mount warning to use the new UI:
```typescript
warn(`.cocoon.json requests ${fileConfig.mounts.length} host mount(s):`);
for (const m of fileConfig.mounts) {
  log(`  ${m.host} → ${m.container} (${m.mode})`);
}
const answer = await promptUser(`${yellow("cocoon ⚠")} Allow these mounts? [y/N] `);
```

- [ ] **Step 2: Full build + test run**

Run: `npm run build && npx vitest run`
Expected: all PASS

- [ ] **Step 3: Manual smoke test — verify `--help` output**

Run: `node dist/index.js --help`
Expected: shows `cocoon` name and description

- [ ] **Step 4: Manual smoke test — verify `--version` output**

Run: `node dist/index.js --version`
Expected: `0.1.0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish mount warning styling and finalize cocoon rebrand"
```
