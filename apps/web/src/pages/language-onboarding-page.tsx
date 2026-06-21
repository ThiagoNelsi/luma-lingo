import { languageOptions, type LanguageCode } from "@luma-lingo/shared";
import { ArrowRight, Languages } from "lucide-react";
import { SubmitEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";
import { getLanguageSelectionError } from "../onboarding/language-form.js";
import {
  saveLanguageSelection,
  UnauthorizedLanguageSelectionError,
} from "../onboarding/language-client.js";

interface LanguageOnboardingPageProps {
  apiOrigin: string;
}

const selectClasses =
  "min-h-13 w-full appearance-none rounded-lg border border-border bg-card px-4 py-3 text-[var(--text-label)] text-foreground transition-[border-color,background-color] hover:bg-secondary focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function LanguageOnboardingPage({
  apiOrigin,
}: LanguageOnboardingPageProps) {
  const navigate = useNavigate();
  const [instructionLanguage, setInstructionLanguage] = useState<
    LanguageCode | ""
  >("");
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

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

        setInstructionLanguage(me.learner.instructionLanguage ?? "");
        setTargetLanguage(me.currentLearningTrack?.targetLanguage ?? "");
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

  const validationError = getLanguageSelectionError(
    instructionLanguage,
    targetLanguage,
  );

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (validationError || !instructionLanguage || !targetLanguage) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveLanguageSelection(apiOrigin, {
        instructionLanguage,
        targetLanguage,
      });
      navigate("/onboarding/about-you");
    } catch (error) {
      if (error instanceof UnauthorizedLanguageSelectionError) {
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
            label="Configuração inicial, etapa 1 de 4"
            max={4}
            value={1}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 1 de 4
          </p>
          <h1 className="mb-2">Vamos escolher seus idiomas</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Isso ajuda o LumaLingo a explicar cada atividade em um idioma que
            você entende e preparar aulas na língua que deseja aprender.
          </p>
        </section>

        <Surface className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <Languages aria-hidden="true" size={19} />
            </div>
            <div>
              <h2 className="mb-1">Conte seu ponto de partida</h2>
              <p className="mb-0 text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
                Você poderá revisar essas preferências depois.
              </p>
            </div>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex gap-2 items-center">
              <label htmlFor="instruction-language" className="min-w-16 font-medium">
                Sei falar
              </label>
              <select
                id="instruction-language"
                className={selectClasses}
                disabled={loading || saving}
                value={instructionLanguage}
                onChange={(event) =>
                  setInstructionLanguage(
                    event.target.value as LanguageCode | "",
                  )
                }
              >
                <option value="">Escolha seu idioma</option>
                {languageOptions.map(({ code, flag, label }) => (
                  <option key={code} value={code}>
                    {flag} {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <label htmlFor="target-language" className="min-w-30 font-medium">
                Quero aprender
              </label>
              <select
                id="target-language"
                className={selectClasses}
                disabled={loading || saving}
                value={targetLanguage}
                onChange={(event) =>
                  setTargetLanguage(event.target.value as LanguageCode | "")
                }
              >
                <option value="">Escolha o idioma da sua jornada</option>
                {languageOptions.map(({ code, flag, label }) => (
                  <option key={code} value={code}>
                    {flag} {label}
                  </option>
                ))}
              </select>
            </div>

            {instructionLanguage && targetLanguage && validationError ? (
              <p
                className="mb-0 text-[var(--text-caption)] text-destructive"
                role="alert"
              >
                {validationError}
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

            <Button
              disabled={Boolean(validationError) || loading || saving}
              size="full"
              type="submit"
            >
              {saving ? "Salvando…" : "Salvar idiomas"}
              {!saving ? <ArrowRight aria-hidden="true" size={17} /> : null}
            </Button>
          </form>
        </Surface>
      </div>
    </main>
  );
}
