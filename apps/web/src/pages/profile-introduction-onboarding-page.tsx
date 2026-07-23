import { LockKeyhole, Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import { PageHeader } from "../components/page-header.js";
import { RecordingWaveform } from "../components/recording-waveform.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";
import {
  clearProfileIntroductionRecording,
  getProfileIntroductionRecording,
  saveProfileIntroductionRecording,
} from "../onboarding/profile-introduction-recording.js";
import {
  submitProfileIntroduction,
  UnauthorizedProfileIntroductionError,
  useManualProfileIntroduction,
} from "../onboarding/profile-introduction-client.js";
import {
  formatRecordingTime,
  preferredRecordingMimeType,
} from "../onboarding/recording.js";

interface ProfileIntroductionOnboardingPageProps {
  apiOrigin: string;
}
type RecordingPhase = "idle" | "recording" | "ready" | "submitting";
const maximumDurationMs = 90_000;

export function ProfileIntroductionOnboardingPage({
  apiOrigin,
}: ProfileIntroductionOnboardingPageProps) {
  const navigate = useNavigate();
  const savedRecording = getProfileIntroductionRecording();
  const [phase, setPhase] = useState<RecordingPhase>(
    savedRecording ? "ready" : "idle",
  );
  const [elapsedMs, setElapsedMs] = useState(savedRecording?.durationMs ?? 0);
  const [audio, setAudio] = useState<Blob | null>(
    savedRecording?.audio ?? null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [instructionLanguage, setInstructionLanguage] = useState("");
  const [manualOnly, setManualOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = await fetchMe(apiOrigin);
        if (!active) return;
        if (!me.learner.instructionLanguage || !me.currentLearningTrack) {
          navigate("/onboarding/languages", { replace: true });
          return;
        }
        setInstructionLanguage(me.learner.instructionLanguage);
        if (me.learner.ageRange === "under_13") {
          await useManualProfileIntroduction(apiOrigin);
          if (active) setManualOnly(true);
        }
      } catch (caught) {
        if (
          caught instanceof UnauthorizedSessionError ||
          caught instanceof UnauthorizedProfileIntroductionError
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (active)
          setError("Não foi possível preparar esta etapa. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(Math.min(elapsed, maximumDurationMs));
      if (elapsed >= maximumDurationMs) recorderRef.current?.stop();
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!audio) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredRecordingMimeType(
        MediaRecorder.isTypeSupported,
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = Math.min(
          Date.now() - startedAtRef.current,
          maximumDurationMs,
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        setElapsedMs(duration);
        setAudio(blob);
        saveProfileIntroductionRecording({ audio: blob, durationMs: duration });
        setPhase("ready");
      };
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setAudio(null);
      recorder.start(250);
      setPhase("recording");
    } catch {
      setError(
        "Não foi possível acessar o microfone. Você pode tentar novamente ou continuar sem áudio.",
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function recordAgain() {
    clearProfileIntroductionRecording();
    setAudio(null);
    setElapsedMs(0);
    setPhase("idle");
  }

  async function submitRecording() {
    if (!audio) return;
    setPhase("submitting");
    setError(null);
    try {
      saveProfileIntroductionRecording({ audio, durationMs: elapsedMs });
      await submitProfileIntroduction(apiOrigin, audio, elapsedMs);
      navigate("/onboarding/preferences");
    } catch (caught) {
      if (caught instanceof UnauthorizedProfileIntroductionError) {
        navigate("/login", { replace: true });
        return;
      }
      setPhase("ready");
      setError(
        "Não foi possível enviar sua introdução. O áudio continua somente nesta tela para você tentar novamente.",
      );
    }
  }

  async function chooseManualFallback() {
    try {
      await useManualProfileIntroduction(apiOrigin);
      clearProfileIntroductionRecording();
      navigate("/onboarding/preferences");
    } catch {
      setError("Não foi possível continuar agora. Tente novamente.");
    }
  }

  if (manualOnly) {
    return (
      <main className="min-h-dvh px-[var(--screen-gutter)] pb-10">
        <div className="mx-auto flex w-full max-w-176 flex-col gap-5">
          <PageHeader />
          <Progress
            label="Configuração inicial, etapa 4 de 7"
            max={7}
            value={4}
          />
          <Surface className="flex flex-col gap-4">
            <h1>Vamos continuar sem gravação</h1>
            <p className="mb-0 text-muted-foreground">
              Para esta faixa etária, a apresentação será preenchida manualmente
              em uma próxima etapa.
            </p>
            <Button
              size="full"
              onClick={() => navigate("/onboarding/preferences")}
            >
              Continuar
            </Button>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />
        <section className="pt-2">
          <Progress
            label="Configuração inicial, etapa 4 de 7"
            max={7}
            value={4}
          />
          <p className="mt-3 mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Etapa 4 de 7
          </p>
          <h1 className="mb-2">Conte um pouco sobre você</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] text-muted-foreground">
            Uma rápida apresentação nos ajuda a criar lições mais relevantes
            para você.
          </p>
        </section>
        <Surface className="flex flex-col gap-5">
          <div>
            <p className="mb-4 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              O que falar na apresentação?
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Sua área de trabalho",
                "Hobbies",
                "Seus interesses",
                "Sua rotina",
                "Como costuma estudar",
              ].map((prompt) => (
                <span
                  className="rounded-full border border-border bg-muted px-3 py-1.5 text-[var(--text-caption)]"
                  key={prompt}
                >
                  {prompt}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 py-3">
            <RecordingWaveform recording={phase === "recording"} />
            <p className="mb-0 font-mono text-[var(--text-caption)] tabular-nums">
              <span
                className={
                  phase === "recording" ? "font-semibold text-accent" : ""
                }
              >
                {formatRecordingTime(elapsedMs)}
              </span>{" "}
              / 01:30
            </p>
            {phase === "recording" ? (
              <Button
                aria-label="Parar gravação"
                className="size-19 min-h-19 rounded-full shadow-md"
                onClick={stopRecording}
                size="icon"
                variant="accent"
              >
                <Square aria-hidden="true" size={25} />
              </Button>
            ) : (
              <Button
                aria-label="Iniciar gravação"
                className="size-19 min-h-19 rounded-full shadow-md"
                disabled={loading || phase === "submitting"}
                onClick={() => void startRecording()}
                size="icon"
              >
                <Mic aria-hidden="true" size={27} />
              </Button>
            )}
          </div>
          {audioUrl ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
              <Volume2 aria-hidden="true" size={17} />
              <audio className="h-10 w-full" controls src={audioUrl}>
                Seu navegador não suporta reprodução de áudio.
              </audio>
            </div>
          ) : null}
          {error ? (
            <p
              className="mb-0 text-[var(--text-caption)] text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {phase === "ready" || phase === "submitting" ? (
            <>
              <Button
                disabled={phase === "submitting"}
                onClick={() => void submitRecording()}
                size="full"
              >
                {phase === "submitting" ? "Enviando…" : "Enviar apresentação"}
              </Button>
              <Button
                disabled={phase === "submitting"}
                onClick={recordAgain}
                size="full"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" size={16} />
                Gravar novamente
              </Button>
            </>
          ) : phase === "idle" ? (
            <Button
              disabled={loading}
              onClick={() => void startRecording()}
              size="full"
            >
              Gravar apresentação
            </Button>
          ) : null}
          <Button
            disabled={phase === "recording" || phase === "submitting"}
            onClick={() => void chooseManualFallback()}
            size="full"
            variant="ghost"
          >
            Continuar sem áudio
          </Button>
          <div className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3.5 text-xs">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
              size={16}
            />
            <p className="mb-0 text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground">
              Sua gravação não será armazenada, apenas extraímos informações
              para personalizar sua experiência.
            </p>
          </div>
        </Surface>
      </div>
    </main>
  );
}
