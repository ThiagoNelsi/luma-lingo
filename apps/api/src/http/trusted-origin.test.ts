import { describe, expect, it } from "vitest";

import type { AppConfig } from "../config.js";
import { isTrustedOrigin } from "./trusted-origin.js";

const config = {
  apiOrigin: "http://localhost:3000",
  frontendOrigin: "http://localhost:5173",
} as AppConfig;

describe("isTrustedOrigin", () => {
  it("accepts server requests and configured app origins", () => {
    expect(isTrustedOrigin(undefined, config)).toBe(true);
    expect(isTrustedOrigin(config.apiOrigin, config)).toBe(true);
    expect(isTrustedOrigin(config.frontendOrigin, config)).toBe(true);
  });

  it("rejects other origins", () => {
    expect(isTrustedOrigin("https://evil.example.com", config)).toBe(false);
  });
});
