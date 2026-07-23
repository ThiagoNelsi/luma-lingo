import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createAppLogger, errorMetadata, parseLogLevel } from "./logger.js";

function createLogCapture() {
  const entries: Array<Record<string, unknown>> = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      callback();
    },
  });

  return { entries, logger: createAppLogger("trace", destination) };
}

describe("logger", () => {
  it("redacts credentials and profile content from structured log entries", () => {
    const { entries, logger } = createLogCapture();

    logger.info(
      {
        audio: "audio-bytes",
        profile: { interests: ["cinema"] },
        req: { headers: { authorization: "Bearer secret", cookie: "session" } },
        sessionToken: "session-token",
        transcript: "sensitive transcript",
      },
      "Sensitive event",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 30, msg: "Sensitive event" });
    expect(entries[0]).not.toHaveProperty("audio");
    expect(entries[0]).not.toHaveProperty("profile");
    expect(entries[0]).not.toHaveProperty("sessionToken");
    expect(entries[0]).not.toHaveProperty("transcript");
    expect(entries[0]?.req).toEqual({ headers: {} });
  });

  it("accepts supported log levels and rejects invalid configuration", () => {
    expect(parseLogLevel("debug")).toBe("debug");
    expect(() => parseLogLevel("verbose")).toThrow("Invalid LOG_LEVEL");
  });

  it("produces safe metadata for Error and non-Error values", () => {
    expect(errorMetadata(new Error("database_unavailable"))).toEqual({
      errorName: "Error",
      errorMessage: "database_unavailable",
    });
    expect(errorMetadata(new Error("sensitive profile content"))).toEqual({
      errorName: "Error",
      errorMessage: "unexpected_error",
    });
    expect(errorMetadata("failure")).toEqual({
      errorName: "NonError",
      errorMessage: "non_error_thrown",
    });
  });
});
