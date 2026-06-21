import {
  lessonEmphasisOptions,
  type LessonEmphasis,
  type StudyPace,
} from "@luma-lingo/shared";
import { ArrowRight, BookOpen, Headphones, PenLine } from "lucide-react";
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
  toggleLessonEmphasis,
  validateLessonPreferencesForm,
} from "../onboarding/lesson-preferences-form.js";
import {
  getProfileIntroduction,
  UnauthorizedProfileIntroductionError,
} from "../onboarding/profile-introduction-client.js";

interface LessonPreferencesOnboardingPageProps {
  apiOrigin: string;
}

const choiceClasses =
  "flex min-h-19 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-[border-color,background-color,transform] hover:bg-secondary active:translate-y-px has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

const emphasisIcons = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
} as const;

export function LessonPreferencesOnboardingPage({
  apiOrigin,
}: LessonPreferencesOnboardingPageProps) {
  const navigate = useNavigate();
  const [lessonEmphases, setLessonEmphases] = useState<LessonEmphasis[]>([]);
  const [studyPace, setStudyPace] = useState<StudyPace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
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

        setLessonEmphases(me.currentLearningTrack.lessonEmphases ?? []);
        setStudyPace(me.currentLearningTrack.studyPace ?? null);
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

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  const formResult = validateLessonPreferencesForm({
    lessonEmphases,
    studyPace: studyPace ?? "",
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formResult.ok) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveLessonPreferences(apiOrigin, formResult.selection);
      navigate("/onboarding/pace");
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
            label="Configuração inicial, etapa 5 de 6"
            max={6}
            value={5}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 5 de 6
          </p>
          <h1 className="mb-2">Como você gosta de aprender?</h1>
          <p className="mb-0 leading-[var(--line-height-relaxed)] text-muted-foreground">
            Vamos usar suas preferências para equilibrar as atividades das suas
            aulas.
          </p>
        </section>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Surface className="flex flex-col gap-5">
            <fieldset disabled={loading || saving}>
              <legend className="mb-1 text-[var(--text-feature)] font-semibold">
                Quando estou estudando, prefiro…
              </legend>
              <p className="mb-4 text-[var(--text-caption)] text-muted-foreground">
                Escolha uma ou mais opções.
              </p>
              <div className="flex flex-col gap-2">
                {lessonEmphasisOptions.map((option) => {
                  const Icon = emphasisIcons[option.value];
                  return (
                    <label className={choiceClasses} key={option.value}>
                      <input
                        checked={lessonEmphases.includes(option.value)}
                        className="size-4 shrink-0 accent-[var(--primary)]"
                        onChange={() =>
                          setLessonEmphases((current) =>
                            toggleLessonEmphasis(current, option.value),
                          )
                        }
                        type="checkbox"
                        value={option.value}
                      />
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon aria-hidden="true" size={19} />
                      </span>
                      <span>
                        <span className="block font-medium">
                          {option.label}
                        </span>
                        <span className="block text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
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
              Não foi possível salvar suas preferências. Tente novamente.
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
