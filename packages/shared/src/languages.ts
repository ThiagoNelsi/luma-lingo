import { z } from "zod/v4";

export const languageOptions = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "Inglês", flag: "🇺🇸" },
  { code: "es", label: "Espanhol", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "fr", label: "Francês", flag: "🇫🇷" },
  { code: "de", label: "Alemão", flag: "🇩🇪" },
  { code: "zh", label: "Chinês", flag: "🇨🇳" },
] as const;

export const languageCodes = languageOptions.map((language) => language.code);
export const languageCodeSchema = z.enum(languageCodes);

export const languageSelectionSchema = z
  .object({
    instructionLanguage: languageCodeSchema,
    targetLanguage: languageCodeSchema,
  })
  .refine(
    ({ instructionLanguage, targetLanguage }) =>
      instructionLanguage !== targetLanguage,
    {
      message: "instruction_and_target_languages_must_differ",
      path: ["targetLanguage"],
    },
  );

export type LanguageCode = z.infer<typeof languageCodeSchema>;
export type LanguageSelection = z.infer<typeof languageSelectionSchema>;
