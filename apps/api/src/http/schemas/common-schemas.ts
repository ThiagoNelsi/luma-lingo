import { z } from "zod/v4";

export const redirectResponseSchema = z
  .unknown()
  .describe("Redirect response with an empty body.");
