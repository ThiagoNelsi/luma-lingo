import { z } from "zod";

import type { LessonBlock, LessonPlan } from "./lesson-content.js";

export const lessonValidationContextSchema = z
  .object({
    instructionLanguage: z.string().trim().min(1),
    targetLanguage: z.string().trim().min(1),
    primaryGoal: z.enum(["everyday_conversation", "work", "travel"]),
    lessonEmphases: z.array(z.enum(["listening", "reading", "writing"])).min(1),
    priorityCompetencyKey: z.string().trim().min(1),
    learnerAgeRange: z.string().trim().min(1).nullable().optional(),
    profileTopics: z.array(z.string().trim().min(1)).optional(),
    competencyProfile: z
      .array(
        z
          .object({
            competencyKey: z.string().trim().min(1),
            abilityEstimate: z.number().min(0).max(1).nullable(),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type LessonValidationContext = z.infer<
  typeof lessonValidationContextSchema
>;

export type LessonSemanticRejectionReason =
  | "curricular_alignment"
  | "emphasis_alignment"
  | "goal_alignment"
  | "language_alignment"
  | "practice_volume"
  | "profile_alignment"
  | "unsafe_content"
  | "unsupported_content";

export class LessonSemanticValidationError extends Error {
  readonly code = "lesson_semantic_rejected";

  constructor(readonly reason: LessonSemanticRejectionReason) {
    super("lesson_semantic_rejected");
    this.name = "LessonSemanticValidationError";
  }
}

export function validateLessonPlanSemantics(
  plan: LessonPlan,
  context: LessonValidationContext,
): void {
  rejectUnsafeOrUnsupported(plan, context.learnerAgeRange);
  const alignment = plan.alignment;
  if (
    !alignment ||
    alignment.priorityCompetencyKey !== context.priorityCompetencyKey
  ) {
    reject("curricular_alignment");
  }
  const priorityState = context.competencyProfile?.find(
    (state) => state.competencyKey === context.priorityCompetencyKey,
  );
  if (
    alignment.priorityCompetencyState === undefined ||
    (priorityState
      ? alignment.priorityCompetencyState?.abilityEstimate !==
          priorityState.abilityEstimate ||
        alignment.priorityCompetencyState.confidence !==
          priorityState.confidence
      : alignment.priorityCompetencyState !== null)
  ) {
    reject("curricular_alignment");
  }
  if (alignment.primaryGoal !== context.primaryGoal) {
    reject("goal_alignment");
  }
  const visibleContent = visiblePlanText(plan);
  if (
    !hasConceptOverlap(
      visibleContent,
      conceptTerms(context.primaryGoal, goalVocabulary),
    )
  ) {
    reject("goal_alignment");
  }
  if (
    alignment.instructionLanguage !== context.instructionLanguage ||
    alignment.targetLanguage !== context.targetLanguage
  ) {
    reject("language_alignment");
  }
  const selectedEmphases = new Set(context.lessonEmphases);
  if (
    !sameValues(alignment.lessonEmphases, context.lessonEmphases) ||
    plan.blocks.some(
      (block) => !block.emphasis || !selectedEmphases.has(block.emphasis),
    ) ||
    context.lessonEmphases.some(
      (emphasis) => !plan.blocks.some((block) => block.emphasis === emphasis),
    )
  ) {
    reject("emphasis_alignment");
  }
  const confirmedTopics = new Set(context.profileTopics ?? []);
  if (
    alignment.profileTopics.some((topic) => !confirmedTopics.has(topic)) ||
    new Set(alignment.profileTopics).size !== alignment.profileTopics.length ||
    alignment.profileTopics.some(
      (topic) => !hasConceptOverlap(visibleContent, conceptTerms(topic)),
    )
  ) {
    reject("profile_alignment");
  }
  if (
    !hasConceptOverlap(
      visibleContent,
      conceptTerms(context.priorityCompetencyKey),
    )
  ) {
    reject("curricular_alignment");
  }
  const objectives = plan.blocks.map((block) => normalize(block.objective));
  if (
    new Set(objectives).size !== objectives.length ||
    objectives.some((objective) => objective.length === 0)
  ) {
    reject("curricular_alignment");
  }
}

export function validateLessonBlockSemantics(
  plan: LessonPlan,
  block: LessonBlock,
  expectedObjective: string,
  context: LessonValidationContext,
): void {
  rejectUnsafeOrUnsupported(block, context.learnerAgeRange);
  const planned = plan.blocks.find(
    (candidate) => candidate.objective === expectedObjective,
  );
  if (
    !planned ||
    block.objective !== expectedObjective ||
    block.title !== planned.title
  ) {
    reject("curricular_alignment");
  }
  if (
    block.examples.some(
      (example) => normalize(example.target) === normalize(example.instruction),
    ) ||
    !matchesExpectedLanguage(
      block.examples.map((example) => example.target).join(" "),
      context.targetLanguage,
    ) ||
    !matchesExpectedLanguage(
      block.examples.map((example) => example.instruction).join(" "),
      context.instructionLanguage,
    )
  ) {
    reject("language_alignment");
  }
  const teachingContent = JSON.stringify({
    explanation: block.explanation,
    examples: block.examples,
    activities: block.activities,
  });
  if (
    !hasConceptOverlap(
      teachingContent,
      conceptTerms(`${planned.title} ${planned.objective}`),
    )
  ) {
    reject("curricular_alignment");
  }
  const activityTypes = new Set(
    block.activities.map((activity) => activity.type),
  );
  if (
    ((planned.emphasis === "reading" || planned.emphasis === "listening") &&
      !activityTypes.has("multiple_choice")) ||
    (planned.emphasis === "writing" &&
      !activityTypes.has("fill_blank") &&
      !activityTypes.has("word_order"))
  ) {
    reject("emphasis_alignment");
  }
  const prompts = block.activities.map((activity) =>
    normalize(activity.prompt),
  );
  if (new Set(prompts).size !== prompts.length) {
    reject("curricular_alignment");
  }
  if (block.activities.length > block.examples.length * 3) {
    reject("practice_volume");
  }
}

function rejectUnsafeOrUnsupported(
  value: LessonPlan | LessonBlock,
  learnerAgeRange: string | null | undefined,
): void {
  const content = lessonContentText(value).toLocaleLowerCase("en");
  const searchable = normalizeSearch(content);
  const unsafePatterns = [
    /\b(?:sexual|porn(?:ography|ographic)?|explicit sex|sexual abuse)\b/,
    /\b(?:sexo explicito|pornografia|abuso sexual)\b/,
    /\b(?:pornographie|abus sexuel)\b/,
    /\b(?:pornografie|sexueller missbrauch)\b/,
    /\b(?:violent|violence|murder|kill|knife attack|gun|shoot|torture|assault)\b/,
    /\b(?:violencia|assassinato|asesinato|matar|arma|tortura|agressao)\b/,
    /\b(?:meurtre|tuer|arme|torture|agression)\b/,
    /\b(?:gewalt|mord|toten|waffe|folter|angriff)\b/,
    /\b(?:racist|racism|discriminat(?:e|ion|ory)|hate speech|racial slur)\b/,
    /\b(?:racista|racismo|discriminacao|discriminacion|discurso de odio)\b/,
    /\b(?:raciste|racisme|discriminatoire|discours de haine)\b/,
    /\b(?:rassistisch|rassismus|diskriminierung|hassrede)\b/,
    /\b(?:suicide|self harm|self-harm)\b/,
    /\b(?:suicidio|automutilacao|autolesion)\b/,
    /\b(?:Selbstmord|Selbstverletzung)\b/i,
    /(?:暴力|谋杀|殺人|杀死|槍|枪|色情|自杀|自殺|歧视|歧視|种族主义|種族主義)/,
  ];
  if (
    unsafePatterns.some((pattern) => pattern.test(searchable)) ||
    (learnerAgeRange === "under_13" &&
      /\b(?:alcohol|gambling|drug use|alcool|jogo de azar|drogas|apuestas|drogues)\b/.test(
        searchable,
      ))
  ) {
    reject("unsafe_content");
  }
  if (
    /https?:\/\//.test(content) ||
    /<\/?[a-z][^>]*>/.test(content) ||
    /\b(?:record your voice|speak aloud|video|audio file)\b/.test(content) ||
    /\bcefr\s+[abc][12]\b/.test(content)
  ) {
    reject("unsupported_content");
  }
}

function lessonContentText(value: LessonPlan | LessonBlock): string {
  if ("explanation" in value) {
    return JSON.stringify(value);
  }
  return JSON.stringify({
    title: value.title,
    objective: value.objective,
    blocks: value.blocks.map(({ title, objective }) => ({ title, objective })),
  });
}

const goalVocabulary: Record<string, readonly string[]> = {
  travel: ["travel", "travelling", "trip", "airport", "hotel", "journey"],
  work: ["work", "job", "office", "professional", "meeting", "colleague"],
  everyday_conversation: ["everyday", "daily", "conversation", "routine"],
};

const ignoredConceptWords = new Set([
  "and",
  "another",
  "com",
  "das",
  "de",
  "der",
  "do",
  "for",
  "from",
  "para",
  "person",
  "share",
  "short",
  "someone",
  "the",
  "their",
  "this",
  "uma",
  "und",
  "your",
  "yourself",
]);

const languageMarkers: Record<string, readonly string[]> = {
  de: ["hallo", "mein", "name", "danke", "bitte", "wahlen"],
  en: ["hello", "hi", "my", "name", "thank", "please", "choose", "the"],
  es: ["hola", "mi", "nombre", "gracias", "elige", "por favor"],
  fr: ["bonjour", "salut", "mon", "nom", "merci", "choisissez"],
  it: ["ciao", "mio", "nome", "grazie", "scegli"],
  pt: ["ola", "oi", "meu", "nome", "obrigado", "escolha", "por favor"],
  zh: ["你", "好", "我", "名字", "谢谢", "請", "请"],
};

const languageAliases: Record<string, keyof typeof languageMarkers> = {
  chinese: "zh",
  deutsch: "de",
  english: "en",
  espanol: "es",
  french: "fr",
  german: "de",
  ingles: "en",
  italian: "it",
  italiano: "it",
  mandarin: "zh",
  portugues: "pt",
  portuguese: "pt",
  spanish: "es",
};

function visiblePlanText(plan: LessonPlan): string {
  return JSON.stringify({
    title: plan.title,
    objective: plan.objective,
    blocks: plan.blocks,
  });
}

function matchesExpectedLanguage(content: string, language: string): boolean {
  const normalizedLanguage = normalizeSearch(language).replace(/[_-].*$/, "");
  const languageKey =
    languageAliases[normalizedLanguage] ??
    (normalizedLanguage in languageMarkers
      ? (normalizedLanguage as keyof typeof languageMarkers)
      : undefined);
  if (!languageKey) return true;
  const searchable = normalizeSearch(content);
  const contentTokens = new Set(tokenize(searchable));
  if (containsLanguageMarker(searchable, contentTokens, languageKey)) {
    return true;
  }
  return !Object.keys(languageMarkers).some(
    (candidate) =>
      candidate !== languageKey &&
      containsLanguageMarker(
        searchable,
        contentTokens,
        candidate as keyof typeof languageMarkers,
      ),
  );
}

function containsLanguageMarker(
  searchable: string,
  contentTokens: ReadonlySet<string>,
  language: keyof typeof languageMarkers,
): boolean {
  const markers = languageMarkers[language];
  if (!markers) return false;
  return markers.some((marker) =>
    language === "zh"
      ? searchable.includes(marker)
      : tokenize(marker).every((word) => contentTokens.has(word)),
  );
}

function conceptTerms(
  concept: string,
  vocabulary: Record<string, readonly string[]> = {},
): string[] {
  const configured = vocabulary[normalize(concept)];
  const words = configured ?? tokenize(concept.replace(/[._-]+/g, " "));
  return words
    .flatMap((word) => [word, stem(word)])
    .filter((word) => word.length >= 4 && !ignoredConceptWords.has(word));
}

function hasConceptOverlap(content: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const contentTerms = new Set(
    tokenize(content).flatMap((word) => [word, stem(word)]),
  );
  return terms.some((term) => contentTerms.has(term));
}

function tokenize(value: string): string[] {
  return normalizeSearch(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function stem(value: string): string {
  return value.length > 6 ? value.slice(0, 6) : value;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en");
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    new Set(left).size === left.length
  );
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function reject(reason: LessonSemanticRejectionReason): never {
  throw new LessonSemanticValidationError(reason);
}
