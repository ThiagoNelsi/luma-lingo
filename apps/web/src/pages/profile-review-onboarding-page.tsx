import type {
  ProfileIntroductionProgress,
  ProfileIntroductionStatus,
} from "@luma-lingo/shared";
import {
  AlertCircle,
  ArrowRight,
  LoaderCircle,
  Mic,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import type { MeResponse } from "../auth/me.js";
import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";
import {
  clearProfileIntroductionRecording,
  getProfileIntroductionRecording,
} from "../onboarding/profile-introduction-recording.js";
import {
  startInitialDiagnostic,
  UnauthorizedInitialDiagnosticError,
} from "../onboarding/initial-diagnostic-client.js";
import {
  confirmProfileIntroduction,
  getProfileIntroduction,
  submitProfileIntroduction,
  UnauthorizedProfileIntroductionError,
} from "../onboarding/profile-introduction-client.js";
import {
  createProfileReviewValues,
  type ProfileReviewValues,
  validateProfileReviewForm,
} from "../onboarding/profile-review-form.js";
import {
  completeOnboarding,
  UnauthorizedOnboardingCompletionError,
} from "../onboarding/onboarding-completion-client.js";

interface ProfileReviewOnboardingPageProps {
  apiOrigin: string;
}

const pollingIntervalMs = 1_500;

export function getProfileReviewRedirect(
  me: MeResponse,
  profileIntroductionStatus: ProfileIntroductionStatus,
): string | null {
  if (me.currentLearningTrack?.onboardingStatus === "completed")
    return "/private";
  if (!me.learner.instructionLanguage || !me.currentLearningTrack)
    return "/onboarding/languages";
  if (!me.learner.ageRange) return "/onboarding/about-you";
  if (!me.currentLearningTrack.learningGoal) return "/onboarding/goals";
  if (profileIntroductionStatus === "not_started")
    return "/onboarding/introduction";
  if (!me.currentLearningTrack.lessonEmphases?.length)
    return "/onboarding/preferences";
  if (!me.currentLearningTrack.onboardingStartingPoint)
    return "/onboarding/starting-point";
  return null;
}

export function ProfileReviewOnboardingPage({
  apiOrigin,
}: ProfileReviewOnboardingPageProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProfileIntroductionProgress | null>(
    null,
  );
  const [values, setValues] = useState<ProfileReviewValues>(() =>
    createProfileReviewValues(null),
  );
  const dirtyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [me, nextProgress] = await Promise.all([
          fetchMe(apiOrigin),
          getProfileIntroduction(apiOrigin),
        ]);
        if (!active) return;
        const redirect = getProfileReviewRedirect(me, nextProgress.status);
        if (redirect) {
          navigate(redirect, { replace: true });
          return;
        }
        const learningTrack = me.currentLearningTrack;
        if (!learningTrack) {
          navigate("/onboarding/languages", { replace: true });
          return;
        }
        if (learningTrack.onboardingStartingPoint === "diagnostic") {
          const diagnostic = await startInitialDiagnostic(apiOrigin);
          if (diagnostic.attempt.status !== "completed" || diagnostic.item) {
            navigate("/onboarding/initial-diagnostic", { replace: true });
            return;
          }
        }
        setProgress(nextProgress);
        if (nextProgress.status === "completed")
          clearProfileIntroductionRecording();
        if (!dirtyRef.current && nextProgress.profile)
          setValues(createProfileReviewValues(nextProgress.profile));
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

    void load();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate, reloadToken]);

  useEffect(() => {
    if (!isProcessing(progress?.status)) return;
    const interval = window.setInterval(
      () => setReloadToken((value) => value + 1),
      pollingIntervalMs,
    );
    return () => window.clearInterval(interval);
  }, [progress?.status]);

  const formResult = validateProfileReviewForm(values);
  const recording = getProfileIntroductionRecording();

  function updateValue(field: keyof ProfileReviewValues, value: string) {
    dirtyRef.current = true;
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function retryRecording() {
    if (!recording) return;
    setRetrying(true);
    setSubmitError(null);
    try {
      const nextProgress = await submitProfileIntroduction(
        apiOrigin,
        recording.audio,
        recording.durationMs,
      );
      setProgress(nextProgress);
      dirtyRef.current = false;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        navigate("/login", { replace: true });
        return;
      }
      setSubmitError(
        "Não foi possível reenviar sua gravação. Você pode preencher o perfil manualmente.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formResult.ok) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await confirmProfileIntroduction(apiOrigin, formResult.profile);
      await completeOnboarding(apiOrigin);
      clearProfileIntroductionRecording();
      navigate("/private", { replace: true });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        navigate("/login", { replace: true });
        return;
      }
      setSubmitError("Não foi possível salvar seu perfil. Tente novamente.");
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
            label="Configuração inicial, revisão final"
            max={8}
            value={8}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Revisão final
          </p>
          <h1 className="mb-2">Revise seu perfil</h1>
          <p className="mb-0 max-w-[54ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Vamos usar essas informações para deixar suas aulas mais próximas da
            sua realidade.
          </p>
        </section>

        {loading ? (
          <Surface className="flex items-center gap-3" variant="tinted">
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin text-primary"
              size={20}
            />
            <p className="mb-0 text-muted-foreground">
              Preparando sua revisão…
            </p>
          </Surface>
        ) : null}

        {loadFailed ? (
          <Surface className="flex flex-col gap-4" variant="secondary">
            <p className="mb-0" role="alert">
              Não foi possível carregar seu perfil.
            </p>
            <Button
              onClick={() => {
                setLoadFailed(false);
                setLoading(true);
                setReloadToken((value) => value + 1);
              }}
              variant="outline"
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : null}

        {!loading && !loadFailed ? (
          <form className="flex flex-col gap-5" onSubmit={confirm}>
            <ProcessingNotice status={progress?.status ?? "manual_required"} />

            {(progress?.status === "failed" ||
              progress?.status === "manual_required") &&
            recording ? (
              <Surface className="flex flex-col gap-3" variant="secondary">
                <div className="flex items-start gap-3">
                  <Mic
                    aria-hidden="true"
                    className="mt-0.5 text-primary"
                    size={20}
                  />
                  <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                    Sua gravação ainda está disponível nesta sessão. Você pode
                    reenviá-la sem gravar de novo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={retrying || saving}
                    onClick={() => void retryRecording()}
                    type="button"
                    variant="outline"
                  >
                    {retrying ? "Reenviando…" : "Reenviar gravação"}
                  </Button>
                  <Button
                    disabled={retrying || saving}
                    onClick={() => navigate("/onboarding/introduction")}
                    type="button"
                    variant="ghost"
                  >
                    Gravar outra apresentação
                  </Button>
                </div>
              </Surface>
            ) : null}

            {(progress?.status === "failed" ||
              progress?.status === "manual_required") &&
            !recording ? (
              <Button
                onClick={() => navigate("/onboarding/introduction")}
                type="button"
                variant="outline"
              >
                Gravar uma apresentação
              </Button>
            ) : null}

            <Surface className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <UserRound aria-hidden="true" size={19} />
                </span>
                <div>
                  <h2 className="mb-1">Sobre você</h2>
                  <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                    Corrija o que for necessário ou preencha manualmente.
                  </p>
                </div>
              </div>

              <ProfileField
                error={
                  attempted && !formResult.ok
                    ? formResult.errors.jobOrField
                    : undefined
                }
                label="Área de trabalho ou atuação"
                onChange={(value) => updateValue("jobOrField", value)}
                required
                value={values.jobOrField}
              />
              <ProfileField
                error={
                  attempted && !formResult.ok
                    ? formResult.errors.interests
                    : undefined
                }
                label="Interesses"
                onChange={(value) => updateValue("interests", value)}
                required
                value={values.interests}
              />
              <ProfileField
                error={
                  attempted && !formResult.ok
                    ? formResult.errors.other
                    : undefined
                }
                label="Outras informações"
                onChange={(value) => updateValue("other", value)}
                value={values.other}
              />
              <p className="mb-0 text-[var(--text-caption)] text-muted-foreground">
                Para listas, separe os itens por vírgula.
              </p>
            </Surface>

            {submitError ? (
              <p
                className="mb-0 text-[var(--text-caption)] text-destructive"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}

            <Button disabled={saving} size="full" type="submit">
              {saving ? "Salvando…" : "Confirmar e começar"}
              <ArrowRight aria-hidden="true" size={17} />
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

function ProfileField({
  error,
  hint,
  label,
  onChange,
  required,
  value,
}: {
  error?: string;
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div>
      <label className="mb-1 block font-medium" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      {hint ? (
        <p className="mb-2 text-[var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <input
        aria-invalid={Boolean(error)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? (
        <p
          className="mt-1 mb-0 text-[var(--text-caption)] text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProcessingNotice({ status }: { status: ProfileIntroductionStatus }) {
  if (isProcessing(status))
    return (
      <Surface className="flex items-start gap-3" variant="tinted">
        <LoaderCircle
          aria-hidden="true"
          className="mt-0.5 animate-spin text-primary"
          size={20}
        />
        <p className="mb-0 text-muted-foreground">
          Estamos analisando sua apresentação em segundo plano. Você já pode
          preencher os campos manualmente e continuar quando quiser.
        </p>
      </Surface>
    );
  if (status === "completed")
    return (
      <Surface className="flex items-start gap-3" variant="tinted">
        <UserRound
          aria-hidden="true"
          className="mt-0.5 text-primary"
          size={20}
        />
        <p className="mb-0 text-muted-foreground">
          Recuperamos os detalhes da sua apresentação. Confira antes de começar.
        </p>
      </Surface>
    );
  if (status === "failed")
    return (
      <Surface className="flex items-start gap-3" variant="secondary">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 text-primary"
          size={20}
        />
        <p className="mb-0 text-muted-foreground">
          Não foi possível analisar a gravação. Você pode preencher o perfil
          manualmente.
        </p>
      </Surface>
    );
  return (
    <Surface className="flex items-start gap-3" variant="secondary">
      <UserRound aria-hidden="true" className="mt-0.5 text-primary" size={20} />
      <p className="mb-0 text-muted-foreground">
        Preencha seu perfil para seguirmos com suas primeiras aulas.
      </p>
    </Surface>
  );
}

function isProcessing(status: ProfileIntroductionStatus | undefined): boolean {
  return status === "pending" || status === "processing";
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedSessionError ||
    error instanceof UnauthorizedProfileIntroductionError ||
    error instanceof UnauthorizedInitialDiagnosticError ||
    error instanceof UnauthorizedOnboardingCompletionError
  );
}
