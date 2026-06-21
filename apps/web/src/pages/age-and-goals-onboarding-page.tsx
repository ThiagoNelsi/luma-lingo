import {
  learnerAgeRangeOptions,
  type LearnerAgeRange,
} from "@luma-lingo/shared";
import { ArrowRight, UserRound } from "lucide-react";
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
  loadAboutYouDraft,
  saveAboutYouDraft,
} from "../onboarding/about-you-draft.js";
import { validateAboutYouForm } from "../onboarding/age-and-goals-form.js";

interface AgeAndGoalsOnboardingPageProps {
  apiOrigin: string;
}

const choiceClasses =
  "flex min-h-13 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-[border-color,background-color] hover:bg-secondary has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export function AgeAndGoalsOnboardingPage({
  apiOrigin,
}: AgeAndGoalsOnboardingPageProps) {
  const navigate = useNavigate();
  const draft = loadAboutYouDraft();
  const [ageRange, setAgeRange] = useState<LearnerAgeRange | "">(
    draft?.ageRange ?? "",
  );
  const [displayName, setDisplayName] = useState(draft?.displayName ?? "");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
        const currentDraft = loadAboutYouDraft();
        setDisplayName(
          currentDraft?.displayName ?? me.learner.displayName ?? "",
        );
        setAgeRange(currentDraft?.ageRange ?? me.learner.ageRange ?? "");
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

  const formResult = validateAboutYouForm({ ageRange, displayName });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formResult.ok) return;

    saveAboutYouDraft(formResult.selection);
    navigate("/onboarding/goals");
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <section className="pt-2">
          <Progress
            label="Configuração inicial, etapa 2 de 6"
            max={6}
            value={2}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 2 de 6
          </p>
          <h1 className="mb-2">Agora, conte um pouco sobre você</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Essas informações ajudam a preparar aulas adequadas à sua fase de
            vida.
          </p>
        </section>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Surface className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <UserRound aria-hidden="true" size={19} />
              </div>
              <h2>Sobre você</h2>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium" htmlFor="display-name">
                Como quer que eu te chame?
              </label>
              <input
                className="min-h-13 rounded-lg border border-border bg-[var(--input-background)] px-4 py-3 text-foreground"
                disabled={loading}
                id="display-name"
                maxLength={100}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Seu nome ou apelido"
                value={displayName}
              />
            </div>

            <fieldset className="flex flex-col gap-3" disabled={loading}>
              <legend className="mb-1 font-medium">
                Qual é sua faixa etária?
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {learnerAgeRangeOptions.map((option) => (
                  <label className={choiceClasses} key={option.value}>
                    <input
                      checked={ageRange === option.value}
                      className="size-4 accent-[var(--primary)]"
                      name="age-range"
                      onChange={() => setAgeRange(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
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
              Não foi possível carregar seus dados. Tente novamente.
            </p>
          ) : null}

          <Button disabled={loading} size="full" type="submit">
            Continuar
            <ArrowRight aria-hidden="true" size={17} />
          </Button>
        </form>
      </div>
    </main>
  );
}
