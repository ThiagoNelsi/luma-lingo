import { describe, expect, it } from "vitest";

import {
  createProfileReviewValues,
  validateProfileReviewForm,
} from "./profile-review-form.js";

describe("profile review form", () => {
  it("starts with extracted details and lets the learner complete missing required fields", () => {
    const values = createProfileReviewValues({
      jobOrField: null,
      interests: ["cinema"],
      dailyRoutine: ["estuda à noite"],
      studyContext: null,
      other: [],
    });

    expect(values).toMatchObject({ jobOrField: "", interests: "cinema" });
    expect(validateProfileReviewForm(values).ok).toBe(false);

    const completed = validateProfileReviewForm({
      ...values,
      jobOrField: "Professora",
      other: "prefere exemplos visuais, gosta de viajar",
    });
    expect(completed).toMatchObject({
      ok: true,
      profile: {
        jobOrField: "Professora",
        interests: ["cinema"],
        other: ["prefere exemplos visuais", "gosta de viajar"],
      },
    });
  });

  it("requires job or field and at least one interest but leaves the other details optional", () => {
    expect(
      validateProfileReviewForm(createProfileReviewValues(null)),
    ).toMatchObject({
      ok: false,
      errors: {
        jobOrField: "Conte sua área de trabalho ou atuação.",
        interests: "Conte pelo menos um interesse.",
      },
    });
  });

  it("reports invalid optional details instead of blocking submission silently", () => {
    const result = validateProfileReviewForm({
      jobOrField: "Professora",
      interests: "cinema",
      dailyRoutine: "",
      studyContext: "x".repeat(301),
      other: "",
    });

    expect(result).toMatchObject({
      ok: false,
      errors: { studyContext: "Use até 300 caracteres." },
    });
  });
});
