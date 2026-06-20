import { ArrowRight, MessageCircle, Sparkles, Target } from "lucide-react";

import { PageHeader } from "../components/page-header.js";
import {
  Button,
  Progress,
  Surface,
} from "../design-system/components/index.js";

const overlineClasses =
  "mb-2 text-[var(--text-overline)] leading-tight font-semibold tracking-[0.08em] uppercase opacity-72";
const supportingCopyClasses =
  "mb-0 text-[var(--text-caption)] leading-[var(--line-height-relaxed)] text-muted-foreground";

export function renderPublicRouteText(): string {
  return "Aulas de idiomas personalizadas para seus objetivos, interesses e ritmo.";
}

export function PublicPage() {
  return (
    <main className="min-h-dvh px-[var(--screen-gutter)] pb-10 sm:pb-12">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-[var(--content-gap)]">
        <PageHeader />

        <Surface className="flex flex-col gap-4" variant="primary">
          <p className={overlineClasses}>Aprendizado personalizado</p>
          <h1 className="mb-0 max-w-[18ch]">Seu idioma, no seu ritmo.</h1>
          <p className="mb-0 max-w-[48ch] leading-[var(--line-height-relaxed)] opacity-84">
            {renderPublicRouteText()}
          </p>

          <div className="grid gap-2">
            <div className="flex justify-between gap-4 text-[var(--text-overline)] font-medium">
              <span>Uma jornada feita para você</span>
              <span>Comece agora</span>
            </div>
            <Progress
              inverted
              label="Apresentação da jornada de aprendizado"
              value={35}
            />
          </div>

          <form action="/login">
            <Button size="full" type="submit" variant="emphasis">
              Começar
              <ArrowRight aria-hidden="true" size={17} />
            </Button>
          </form>
        </Surface>

        <section className="grid gap-4" aria-labelledby="how-it-works">
          <div>
            <p className={overlineClasses}>Como funciona</p>
            <h2 className="mb-0" id="how-it-works">
              Prática útil desde a primeira aula
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Surface className="grid content-start gap-2">
              <Target aria-hidden="true" className="text-primary" size={20} />
              <h3 className="mb-0">Foco nos seus objetivos</h3>
              <p className={supportingCopyClasses}>
                Conte o que deseja aprender e receba aulas alinhadas à sua
                rotina.
              </p>
            </Surface>
            <Surface className="grid content-start gap-2" variant="secondary">
              <MessageCircle
                aria-hidden="true"
                className="text-primary"
                size={20}
              />
              <h3 className="mb-0">Orientação clara</h3>
              <p className={supportingCopyClasses}>
                Pratique com explicações diretas e feedback que ajuda você a
                avançar.
              </p>
            </Surface>
          </div>
        </section>

        <Surface className="flex items-start gap-3" variant="tinted">
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary"
            size={18}
          />
          <p className={supportingCopyClasses}>
            Comece com poucos minutos. O LumaLingo adapta as próximas aulas ao
            seu progresso.
          </p>
        </Surface>

        <Button disabled size="full" variant="tinted">
          Aplicativo para celular em breve
        </Button>
      </div>
    </main>
  );
}
