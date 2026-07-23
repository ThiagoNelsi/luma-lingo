import { ArrowRight, BookOpen, LogOut, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { createLogoutAction } from "../auth/auth-routes.js";
import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import type { MeResponse } from "../auth/me.js";
import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";

interface PrivatePageProps {
  apiOrigin: string;
}

const overlineClasses =
  "mb-2 text-[var(--text-overline)] leading-tight font-semibold tracking-[0.08em] uppercase opacity-72";
const supportingCopyClasses =
  "mb-0 text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground";

export function renderPrivateRouteText(me: MeResponse): string {
  const displayName = me.learner.displayName ?? "learner";
  return `Boas-vindas, ${displayName}!`;
}

export function getNextOnboardingRoute(me: MeResponse): string {
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
  if (me.currentLearningTrack.onboardingStep === "age_and_goals") {
    return "/onboarding/introduction";
  }
  if (!me.currentLearningTrack.lessonEmphases?.length) {
    return "/onboarding/preferences";
  }
  if (!me.currentLearningTrack.onboardingStartingPoint) {
    return "/onboarding/starting-point";
  }
  if (
    me.currentLearningTrack.onboardingStartingPoint === "diagnostic" &&
    me.currentLearningTrack.onboardingStatus === "in_progress"
  ) {
    return "/onboarding/initial-diagnostic";
  }
  return "/onboarding/profile-review";
}

export function PrivatePage({ apiOrigin }: PrivatePageProps) {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const nextMe = await fetchMe(apiOrigin);
        if (active) {
          setMe(nextMe);
        }
      } catch (error) {
        if (error instanceof UnauthorizedSessionError) {
          navigate("/login", { replace: true });
          return;
        }

        if (active) {
          setFailed(true);
        }
      }
    }

    void loadMe();

    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  if (!me) {
    return (
      <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
        <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
          <PageHeader />
          <Surface className="mt-12 flex items-start gap-3" variant="secondary">
            <Sparkles
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
              size={20}
            />
            <div>
              <h1 className="mb-0 text-[var(--text-feature)]">
                {failed
                  ? "Não foi possível carregar seu perfil"
                  : "Preparando seu espaço"}
              </h1>
              <p className={supportingCopyClasses}>
                {failed
                  ? "Atualize a página para tentar novamente."
                  : "Só um instante enquanto buscamos suas preferências."}
              </p>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  const displayName = me.learner.displayName ?? "estudante";

  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <section className="py-2">
          <p className={overlineClasses}>Sua jornada</p>
          <h1 className="mb-1">{renderPrivateRouteText(me)}</h1>
          <p className={supportingCopyClasses}>{me.user.primaryEmail}</p>
        </section>

        <Surface className="flex flex-col gap-4" variant="primary">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={overlineClasses}>Próxima aula</p>
              <h2 className="mb-0 max-w-[18ch]">
                Vamos começar pelo que importa para você
              </h2>
            </div>
            <BookOpen aria-hidden="true" size={22} />
          </div>

          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] opacity-84">
            Uma introdução curta para entender seu nível, interesses e
            objetivos.
          </p>
          <div className="flex justify-between gap-4 text-[var(--text-overline)] font-medium">
            <span>Configuração inicial</span>
            <span>1 de 7</span>
          </div>
          <Progress
            inverted
            label="Configuração inicial, etapa 1 de 7"
            max={7}
            value={1}
          />

          <Button
            onClick={() => navigate(getNextOnboardingRoute(me))}
            size="full"
            variant="emphasis"
          >
            Continuar
            <ArrowRight aria-hidden="true" size={17} />
          </Button>
        </Surface>

        <Surface className="flex items-start gap-3" variant="secondary">
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary"
            size={18}
          />
          <div>
            <h3 className="mb-0">Uma dica para começar, {displayName}</h3>
            <p className={supportingCopyClasses}>
              Escolha suas preferências com sinceridade. Assim, as aulas cabem
              melhor no seu dia.
            </p>
          </div>
        </Surface>

        <Surface variant="tinted">
          <p className={overlineClasses}>Seu progresso</p>
          <h3 className="mb-0">Tudo pronto para sua primeira atividade</h3>
          <p className={supportingCopyClasses}>
            Seu histórico aparecerá aqui após cada aula.
          </p>
        </Surface>

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
