import { languageOptions, type LanguageCode } from "@luma-lingo/shared";

export function formatLanguageSelection(
  instructionLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): string {
  const instructionLabel = languageOptions.find(
    ({ code }) => code === instructionLanguage,
  )?.label;
  const targetLabel = languageOptions.find(
    ({ code }) => code === targetLanguage,
  )?.label;

  return `Eu falo ${instructionLabel} e quero aprender ${targetLabel}`;
}

export function getLanguageSelectionError(
  instructionLanguage: LanguageCode | "",
  targetLanguage: LanguageCode | "",
): string | null {
  if (!instructionLanguage || !targetLanguage) {
    return "Escolha os dois idiomas para continuar.";
  }
  if (instructionLanguage === targetLanguage) {
    return "Escolha idiomas diferentes.";
  }
  return null;
}
