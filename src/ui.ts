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

export function log(message: string): void {
  process.stderr.write(`${gray("cocoon ·")} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${yellow("cocoon ⚠")} ${red(message)}\n`);
}

export function success(message: string): void {
  process.stderr.write(`${green("cocoon ✔")} ${message}\n`);
}
