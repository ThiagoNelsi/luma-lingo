import { describe, expect, it } from "vitest";

import {
  formatLanguageSelection,
  getLanguageSelectionError,
} from "./language-form.js";

describe("language onboarding form", () => {
  it("formats the approved onboarding phrase with language names", () => {
    expect(formatLanguageSelection("pt", "en")).toBe(
      "Eu falo Português e quero aprender Inglês",
    );
  });

  it("requires both languages and keeps them different", () => {
    expect(getLanguageSelectionError("", "")).toBe(
      "Escolha os dois idiomas para continuar.",
    );
    expect(getLanguageSelectionError("pt", "pt")).toBe(
      "Escolha idiomas diferentes.",
    );
    expect(getLanguageSelectionError("pt", "en")).toBeNull();
  });
});
