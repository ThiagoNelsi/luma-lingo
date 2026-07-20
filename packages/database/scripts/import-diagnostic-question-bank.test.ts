import { describe, expect, it } from "vitest";

import {
  defaultDiagnosticQuestionBankPath,
  parseDiagnosticQuestionBankImportArgs,
} from "./import-diagnostic-question-bank.js";

describe("diagnostic question-bank import command", () => {
  it("defaults to the private authorial A1 question bank", () => {
    expect(parseDiagnosticQuestionBankImportArgs([]).questionBankPath).toBe(
      defaultDiagnosticQuestionBankPath,
    );
    expect(defaultDiagnosticQuestionBankPath).toMatch(
      /data\/catalogs\/en\/authoral\/onboarding-diagnostic-question-bank-a1-mvp\.json$/,
    );
  });
});
