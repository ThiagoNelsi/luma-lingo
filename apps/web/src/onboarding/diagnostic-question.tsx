import type {
  DiagnosticQuestionPrompt,
  DiagnosticQuestionResponse,
} from "@luma-lingo/shared";
import { Check, HelpCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { InitialDiagnosticItem } from "./initial-diagnostic-client.js";
import { Button } from "../design-system/components/index.js";

interface DiagnosticQuestionPanelProps {
  disabled?: boolean;
  instructionLanguage?: string | null;
  item: InitialDiagnosticItem;
  onAnswer: (response: DiagnosticQuestionResponse) => void;
  selectedResponse: DiagnosticQuestionResponse | null;
}

const optionBaseClasses =
  "flex min-h-13 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-[border-color,background-color,transform] active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-70";
const optionIdleClasses =
  "border-border bg-card text-foreground hover:not-disabled:bg-secondary";
const optionSelectedClasses = "border-primary bg-secondary text-primary";

export function getDiagnosticInstruction(
  prompt: DiagnosticQuestionPrompt,
  instructionLanguage?: string | null,
): string {
  if (
    instructionLanguage &&
    prompt.instructionLocalizations[instructionLanguage]
  ) {
    return prompt.instructionLocalizations[instructionLanguage];
  }

  return Object.values(prompt.instructionLocalizations)[0] ?? "";
}

export function splitFillBlankText(text: string): {
  before: string;
  after: string;
  hasBlank: boolean;
} {
  const blankIndex = text.indexOf("___");
  if (blankIndex === -1) {
    return { before: text, after: "", hasBlank: false };
  }

  return {
    before: text.slice(0, blankIndex).trimEnd(),
    after: text.slice(blankIndex + 3).trimStart(),
    hasBlank: true,
  };
}

export function createDontKnowDiagnosticResponse(): DiagnosticQuestionResponse {
  return {
    schemaVersion: 1,
    kind: "dont_know",
  };
}

export function shuffleWordBankTokens<T>(
  tokens: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffledTokens = [...tokens];

  for (let index = shuffledTokens.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledTokens[index], shuffledTokens[swapIndex]] = [
      shuffledTokens[swapIndex]!,
      shuffledTokens[index]!,
    ];
  }

  if (
    shuffledTokens.length > 1 &&
    shuffledTokens.every((token, index) => token === tokens[index])
  ) {
    [shuffledTokens[0], shuffledTokens[1]] = [
      shuffledTokens[1]!,
      shuffledTokens[0]!,
    ];
  }

  return shuffledTokens;
}

export function DiagnosticQuestionPanel({
  disabled = false,
  instructionLanguage,
  item,
  onAnswer,
  selectedResponse,
}: DiagnosticQuestionPanelProps) {
  const instruction = getDiagnosticInstruction(
    item.prompt,
    instructionLanguage,
  );
  const showInstruction = item.prompt.kind !== "word_bank_sequence";

  return (
    <section className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3">
        {showInstruction && instruction ? (
          <p className="mb-0 max-w-[58ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            {instruction}
          </p>
        ) : null}
        <PromptText prompt={item.prompt} />
      </div>

      {item.prompt.kind === "multiple_choice" ? (
        <MultipleChoiceQuestion
          disabled={disabled}
          onAnswer={onAnswer}
          prompt={item.prompt}
          selectedResponse={selectedResponse}
        />
      ) : null}
      {item.prompt.kind === "fill_blank_choice" ? (
        <FillBlankChoiceQuestion
          disabled={disabled}
          onAnswer={onAnswer}
          prompt={item.prompt}
          selectedResponse={selectedResponse}
        />
      ) : null}
      {item.prompt.kind === "word_bank_sequence" ? (
        <WordBankSequenceQuestion
          disabled={disabled}
          onAnswer={onAnswer}
          prompt={item.prompt}
          selectedResponse={selectedResponse}
        />
      ) : null}
    </section>
  );
}

function PromptText({ prompt }: { prompt: DiagnosticQuestionPrompt }) {
  if (prompt.kind === "multiple_choice") {
    return (
      <h1 className="mb-0 max-w-[24ch] text-[1.625rem] leading-tight sm:text-[2rem]">
        {prompt.stem}
      </h1>
    );
  }

  if (prompt.kind === "fill_blank_choice") {
    const parts = splitFillBlankText(prompt.text);
    return (
      <h1 className="mb-0 max-w-[26ch] text-[1.625rem] leading-tight sm:text-[2rem]">
        {parts.hasBlank ? (
          <>
            {parts.before}{" "}
            <span className="inline-flex min-w-20 border-b-2 border-primary px-2 align-baseline">
              &nbsp;
            </span>{" "}
            {parts.after}
          </>
        ) : (
          prompt.text
        )}
      </h1>
    );
  }

  return (
    <h1 className="mb-0 max-w-[24ch] text-[1.625rem] leading-tight sm:text-[2rem]">
      {getDiagnosticInstruction(prompt)}
    </h1>
  );
}

function MultipleChoiceQuestion({
  disabled,
  onAnswer,
  prompt,
  selectedResponse,
}: {
  disabled: boolean;
  onAnswer: (response: DiagnosticQuestionResponse) => void;
  prompt: Extract<DiagnosticQuestionPrompt, { kind: "multiple_choice" }>;
  selectedResponse: DiagnosticQuestionResponse | null;
}) {
  const selectedOptionIds =
    selectedResponse?.kind === "multiple_choice"
      ? selectedResponse.selectedOptionIds
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2">
        {prompt.options.map((option) => {
          const selected = selectedOptionIds.includes(option.id);
          return (
            <button
              className={[
                optionBaseClasses,
                selected ? optionSelectedClasses : optionIdleClasses,
              ].join(" ")}
              disabled={disabled}
              key={option.id}
              onClick={() =>
                onAnswer({
                  schemaVersion: 1,
                  kind: "multiple_choice",
                  selectedOptionIds: [option.id],
                })
              }
              type="button"
            >
              <span>{option.text}</span>
              {selected ? <Check aria-hidden="true" size={17} /> : null}
            </button>
          );
        })}
      </div>
      <DontKnowButton disabled={disabled} onAnswer={onAnswer} />
    </div>
  );
}

function FillBlankChoiceQuestion({
  disabled,
  onAnswer,
  prompt,
  selectedResponse,
}: {
  disabled: boolean;
  onAnswer: (response: DiagnosticQuestionResponse) => void;
  prompt: Extract<DiagnosticQuestionPrompt, { kind: "fill_blank_choice" }>;
  selectedResponse: DiagnosticQuestionResponse | null;
}) {
  const selectedOptionId =
    selectedResponse?.kind === "fill_blank_choice"
      ? selectedResponse.selectedOptionId
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {prompt.options.map((option) => {
          const selected = selectedOptionId === option.id;
          return (
            <button
              className={[
                optionBaseClasses,
                selected ? optionSelectedClasses : optionIdleClasses,
              ].join(" ")}
              disabled={disabled}
              key={option.id}
              onClick={() =>
                onAnswer({
                  schemaVersion: 1,
                  kind: "fill_blank_choice",
                  blankId: prompt.blankId,
                  selectedOptionId: option.id,
                })
              }
              type="button"
            >
              <span>{option.text}</span>
              {selected ? <Check aria-hidden="true" size={17} /> : null}
            </button>
          );
        })}
      </div>
      <DontKnowButton disabled={disabled} onAnswer={onAnswer} />
    </div>
  );
}

function WordBankSequenceQuestion({
  disabled,
  onAnswer,
  prompt,
  selectedResponse,
}: {
  disabled: boolean;
  onAnswer: (response: DiagnosticQuestionResponse) => void;
  prompt: Extract<DiagnosticQuestionPrompt, { kind: "word_bank_sequence" }>;
  selectedResponse: DiagnosticQuestionResponse | null;
}) {
  const initialSelectedTokenIds =
    selectedResponse?.kind === "word_bank_sequence"
      ? selectedResponse.selectedTokenIds
      : [];
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>(
    initialSelectedTokenIds,
  );
  const tokenById = useMemo(
    () => new Map(prompt.tokens.map((token) => [token.id, token])),
    [prompt.tokens],
  );
  const tokenOrderKey = getWordBankResetKey(prompt);
  const displayedTokens = useMemo(
    () => shuffleWordBankTokens(prompt.tokens),
    [tokenOrderKey],
  );
  const availableTokens = displayedTokens.filter(
    (token) => !selectedTokenIds.includes(token.id),
  );

  useEffect(() => {
    setSelectedTokenIds(initialSelectedTokenIds);
  }, [selectedResponse, tokenOrderKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-17 flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-3">
        {selectedTokenIds.length > 0 ? (
          selectedTokenIds.map((tokenId, index) => {
            const token = tokenById.get(tokenId);
            if (!token) return null;
            return (
              <button
                className="animate-[diagnostic-token-pop_180ms_ease-out] rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-80"
                disabled={disabled}
                key={`${tokenId}-${index}`}
                onClick={() =>
                  setSelectedTokenIds((current) =>
                    current.filter((_, tokenIndex) => tokenIndex !== index),
                  )
                }
                type="button"
              >
                {token.text}
              </button>
            );
          })
        ) : (
          <span className="text-[var(--text-caption)] text-muted-foreground">
            ...
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableTokens.map((token) => (
          <button
            className="min-h-11 animate-[diagnostic-token-return_160ms_ease-out] rounded-lg border border-border bg-card px-4 py-2 font-medium transition-colors hover:not-disabled:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
            disabled={disabled}
            key={token.id}
            onClick={() =>
              setSelectedTokenIds((current) => [...current, token.id])
            }
            type="button"
          >
            {token.text}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <Button
          disabled={disabled || selectedTokenIds.length === 0}
          onClick={() => setSelectedTokenIds([])}
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" size={16} />
          Limpar
        </Button>
        <DontKnowButton disabled={disabled} onAnswer={onAnswer} />
        <Button
          disabled={disabled || selectedTokenIds.length < 2}
          onClick={() =>
            onAnswer({
              schemaVersion: 1,
              kind: "word_bank_sequence",
              selectedTokenIds,
            })
          }
        >
          Responder
        </Button>
      </div>
    </div>
  );
}

function DontKnowButton({
  disabled,
  onAnswer,
}: {
  disabled: boolean;
  onAnswer: (response: DiagnosticQuestionResponse) => void;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={() => onAnswer(createDontKnowDiagnosticResponse())}
      variant="outline"
    >
      <HelpCircle aria-hidden="true" size={17} />
      Não sei
    </Button>
  );
}

export function getWordBankResetKey(
  prompt: Extract<DiagnosticQuestionPrompt, { kind: "word_bank_sequence" }>,
): string {
  return prompt.tokens.map((token) => `${token.id}:${token.text}`).join("|");
}
