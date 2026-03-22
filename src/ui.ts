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

export function createSpinner(message: string): Spinner {
  if (!debugMode) {
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
