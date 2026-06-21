import { describe, expect, it } from "vitest";

import {
  toggleAdditionalGoal,
  validateAboutYouForm,
  validateAgeAndGoalsForm,
  validateGoalsForm,
} from "./age-and-goals-form.js";

describe("age and goals form", () => {
  it("requires age, primary goal, and CEFR level when applicable", () => {
    expect(
      validateAgeAndGoalsForm({
        ageRange: "",
        displayName: "",
        primaryGoal: "",
        cefrGoalLevel: "",
        additionalGoals: [],
      }),
    ).toEqual({ ok: false, error: "Escolha sua faixa etária." });

    expect(
      validateAgeAndGoalsForm({
        ageRange: "25_39",
        displayName: "",
        primaryGoal: "cefr_level",
        cefrGoalLevel: "",
        additionalGoals: [],
      }),
    ).toEqual({
      ok: false,
      error: "Escolha o nível CEFR que deseja alcançar.",
    });
  });

  it("validates the two onboarding screens independently", () => {
    expect(
      validateAboutYouForm({ ageRange: "", displayName: "Thiago" }),
    ).toEqual({ ok: false, error: "Escolha sua faixa etária." });
    expect(
      validateAboutYouForm({ ageRange: "25_39", displayName: "  Thiago  " }),
    ).toEqual({
      ok: true,
      selection: { ageRange: "25_39", displayName: "Thiago" },
    });

    expect(
      validateGoalsForm({
        aboutYou: { ageRange: "25_39", displayName: "Thiago" },
        primaryGoal: "",
        cefrGoalLevel: "",
        additionalGoals: [],
      }),
    ).toEqual({ ok: false, error: "Escolha seu objetivo principal." });
  });

  it("normalizes an optional display name into a valid selection", () => {
    expect(
      validateAgeAndGoalsForm({
        ageRange: "25_39",
        displayName: "  Thiago  ",
        primaryGoal: "work",
        cefrGoalLevel: "",
        additionalGoals: ["travel"],
      }),
    ).toEqual({
      ok: true,
      selection: {
        ageRange: "25_39",
        displayName: "Thiago",
        primaryGoal: "work",
        cefrGoalLevel: null,
        additionalGoals: ["travel"],
      },
    });
  });

  it("adds, removes, and caps additional goals at two", () => {
    expect(toggleAdditionalGoal([], "work")).toEqual(["work"]);
    expect(toggleAdditionalGoal(["work"], "work")).toEqual([]);
    expect(
      toggleAdditionalGoal(["work", "travel"], "everyday_conversation"),
    ).toEqual(["work", "travel"]);
  });
});
