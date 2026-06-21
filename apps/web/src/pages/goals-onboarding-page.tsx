import {
  additionalGoalOptions,
  cefrGoalLevelValues,
  goalOptions,
  type AdditionalGoal,
  type CefrGoalLevel,
  type Goal,
} from "@luma-lingo/shared";
import { ArrowRight, Target } from "lucide-react";
import { SubmitEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";
import {
  clearAboutYouDraft,
  loadAboutYouDraft,
  type AboutYouDraft,
} from "../onboarding/about-you-draft.js";
import {
  saveAgeAndGoals,
  UnauthorizedAgeAndGoalsError,
} from "../onboarding/age-and-goals-client.js";
import {
  toggleAdditionalGoal,
  validateGoalsForm,
} from "../onboarding/age-and-goals-form.js";

interface GoalsOnboardingPageProps {
  apiOrigin: string;
}

const choiceClasses =
  "flex min-h-13 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-[border-color,background-color] hover:bg-secondary has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export function GoalsOnboardingPage({ apiOrigin }: GoalsOnboardingPageProps) {
  const navigate = useNavigate();
  const [aboutYou, setAboutYou] = useState<AboutYouDraft | null>(() =>
    loadAboutYouDraft(),
  );
  const [primaryGoal, setPrimaryGoal] = useState<Goal | "">("");
  const [cefrGoalLevel, setCefrGoalLevel] = useState<CefrGoalLevel | "">("");
  const [additionalGoals, setAdditionalGoals] = useState<AdditionalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const me = await fetchMe(apiOrigin);
        if (!active) return;
        if (me.currentLearningTrack?.onboardingStatus === "completed") {
          navigate("/private", { replace: true });
          return;
        }
        if (!me.learner.instructionLanguage || !me.currentLearningTrack) {
          navigate("/onboarding/languages", { replace: true });
          return;
        }

        const draft = loadAboutYouDraft();
        const profileAboutYou = me.learner.ageRange
          ? {
              ageRange: me.learner.ageRange,
              displayName: me.learner.displayName ?? "",
            }
          : null;
        const resolvedAboutYou = draft ?? profileAboutYou;
        if (!resolvedAboutYou) {
          navigate("/onboarding/about-you", { replace: true });
          return;
        }

        setAboutYou(resolvedAboutYou);
        setPrimaryGoal(me.currentLearningTrack.learningGoal ?? "");
        setCefrGoalLevel(me.currentLearningTrack.goalCefrLevel ?? "");
        setAdditionalGoals(me.currentLearningTrack.additionalGoals ?? []);
      } catch (error) {
        if (error instanceof UnauthorizedSessionError) {
          navigate("/login", { replace: true });
          return;
        }
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  const formResult = validateGoalsForm({
    aboutYou,
    primaryGoal,
    cefrGoalLevel,
    additionalGoals,
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setAttempted(true);
    setSaved(false);
    if (!formResult.ok) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveAgeAndGoals(apiOrigin, formResult.selection);
      clearAboutYouDraft();
      setSaved(true);
    } catch (error) {
      if (error instanceof UnauthorizedAgeAndGoalsError) {
        navigate("/login", { replace: true });
        return;
      }
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function choosePrimaryGoal(goal: Goal) {
    setPrimaryGoal(goal);
    setSaved(false);
    if (goal !== "cefr_level") setCefrGoalLevel("");
    if (
      goal === "everyday_conversation" ||
      goal === "work" ||
      goal === "travel"
    ) {
      setAdditionalGoals((current) => current.filter((item) => item !== goal));
    }
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <section className="pt-2">
          <Progress
            label="Configuração inicial, etapa 3 de 4"
            max={4}
            value={3}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 3 de 4
          </p>
          <h1 className="mb-2">Quais são seus objetivos?</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Suas escolhas ajudam a preparar aulas focadas no que deseja
            alcançar.
          </p>
        </section>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Surface className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <Target aria-hidden="true" size={19} />
              </div>
              <div>
                <h2 className="mb-1">Seu objetivo</h2>
                <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                  Escolha uma prioridade. Depois, adicione até duas
                  complementares.
                </p>
              </div>
            </div>

            <fieldset
              className="flex flex-col gap-2"
              disabled={loading || saving}
            >
              <legend className="mb-1 font-medium">Objetivo principal</legend>
              {goalOptions.map((option) => (
                <label className={choiceClasses} key={option.value}>
                  <input
                    checked={primaryGoal === option.value}
                    className="size-4 accent-[var(--primary)]"
                    name="primary-goal"
                    onChange={() => choosePrimaryGoal(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>

            {primaryGoal === "cefr_level" ? (
              <fieldset
                className="flex flex-col gap-2"
                disabled={loading || saving}
              >
                <legend className="mb-1 font-medium">
                  Nível que deseja alcançar
                </legend>
                <div className="grid grid-cols-4 gap-2">
                  {cefrGoalLevelValues.map((level) => (
                    <label className={choiceClasses} key={level}>
                      <input
                        checked={cefrGoalLevel === level}
                        className="size-4 accent-[var(--primary)]"
                        name="cefr-goal-level"
                        onChange={() => {
                          setCefrGoalLevel(level);
                          setSaved(false);
                        }}
                        type="radio"
                        value={level}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset
              className="flex flex-col gap-2"
              disabled={loading || saving}
            >
              <legend className="mb-1 font-medium">
                Objetivos adicionais (opcional)
              </legend>
              {additionalGoalOptions.map((option) => {
                const selected = additionalGoals.includes(option.value);
                const matchesPrimary = primaryGoal === option.value;
                const limitReached = additionalGoals.length >= 2 && !selected;
                return (
                  <label
                    className={`${choiceClasses} ${matchesPrimary ? "opacity-50" : ""}`}
                    key={option.value}
                  >
                    <input
                      checked={selected}
                      className="size-4 accent-[var(--primary)]"
                      disabled={matchesPrimary || limitReached}
                      onChange={() => {
                        setAdditionalGoals((current) =>
                          toggleAdditionalGoal(current, option.value),
                        );
                        setSaved(false);
                      }}
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </fieldset>
          </Surface>

          {attempted && !formResult.ok ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-destructive"
              role="alert"
            >
              {formResult.error}
            </p>
          ) : null}
          {failed ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-destructive"
              role="alert"
            >
              Não foi possível salvar. Tente novamente.
            </p>
          ) : null}
          {saved ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-primary"
              role="status"
            >
              Idade e objetivos salvos.
            </p>
          ) : null}

          <Button disabled={loading || saving} size="full" type="submit">
            {saving ? "Salvando…" : "Salvar e continuar"}
            {!saving ? <ArrowRight aria-hidden="true" size={17} /> : null}
          </Button>
        </form>
      </div>
    </main>
  );
}
