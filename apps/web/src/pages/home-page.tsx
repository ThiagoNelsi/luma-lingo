import { BookOpen, LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { createLogoutAction } from "../auth/auth-routes.js";
import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import { PageHeader } from "../components/page-header.js";
import { Button, Surface } from "../design-system/components/index.js";
import {
  fetchHome,
  type HomeResponse,
  fetchLesson,
  type LessonResponse,
  UnauthorizedHomeError,
} from "../home/home-client.js";
import { getNextOnboardingRoute } from "./private-page.js";

interface HomePageProps {
  apiOrigin: string;
}

export function HomePage({ apiOrigin }: HomePageProps) {
  const navigate = useNavigate();
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [visibleBlock, setVisibleBlock] = useState(0);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let pollingTimer: number | undefined;

    async function load() {
      try {
        const me = await fetchMe(apiOrigin);
        if (me.currentLearningTrack?.onboardingStatus !== "completed") {
          navigate(getNextOnboardingRoute(me), { replace: true });
          return;
        }
        const result = await fetchHome(apiOrigin);
        if (!active) return;
        setHome(result);
        if (result.status === "ready") {
          const nextLesson = await fetchLesson(apiOrigin, result.lessonId);
          if (!active) return;
          setLesson(nextLesson);
          setVisibleBlock(0);
        }
        setFailed(false);
        if (result.status === "preparing") {
          pollingTimer = window.setTimeout(() => void load(), 1_500);
        }
      } catch (error) {
        if (
          error instanceof UnauthorizedSessionError ||
          error instanceof UnauthorizedHomeError
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (active) setFailed(true);
      }
    }

    void load();
    return () => {
      active = false;
      if (pollingTimer) window.clearTimeout(pollingTimer);
    };
  }, [apiOrigin, navigate]);

  useEffect(() => {
    if (!waitingForNext || !lesson) return;
    const lessonId = lesson.lessonId;
    let active = true;
    let pollingTimer: number | undefined;

    async function pollForNextBlock() {
      try {
        const updated = await fetchLesson(apiOrigin, lessonId);
        if (!active) return;
        setLesson(updated);
        if (updated.blocks.length > visibleBlock) {
          setWaitingForNext(false);
          return;
        }
        if (updated.nextBlockStatus === "preparing") {
          pollingTimer = window.setTimeout(
            () => void pollForNextBlock(),
            1_500,
          );
        }
      } catch {
        if (active) setWaitingForNext(false);
      }
    }

    void pollForNextBlock();
    return () => {
      active = false;
      if (pollingTimer) window.clearTimeout(pollingTimer);
    };
  }, [apiOrigin, lesson?.lessonId, visibleBlock, waitingForNext]);

  const continueLesson = () => {
    if (!lesson) return;
    const nextPosition = visibleBlock + 1;
    if (nextPosition < lesson.blocks.length) {
      setVisibleBlock(nextPosition);
      return;
    }
    if (lesson.nextBlockStatus === "preparing") setWaitingForNext(true);
  };

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />
        {renderHomeContent(
          home,
          lesson,
          visibleBlock,
          waitingForNext,
          failed,
          continueLesson,
          () => window.location.reload(),
        )}
        <form method="post" action={createLogoutAction(apiOrigin)}>
          <Button size="full" type="submit" variant="outline">
            <LogOut aria-hidden="true" size={17} />
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}

function renderHomeContent(
  home: HomeResponse | null,
  lesson: LessonResponse | null,
  visibleBlock: number,
  waitingForNext: boolean,
  failed: boolean,
  continueLesson: () => void,
  retry: () => void,
) {
  if (failed || home?.status === "failed") {
    return (
      <Surface className="flex flex-col gap-4" variant="secondary">
        <h1 className="mb-0">Não foi possível preparar sua primeira aula</h1>
        <p className="mb-0 text-muted-foreground">
          Atualize a página para tentar novamente.
        </p>
        <Button onClick={retry} variant="outline">
          <RefreshCw aria-hidden="true" size={17} />
          Tentar novamente
        </Button>
      </Surface>
    );
  }
  if (!home || home.status === "preparing" || !lesson) {
    return (
      <Surface className="flex items-start gap-3" variant="secondary">
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin text-primary"
          size={20}
        />
        <div>
          <h1 className="mb-1">Preparando sua primeira aula</h1>
          <p className="mb-0 text-muted-foreground">
            Você poderá começar assim que o primeiro bloco estiver pronto.
          </p>
        </div>
      </Surface>
    );
  }
  const block = lesson.blocks[visibleBlock];
  if (!block) return null;
  return (
    <section className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[var(--text-overline)] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Primeira aula
        </p>
        <h1 className="mb-2">{block.title}</h1>
        <p className="mb-0 text-muted-foreground">{block.objective}</p>
      </div>
      <Surface className="flex flex-col gap-4">
        <BookOpen aria-hidden="true" className="text-primary" size={22} />
        <p className="mb-0 leading-[var(--line-height-relaxed)]">
          {block.explanation}
        </p>
        <div className="flex flex-col gap-2">
          {block.examples.map((example) => (
            <p
              className="mb-0 rounded-lg bg-secondary p-3"
              key={example.target}
            >
              <span className="font-medium">{example.target}</span>
              <span className="block text-[var(--text-caption)] text-muted-foreground">
                {example.instruction}
              </span>
            </p>
          ))}
        </div>
      </Surface>
      <Surface className="flex flex-col gap-4" variant="tinted">
        <h2 className="mb-0">Pratique</h2>
        {block.activities.map((activity, index) => (
          <div
            className="rounded-lg border border-border p-4"
            key={`${activity.type}-${index}`}
          >
            <p className="mb-2 font-medium">{activity.prompt}</p>
            {activity.type === "multiple_choice" ? (
              <div className="flex flex-col gap-2">
                {activity.options.map((option) => (
                  <Button disabled key={option} size="full" variant="outline">
                    {option}
                  </Button>
                ))}
              </div>
            ) : null}
            {activity.type === "fill_blank" ? (
              <input
                aria-label={activity.prompt}
                className="w-full rounded-lg border border-border bg-card p-3"
                disabled
              />
            ) : null}
            {activity.type === "word_order" ? (
              <p className="mb-0 text-muted-foreground">
                {activity.words.join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
      </Surface>
      {lesson.nextBlockStatus !== "complete" &&
      visibleBlock === lesson.blocks.length - 1 ? (
        <Surface className="flex flex-col gap-3" variant="secondary">
          <p className="mb-0 text-muted-foreground">
            {lesson.nextBlockStatus === "failed"
              ? "O próximo bloco não pôde ser preparado. Os blocos concluídos continuam disponíveis."
              : waitingForNext
                ? "Preparando o próximo bloco…"
                : "Quando terminar, continue para o próximo bloco."}
          </p>
          <Button
            disabled={waitingForNext || lesson.nextBlockStatus === "failed"}
            onClick={continueLesson}
            size="full"
          >
            {waitingForNext ? "Preparando…" : "Continuar"}
          </Button>
        </Surface>
      ) : null}
      {visibleBlock < lesson.blocks.length - 1 ? (
        <Button onClick={continueLesson} size="full">
          Continuar
        </Button>
      ) : null}
    </section>
  );
}
