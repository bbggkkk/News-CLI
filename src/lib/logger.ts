export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

type LoggerOptions = {
  json?: boolean;
  level?: LogLevel;
};

export class Logger {
  private readonly json: boolean;
  private readonly level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.json = options.json ?? false;
    this.level = options.level ?? "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  debug(message: string): void {
    if (!this.shouldLog("debug")) return;
    if (this.json) { console.error(JSON.stringify({ level: "debug", message })); }
    else { console.error(`[debug] ${message}`); }
  }

  info(message: string): void {
    if (!this.shouldLog("info")) return;
    if (this.json) { console.log(JSON.stringify({ level: "info", message })); }
    else { console.log(message); }
  }

  warn(message: string): void {
    if (!this.shouldLog("warn")) return;
    if (this.json) return;
    console.error(`Warning: ${message}`);
  }

  error(message: string): void {
    if (!this.shouldLog("error")) return;
    if (this.json) { console.error(JSON.stringify({ level: "error", message })); }
    else { console.error(`Error: ${message}`); }
  }
}
