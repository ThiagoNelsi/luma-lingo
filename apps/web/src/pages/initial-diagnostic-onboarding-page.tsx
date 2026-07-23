import type {
  DiagnosticQuestionResponse,
  ProfileIntroductionStatus,
} from "@luma-lingo/shared";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import type { MeResponse } from "../auth/me.js";
import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";
import { DiagnosticQuestionPanel } from "../onboarding/diagnostic-question.js";
import {
  type InitialDiagnosticItem,
  type InitialDiagnosticResult,
  startInitialDiagnostic,
  submitInitialDiagnosticResponse,
  UnauthorizedInitialDiagnosticError,
} from "../onboarding/initial-diagnostic-client.js";
import {
  getProfileIntroduction,
  UnauthorizedProfileIntroductionError,
} from "../onboarding/profile-introduction-client.js";

interface InitialDiagnosticOnboardingPageProps {
  apiOrigin: string;
}

const transitionMinimumMs = 150;

export function getInitialDiagnosticRedirect(
  me: MeResponse,
  profileIntroductionStatus: ProfileIntroductionStatus,
): string | null {
  if (me.currentLearningTrack?.onboardingStatus === "completed") {
    return "/private";
  }
  if (!me.learner.instructionLanguage || !me.currentLearningTrack) {
    return "/onboarding/languages";
  }
  if (!me.learner.ageRange) {
    return "/onboarding/about-you";
  }
  if (!me.currentLearningTrack.learningGoal) {
    return "/onboarding/goals";
  }
  if (profileIntroductionStatus === "not_started") {
    return "/onboarding/introduction";
  }
  if (!me.currentLearningTrack.lessonEmphases?.length) {
    return "/onboarding/preferences";
  }
  if (me.currentLearningTrack.onboardingStartingPoint !== "diagnostic") {
    return "/onboarding/starting-point";
  }

  return null;
}

export function InitialDiagnosticOnboardingPage({
  apiOrigin,
}: InitialDiagnosticOnboardingPageProps) {
  const navigate = useNavigate();
  const [instructionLanguage, setInstructionLanguage] = useState<string | null>(
    null,
  );
  const [item, setItem] = useState<InitialDiagnosticItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [selectedResponse, setSelectedResponse] =
    useState<DiagnosticQuestionResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDiagnostic() {
      setLoading(true);
      setLoadFailed(false);
      try {
        const [me, introduction] = await Promise.all([
          fetchMe(apiOrigin),
          getProfileIntroduction(apiOrigin),
        ]);
        if (!active) return;

        const redirect = getInitialDiagnosticRedirect(me, introduction.status);
        if (redirect) {
          navigate(redirect, { replace: true });
          return;
        }

        setInstructionLanguage(me.learner.instructionLanguage ?? null);
        const result = await startInitialDiagnostic(apiOrigin);
        if (!active) return;
        await handleRuntimeResult(result);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          navigate("/login", { replace: true });
          return;
        }
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    async function handleRuntimeResult(result: InitialDiagnosticResult) {
      if (result.attempt.status === "completed" || !result.item) {
        navigate("/onboarding/profile-review", { replace: true });
        return;
      }

      setItem(result.item);
    }

    void loadDiagnostic();
    return () => {
      active = false;
    };
  }, [apiOrigin, loadAttempt, navigate]);

  async function handleAnswer(response: DiagnosticQuestionResponse) {
    if (advancing) return;

    setSelectedResponse(response);
    setSubmitFailed(false);
    setAdvancing(true);
    setStatusText("Preparando a próxima pergunta...");
    const startedAt = Date.now();

    try {
      const result = await submitInitialDiagnosticResponse(apiOrigin, response);
      await waitForMinimumDuration(startedAt, transitionMinimumMs);

      if (result.attempt.status === "completed" || !result.item) {
        setStatusText("Finalizando sua configuração...");
        navigate("/onboarding/profile-review", { replace: true });
        return;
      }

      setItem(result.item);
      setSelectedResponse(null);
      setStatusText("");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        navigate("/login", { replace: true });
        return;
      }

      setSubmitFailed(true);
      setStatusText("");
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-184 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <section className="pt-1">
          <Progress
            label={`Configuração inicial, pergunta ${item?.position ?? 1}`}
            max={8}
            value={item?.position ?? 1}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Pergunta {item?.position ?? 1}
          </p>
          <h1 className="mb-2">Teste inicial</h1>
        </section>

        {loading ? (
          <Surface
            className="flex min-h-72 items-center gap-3"
            variant="tinted"
          >
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin text-primary"
              size={20}
            />
            <p className="mb-0 text-muted-foreground">
              Preparando sua primeira pergunta...
            </p>
          </Surface>
        ) : null}

        {!loading && loadFailed ? (
          <Surface className="flex flex-col gap-4" variant="secondary">
            <div className="flex items-start gap-3">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-destructive"
                size={20}
              />
              <div>
                <h2 className="mb-1">Não foi possível carregar o teste</h2>
                <p className="mb-0 text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
                  Verifique sua conexão e tente novamente.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setLoadAttempt((current) => current + 1)}
              variant="outline"
            >
              Tentar novamente
              <ArrowRight aria-hidden="true" size={17} />
            </Button>
          </Surface>
        ) : null}

        {!loading && item ? (
          <Surface
            className={[
              "flex min-h-[32rem] flex-col gap-5 p-5 transition-[opacity,transform] duration-200 sm:p-6",
              advancing ? "translate-y-0.5 opacity-[0.88]" : "opacity-100",
            ].join(" ")}
          >
            <DiagnosticQuestionPanel
              disabled={advancing}
              instructionLanguage={instructionLanguage}
              item={item}
              onAnswer={(response) => void handleAnswer(response)}
              selectedResponse={selectedResponse}
            />

            <div className="mt-auto border-t border-border pt-4">
              {statusText ? (
                <p
                  className="mb-0 flex items-center gap-2 text-[var(--text-caption)] text-muted-foreground"
                  role="status"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="animate-spin"
                    size={15}
                  />
                  {statusText}
                </p>
              ) : null}

              {submitFailed ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className="mb-0 text-[var(--text-caption)] text-destructive"
                    role="alert"
                  >
                    Não foi possível enviar sua resposta.
                  </p>
                  <Button
                    disabled={!selectedResponse}
                    onClick={() =>
                      selectedResponse
                        ? void handleAnswer(selectedResponse)
                        : undefined
                    }
                    variant="outline"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : null}
            </div>
          </Surface>
        ) : null}
      </div>
    </main>
  );
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedSessionError ||
    error instanceof UnauthorizedInitialDiagnosticError ||
    error instanceof UnauthorizedProfileIntroductionError
  );
}

async function waitForMinimumDuration(
  startedAt: number,
  minimumDurationMs: number,
): Promise<void> {
  const remainingMs = minimumDurationMs - (Date.now() - startedAt);
  if (remainingMs <= 0) return;

  await new Promise((resolve) => setTimeout(resolve, remainingMs));
}
