import {
  ArrowRight,
  Check,
  CircleHelp,
  Columns3,
  ListChecks,
  MessageSquareText,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";

// PROTOTYPE - wipe me.
// Mobile-first Initial diagnostic question UI prototype on the throwaway
// /prototype/initial-diagnostic-ui route.

type QuestionType =
  "multiple_choice" | "word_bank_sequence" | "fill_blank_choice";

interface BaseQuestion {
  id: string;
  type: QuestionType;
  label: string;
  prompt: string;
  competency: string;
  difficulty: string;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: Array<{ id: string; label: string }>;
}

interface WordBankQuestion extends BaseQuestion {
  type: "word_bank_sequence";
  tokens: Array<{ id: string; label: string }>;
}

interface FillBlankQuestion extends BaseQuestion {
  type: "fill_blank_choice";
  beforeBlank: string;
  afterBlank: string;
  choices: Array<{ id: string; label: string }>;
}

type DiagnosticQuestion =
  MultipleChoiceQuestion | WordBankQuestion | FillBlankQuestion;

type AnswerState = Record<string, string | string[]>;

const questions: DiagnosticQuestion[] = [
  {
    id: "mc-1",
    type: "multiple_choice",
    label: "Meaning check",
    prompt: 'Choose the sentence that means "I have a ticket."',
    competency: "travel-basics-have",
    difficulty: "A1",
    options: [
      { id: "a", label: "I need a ticket." },
      { id: "b", label: "I have a ticket." },
      { id: "c", label: "I buy a ticket." },
      { id: "d", label: "I lost a ticket." },
    ],
  },
  {
    id: "mc-2",
    type: "multiple_choice",
    label: "Negative form",
    prompt: 'Which option means "She does not eat meat"?',
    competency: "present-simple-negative",
    difficulty: "A1",
    options: [
      { id: "a", label: "She not eats meat." },
      { id: "b", label: "She doesn't eat meat." },
      { id: "c", label: "She don't eat meat." },
      { id: "d", label: "She isn't eat meat." },
    ],
  },
  {
    id: "wb-1",
    type: "word_bank_sequence",
    label: "Sentence order",
    prompt: "Build a polite cafe request.",
    competency: "request-phrases",
    difficulty: "A1",
    tokens: [
      { id: "i", label: "I" },
      { id: "would", label: "would" },
      { id: "like", label: "like" },
      { id: "a", label: "a" },
      { id: "coffee", label: "coffee" },
    ],
  },
  {
    id: "wb-2",
    type: "word_bank_sequence",
    label: "Question order",
    prompt: "Build the question for asking location.",
    competency: "where-question-order",
    difficulty: "A1",
    tokens: [
      { id: "where", label: "Where" },
      { id: "is", label: "is" },
      { id: "the", label: "the" },
      { id: "station", label: "station" },
      { id: "please", label: "please" },
    ],
  },
  {
    id: "fb-1",
    type: "fill_blank_choice",
    label: "Preposition choice",
    prompt: "Complete the sentence.",
    competency: "time-prepositions",
    difficulty: "A1",
    beforeBlank: "The lesson starts",
    afterBlank: "nine o'clock.",
    choices: [
      { id: "in", label: "in" },
      { id: "on", label: "on" },
      { id: "at", label: "at" },
      { id: "by", label: "by" },
    ],
  },
  {
    id: "fb-2",
    type: "fill_blank_choice",
    label: "Quantifier choice",
    prompt: "Complete the sentence.",
    competency: "countable-uncountable",
    difficulty: "A2",
    beforeBlank: "There isn't",
    afterBlank: "milk in the fridge.",
    choices: [
      { id: "many", label: "many" },
      { id: "much", label: "much" },
      { id: "few", label: "few" },
      { id: "several", label: "several" },
    ],
  },
];

const firstQuestion = questions[0] as DiagnosticQuestion;

export function InitialDiagnosticUiPrototypePage() {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [activeQuestionId, setActiveQuestionId] = useState(firstQuestion.id);

  const activeQuestion =
    questions.find((question) => question.id === activeQuestionId) ??
    firstQuestion;
  const currentIndex = Math.max(
    questions.findIndex((question) => question.id === activeQuestion.id),
    0,
  );
  const nextQuestion =
    questions[(currentIndex + 1) % questions.length] ?? firstQuestion;

  const completion = useMemo(() => {
    const answered = questions.filter((question) => answers[question.id]);
    return {
      answeredCount: answered.length,
      totalCount: questions.length,
      percent: Math.round((answered.length / questions.length) * 100),
    };
  }, [answers]);

  function setAnswer(questionId: string, answer: string | string[]) {
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  }

  function resetQuestion(questionId: string) {
    setAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  function selectWordToken(question: WordBankQuestion, tokenId: string) {
    const current = answers[question.id];
    const sequence = Array.isArray(current) ? current : [];
    if (sequence.includes(tokenId)) {
      setAnswer(
        question.id,
        sequence.filter((id) => id !== tokenId),
      );
      return;
    }
    setAnswer(question.id, [...sequence, tokenId]);
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-184 flex-col gap-5">
        <PageHeader />
        <section className="pt-1">
          <Progress
            label="Initial diagnostic prototype progress"
            max={completion.totalCount}
            value={completion.answeredCount}
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Initial diagnostic
              </p>
              <h1 className="mb-2">One clear decision at a time</h1>
              <p className="mb-0 max-w-[56ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
                {completion.answeredCount} of {completion.totalCount} answered
              </p>
            </div>
            <CompletionBadge completion={completion} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <QuestionTabs
            activeQuestionId={activeQuestion.id}
            answers={answers}
            onQuestionChange={setActiveQuestionId}
            questions={questions}
          />

          <Surface className="flex min-h-[34rem] flex-col gap-5 p-5 sm:p-6">
            <QuestionHeader question={activeQuestion} />
            <QuestionPrompt
              answer={answers[activeQuestion.id]}
              onResetQuestion={resetQuestion}
              question={activeQuestion}
            />
            <QuestionInteraction
              answers={answers}
              onAnswer={setAnswer}
              onResetQuestion={resetQuestion}
              onSelectWordToken={selectWordToken}
              question={activeQuestion}
            />
            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                className="sm:w-auto"
                onClick={() => resetQuestion(activeQuestion.id)}
                size="full"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" size={16} />
                Clear answer
              </Button>
              <Button
                className="sm:w-auto"
                onClick={() => setActiveQuestionId(nextQuestion.id)}
                size="full"
              >
                Next question
                <ArrowRight aria-hidden="true" size={17} />
              </Button>
            </div>
          </Surface>
        </section>
      </div>
    </main>
  );
}

function QuestionTabs({
  activeQuestionId,
  answers,
  onQuestionChange,
  questions,
}: {
  activeQuestionId: string;
  answers: AnswerState;
  onQuestionChange: (questionId: string) => void;
  questions: DiagnosticQuestion[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {questions.map((question, index) => {
        const selected = question.id === activeQuestionId;
        const answered = Boolean(answers[question.id]);
        return (
          <button
            className={[
              "flex min-h-13 items-center justify-center rounded-lg border text-[var(--text-caption)] font-medium transition-colors",
              selected
                ? "border-primary bg-secondary text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            ].join(" ")}
            key={question.id}
            onClick={() => onQuestionChange(question.id)}
            type="button"
          >
            <span className="flex items-center gap-1.5">
              {answered ? <Check aria-hidden="true" size={14} /> : null}Q
              {index + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function QuestionHeader({ question }: { question: DiagnosticQuestion }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <QuestionTypeIcon question={question} />
        <div className="min-w-0">
          <p className="mb-1 font-semibold">{question.label}</p>
          <p className="mb-0 truncate text-[var(--text-caption)] text-muted-foreground">
            {question.competency}
          </p>
        </div>
      </div>
      <span className="w-fit rounded-full bg-secondary px-3 py-1 text-[var(--text-caption)] font-medium text-primary">
        {question.difficulty}
      </span>
    </div>
  );
}

function QuestionPrompt({
  answer,
  onResetQuestion,
  question,
}: {
  answer: string | string[] | undefined;
  onResetQuestion: (questionId: string) => void;
  question: DiagnosticQuestion;
}) {
  if (question.type === "fill_blank_choice") {
    const selectedChoice =
      typeof answer === "string"
        ? question.choices.find((choice) => choice.id === answer)
        : undefined;

    return (
      <div>
        <p className="mb-3 text-[var(--text-caption)] font-medium text-muted-foreground">
          {question.prompt}
        </p>
        <p className="mb-0 text-2xl font-semibold leading-[var(--line-height-tight)]">
          {question.beforeBlank}{" "}
          {selectedChoice ? (
            <button
              className="inline-flex min-h-9 min-w-24 animate-[diagnostic-token-pop_180ms_ease-out] items-center justify-center rounded-lg border border-primary bg-secondary px-3 text-primary"
              onClick={() => onResetQuestion(question.id)}
              type="button"
            >
              {selectedChoice.label}
            </button>
          ) : (
            <span className="inline-flex min-h-9 min-w-24 items-center justify-center rounded-lg border border-dashed border-primary px-3 text-primary">
              ...
            </span>
          )}{" "}
          {question.afterBlank}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[var(--text-caption)] font-medium text-muted-foreground">
        Prompt
      </p>
      <p className="mb-0 text-2xl font-semibold leading-[var(--line-height-tight)]">
        {question.prompt}
      </p>
    </div>
  );
}

function QuestionInteraction({
  answers,
  onAnswer,
  onResetQuestion,
  onSelectWordToken,
  question,
}: {
  answers: AnswerState;
  onAnswer: (questionId: string, answer: string | string[]) => void;
  onResetQuestion: (questionId: string) => void;
  onSelectWordToken: (question: WordBankQuestion, tokenId: string) => void;
  question: DiagnosticQuestion;
}) {
  if (question.type === "multiple_choice") {
    return (
      <ChoiceGrid>
        {question.options.map((option) => (
          <AnswerButton
            active={answers[question.id] === option.id}
            key={option.id}
            label={option.label}
            onClick={() => onAnswer(question.id, option.id)}
          />
        ))}
        <DontKnowButton
          active={answers[question.id] === "dont_know"}
          onClick={() => onAnswer(question.id, "dont_know")}
        />
      </ChoiceGrid>
    );
  }

  if (question.type === "fill_blank_choice") {
    return (
      <ChoiceGrid>
        {question.choices.map((choice) => {
          const selected = answers[question.id] === choice.id;
          return selected ? (
            <DisabledOptionSlot key={choice.id} label={choice.label} />
          ) : (
            <AnswerButton
              active={false}
              key={choice.id}
              label={choice.label}
              onClick={() => onAnswer(question.id, choice.id)}
            />
          );
        })}
        <DontKnowButton
          active={answers[question.id] === "dont_know"}
          onClick={() => onAnswer(question.id, "dont_know")}
        />
      </ChoiceGrid>
    );
  }

  const sequence = Array.isArray(answers[question.id])
    ? (answers[question.id] as string[])
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-20 rounded-lg border border-border bg-secondary p-3">
        <div className="flex flex-wrap gap-2">
          {sequence.length > 0 ? (
            sequence.map((tokenId) => {
              const token = question.tokens.find((item) => item.id === tokenId);
              return token ? (
                <button
                  className="animate-[diagnostic-token-pop_180ms_ease-out] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                  key={token.id}
                  onClick={() => onSelectWordToken(question, token.id)}
                  type="button"
                >
                  {token.label}
                </button>
              ) : null;
            })
          ) : (
            <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
              Select words below.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {question.tokens.map((token) => {
          const selected = sequence.includes(token.id);
          return selected ? (
            <EmptyOptionSlot key={token.id} label={token.label} />
          ) : (
            <button
              className="min-h-11 animate-[diagnostic-token-return_160ms_ease-out] rounded-lg border border-border bg-card px-4 py-2 font-medium transition-colors hover:bg-secondary"
              key={token.id}
              onClick={() => onSelectWordToken(question, token.id)}
              type="button"
            >
              {token.label}
            </button>
          );
        })}
        <button
          className={[
            "min-h-11 rounded-lg border px-4 py-2 font-medium transition-colors",
            answers[question.id] === "dont_know"
              ? "border-primary bg-secondary text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-secondary",
          ].join(" ")}
          onClick={() => onAnswer(question.id, "dont_know")}
          type="button"
        >
          I don't know
        </button>
        <button
          className="min-h-11 rounded-lg border border-transparent px-4 py-2 text-muted-foreground transition-colors hover:bg-secondary"
          onClick={() => onResetQuestion(question.id)}
          type="button"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ChoiceGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}

function EmptyOptionSlot({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex min-h-14 items-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_7%,var(--card))] px-4 py-3 text-left font-medium text-transparent"
    >
      {label}
    </span>
  );
}

function DisabledOptionSlot({ label }: { label: string }) {
  return (
    <span
      aria-disabled="true"
      className="flex min-h-14 items-center rounded-lg border border-border bg-muted px-4 py-3 text-left font-medium text-muted-foreground opacity-70"
    >
      {label}
    </span>
  );
}

function AnswerButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex min-h-14 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-[background-color,border-color,transform] active:translate-y-px",
        active
          ? "border-primary bg-secondary text-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {active ? (
        <Check aria-hidden="true" className="text-primary" size={17} />
      ) : null}
    </button>
  );
}

function DontKnowButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-colors",
        active
          ? "border-primary bg-secondary text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <CircleHelp aria-hidden="true" size={17} />I don't know
    </button>
  );
}

function QuestionTypeIcon({ question }: { question: DiagnosticQuestion }) {
  const iconClasses =
    "flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary";
  if (question.type === "multiple_choice") {
    return (
      <span className={iconClasses}>
        <ListChecks aria-hidden="true" size={18} />
      </span>
    );
  }
  if (question.type === "word_bank_sequence") {
    return (
      <span className={iconClasses}>
        <Columns3 aria-hidden="true" size={18} />
      </span>
    );
  }
  return (
    <span className={iconClasses}>
      <MessageSquareText aria-hidden="true" size={18} />
    </span>
  );
}

function CompletionBadge({
  completion,
}: {
  completion: {
    answeredCount: number;
    totalCount: number;
    percent: number;
  };
}) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[var(--text-caption)] font-medium">
      <Sparkles aria-hidden="true" className="text-accent" size={16} />
      {completion.percent}% complete
    </div>
  );
}
