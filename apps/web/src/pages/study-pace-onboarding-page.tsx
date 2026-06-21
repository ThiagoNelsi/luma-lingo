import {
  studyPaceOptions,
  type LessonEmphasis,
  type StudyPace,
} from "@luma-lingo/shared";
import { ArrowRight, Feather, Gauge, Rocket } from "lucide-react";
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
  saveLessonPreferences,
  UnauthorizedLessonPreferencesError,
} from "../onboarding/lesson-preferences-client.js";
import {
  getProfileIntroduction,
  UnauthorizedProfileIntroductionError,
} from "../onboarding/profile-introduction-client.js";

interface StudyPaceOnboardingPageProps {
  apiOrigin: string;
}

const choiceClasses =
  "flex min-h-19 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-[border-color,background-color,transform] hover:bg-secondary active:translate-y-px has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

const paceIcons = {
  relaxed: Feather,
  accelerated: Rocket,
} as const;

export function StudyPaceOnboardingPage({
  apiOrigin,
}: StudyPaceOnboardingPageProps) {
  const navigate = useNavigate();
  const [lessonEmphases, setLessonEmphases] = useState<LessonEmphasis[]>([]);
  const [studyPace, setStudyPace] = useState<StudyPace | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPace() {
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

        setLessonEmphases(me.currentLearningTrack.lessonEmphases);
        setStudyPace(me.currentLearningTrack.studyPace ?? "");
      } catch (error) {
        if (
          error instanceof UnauthorizedSessionError ||
          error instanceof UnauthorizedLessonPreferencesError ||
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

    void loadPace();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (lessonEmphases.length === 0) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveLessonPreferences(apiOrigin, {
        lessonEmphases,
        studyPace: studyPace || null,
      });
      navigate("/private");
    } catch (error) {
      if (error instanceof UnauthorizedLessonPreferencesError) {
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
            label="Configuração inicial, etapa 6 de 6"
            max={6}
            value={6}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 6 de 6
          </p>
          <h1 className="mb-2">Como você prefere avançar?</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Ajustaremos o ritmo das atividades para combinar melhor com seu
            jeito de estudar.
          </p>
        </section>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Surface className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <Gauge aria-hidden="true" size={19} />
              </span>
              <div>
                <h2 className="mb-1">Escolha seu ritmo</h2>
                <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                  Esta escolha é opcional.
                </p>
              </div>
            </div>

            <fieldset
              className="flex flex-col gap-2"
              disabled={loading || saving}
            >
              {studyPaceOptions.map((option) => {
                const Icon = paceIcons[option.value];
                return (
                  <label className={choiceClasses} key={option.value}>
                    <input
                      checked={studyPace === option.value}
                      className="size-4 shrink-0 accent-[var(--primary)]"
                      name="study-pace"
                      onChange={() => setStudyPace(option.value)}
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
              <label className={choiceClasses}>
                <input
                  checked={studyPace === ""}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                  name="study-pace"
                  onChange={() => setStudyPace("")}
                  type="radio"
                  value=""
                />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Gauge aria-hidden="true" size={19} />
                </span>
                <span>
                  <span className="block font-medium">Ainda não sei</span>
                  <span className="block text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
                    Você poderá decidir depois
                  </span>
                </span>
              </label>
            </fieldset>
          </Surface>

          {failed ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-destructive"
              role="alert"
            >
              Não foi possível salvar seu ritmo. Tente novamente.
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
