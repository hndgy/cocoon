const esc = (code: string) => `\x1b[${code}m`;
const wrap = (code: string, text: string) => `${esc(code)}${text}${esc("0")}`;

export const bold = (t: string) => wrap("1", t);
export const dim = (t: string) => wrap("2", t);
export const yellow = (t: string) => wrap("33", t);
export const red = (t: string) => wrap("31", t);
export const green = (t: string) => wrap("32", t);
export const gray = (t: string) => wrap("90", t);

let debugMode = false;

export function setDebug(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebug(): boolean {
  return debugMode;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex -- matching the literal ESC byte is the point
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function banner(version: string): string {
  const art = [
    `          ${dim("~~~~~~~~~~")}`,
    `        ${dim("~")}  ${yellow("▗▄")}${dim("~~~~")}${yellow("▄▖")}  ${dim("~")}`,
    `      ${dim("~")}   ${yellow("▐▛███▜▌")}   ${dim("~")}`,
    `     ${dim("~")}   ${yellow("▝▜█████▛▘")}   ${dim("~")}`,
    `      ${dim("~")}    ${yellow("▘▘")} ${yellow("▝▝")}    ${dim("~")}`,
    `        ${dim("~")}          ${dim("~")}`,
    `         ${dim("~~~~~~~~~~")}`,
    ``,
    `     ${yellow("cocoon")} ${dim(`v${version}`)}`,
    `     ${dim("Claude's cozy isolated shell")}`,
  ];
  return art.join("\n");
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  start(): void;
  stop(): void;
  update(message: string): void;
  success(message: string): void;
}

const NO_OP_SPINNER: Spinner = { start() {}, stop() {}, update() {}, success() {} };

// Spinners animate when stderr is a real terminal so users get live feedback
// during slow image builds and container startup. In `--debug` we also enable
// them regardless of TTY so the verbose path stays observable (and testable).
function spinnerEnabled(): boolean {
  return debugMode || Boolean(process.stderr.isTTY);
}

export function createSpinner(message: string): Spinner {
  if (!spinnerEnabled()) {
    return NO_OP_SPINNER;
  }

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

export function log(message: string): void {
  process.stderr.write(`${gray("cocoon ·")} ${message}\n`);
}

export function debug(message: string): void {
  if (!debugMode) return;
  process.stderr.write(`${gray("cocoon ·")} ${dim(message)}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${yellow("cocoon ⚠")} ${red(message)}\n`);
}

export function success(message: string): void {
  process.stderr.write(`${green("cocoon ✔")} ${message}\n`);
}

/** Visible (ANSI-stripped) length of a string, for column alignment. */
export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/** Right-pad a (possibly colored) cell to `width` visible columns. */
export function padCell(str: string, width: number): string {
  const pad = width - visibleLength(str);
  return pad > 0 ? str + " ".repeat(pad) : str;
}

/** Truncate a single line to `width` visible columns, adding an ellipsis. */
export function clampLine(str: string, width: number): string {
  if (width <= 0) return "";
  const plain = stripAnsi(str);
  if (plain.length <= width) return plain;
  if (width <= 1) return plain.slice(0, width);
  return plain.slice(0, width - 1) + "…";
}

/**
 * Render rows as a left-aligned, column-padded table. Headers are dimmed.
 * Cells may contain ANSI color codes; alignment uses the visible width.
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const columnCount = Math.max(headers.length, ...rows.map((r) => r.length), 0);
  const widths = Array.from({ length: columnCount }, (_, col) =>
    Math.max(visibleLength(headers[col] ?? ""), ...rows.map((r) => visibleLength(r[col] ?? ""))),
  );
  const renderRow = (cells: string[], style: (s: string) => string = (s) => s) =>
    widths
      .map((_, col) => style(padCell(cells[col] ?? "", widths[col])))
      .join("  ")
      .trimEnd();

  // An empty headers array means a borderless table (used by `--status`).
  const lines = headers.length > 0 ? [renderRow(headers, dim)] : [];
  for (const row of rows) lines.push(renderRow(row));
  return lines.join("\n");
}

/** Human-friendly elapsed time, e.g. "5s", "3m", "2h", "4d". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** A colored status dot: green when running, gray when stopped, yellow otherwise. */
export function statusDot(state: string): string {
  if (state === "running") return green("●");
  if (state === "exited" || state === "created") return gray("●");
  return yellow("●");
}

export interface CocoonListItem {
  name: string;
  projectDir?: string;
  state: string;
  status: string;
}

/** Render the `--list` dashboard: one row per cocoon, newest concerns first. */
export function renderCocoonList(items: CocoonListItem[]): string {
  if (items.length === 0) {
    return dim("No cocoons yet — run `cocoon` inside a project to weave one.");
  }
  const rows = items.map((item) => [
    `${statusDot(item.state)} ${item.state}`,
    item.projectDir ?? gray(item.name),
    dim(item.status),
  ]);
  return formatTable(["", "project", "status"], rows);
}
