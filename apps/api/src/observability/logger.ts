import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

export const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export type LogLevel = (typeof logLevels)[number];
export type AppLogger = Logger;

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "audio",
  "oauthState",
  "sessionToken",
  "transcript",
  "profile",
  "prompt",
  "response",
  "answers",
];

export function createAppLogger(
  level: LogLevel,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    base: undefined,
    level,
    redact: {
      paths: redactedPaths,
      remove: true,
    },
  };

  return destination ? pino(options, destination) : pino(options);
}

export function createSilentLogger(): Logger {
  return createAppLogger("silent");
}

export function parseLogLevel(value: string): LogLevel {
  if (logLevels.includes(value as LogLevel)) return value as LogLevel;
  throw new Error(`Invalid LOG_LEVEL: ${value}`);
}

export function errorMetadata(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: isSafeErrorCode(error.message)
        ? error.message
        : "unexpected_error",
    };
  }

  return { errorName: "NonError", errorMessage: "non_error_thrown" };
}

function isSafeErrorCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*(?::\d{3})?$/.test(value);
}
