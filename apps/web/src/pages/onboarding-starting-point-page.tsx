import {
  onboardingStartingPointOptions,
  type OnboardingStartingPoint,
} from "@luma-lingo/shared";
import { ArrowRight, ClipboardCheck, Compass, Sprout } from "lucide-react";
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
  saveOnboardingStartingPoint,
  UnauthorizedOnboardingStartingPointError,
} from "../onboarding/onboarding-starting-point-client.js";
import { validateOnboardingStartingPointForm } from "../onboarding/onboarding-starting-point-form.js";
import {
  getProfileIntroduction,
  UnauthorizedProfileIntroductionError,
} from "../onboarding/profile-introduction-client.js";

interface OnboardingStartingPointPageProps {
  apiOrigin: string;
}

const choiceClasses =
  "flex min-h-24 items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition-[border-color,background-color,transform] hover:bg-secondary active:translate-y-px has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

const startingPointIcons = {
  beginner: Sprout,
  diagnostic: ClipboardCheck,
} as const;

export function OnboardingStartingPointPage({
  apiOrigin,
}: OnboardingStartingPointPageProps) {
  const navigate = useNavigate();
  const [onboardingStartingPoint, setOnboardingStartingPoint] = useState<
    OnboardingStartingPoint | ""
  >("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStartingPoint() {
      try {
        const [me, introduction] = await Promise.all([
          fetchMe(apiOrigin),
          getProfileIntroduction(apiOrigin),
        ]);
        if (!active) return;
        if (me.currentLearningTrack?.onboardingStatus === "completed") {
          navigate("/private", { replace: true });
          return;
        }
        if (!me.learner.instructionLanguage || !me.currentLearningTrack) {
          navigate("/onboarding/languages", { replace: true });
          return;
        }
        if (!me.currentLearningTrack?.learningGoal) {
          navigate("/onboarding/goals", { replace: true });
          return;
        }
        if (introduction.status === "not_started") {
          navigate("/onboarding/introduction", { replace: true });
          return;
        }
        if (!me.currentLearningTrack.lessonEmphases?.length) {
          navigate("/onboarding/preferences", { replace: true });
          return;
        }

        setOnboardingStartingPoint(
          me.currentLearningTrack.onboardingStartingPoint ?? "",
        );
      } catch (error) {
        if (
          error instanceof UnauthorizedSessionError ||
          error instanceof UnauthorizedOnboardingStartingPointError ||
          error instanceof UnauthorizedProfileIntroductionError
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStartingPoint();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  const formResult = validateOnboardingStartingPointForm({
    onboardingStartingPoint,
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formResult.ok) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveOnboardingStartingPoint(apiOrigin, formResult.selection);
      navigate(
        formResult.selection.onboardingStartingPoint === "beginner"
          ? "/onboarding/profile-review"
          : "/onboarding/initial-diagnostic",
      );
    } catch (error) {
      if (error instanceof UnauthorizedOnboardingStartingPointError) {
        navigate("/login", { replace: true });
        return;
      }
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <section className="pt-2">
          <Progress
            label="Configuração inicial, etapa 7 de 7"
            max={7}
            value={7}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 7 de 7
          </p>
          <h1 className="mb-2">Por onde você quer começar?</h1>
          <p className="mb-0 max-w-[50ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Escolha o caminho inicial. Você ainda poderá ajustar o ritmo das
            aulas conforme for avançando.
          </p>
        </section>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Surface className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <Compass aria-hidden="true" size={19} />
              </span>
              <div>
                <h2 className="mb-1">Escolha seu ponto de partida</h2>
                <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                  Use o caminho que combina melhor com o que você já sabe.
                </p>
              </div>
            </div>

            <fieldset
              className="flex flex-col gap-2"
              disabled={loading || saving}
            >
              {onboardingStartingPointOptions.map((option) => {
                const Icon = startingPointIcons[option.value];
                return (
                  <label className={choiceClasses} key={option.value}>
                    <input
                      checked={onboardingStartingPoint === option.value}
                      className="size-4 shrink-0 accent-[var(--primary)]"
                      name="onboarding-starting-point"
                      onChange={() => setOnboardingStartingPoint(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon aria-hidden="true" size={19} />
                    </span>
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {attempted && !formResult.ok ? (
              <p
                className="mb-0 text-[var(--text-caption)] text-destructive"
                role="alert"
              >
                {formResult.error}
              </p>
            ) : null}
          </Surface>

          {failed ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-destructive"
              role="alert"
            >
              Não foi possível salvar seu ponto de partida. Tente novamente.
            </p>
          ) : null}

          <Button disabled={loading || saving} size="full" type="submit">
            {saving ? "Salvando…" : "Salvar e continuar"}
            <ArrowRight aria-hidden="true" size={17} />
          </Button>
        </form>
      </div>
    </main>
  );
}
