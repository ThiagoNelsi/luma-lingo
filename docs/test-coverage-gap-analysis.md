# Análise de lacunas de cobertura de testes

Data da análise: 2026-07-01.

Escopo analisado:

- `apps/api`
- `apps/web`
- `packages/shared`
- `packages/database`
- `e2e`
- `infra`

Esta análise não implementa nenhum teste. Ela registra os casos faltantes,
prioridades, riscos e o tipo de teste recomendado.

## Estado atual da suíte

Comandos executados:

- `pnpm test`: passou.
- `pnpm test:e2e`: passou com 1 teste Chromium.
- `pnpm --filter <workspace> exec vitest run --coverage --reporter=json`:
  falhou em todos os workspaces porque falta a dependência
  `@vitest/coverage-v8`.

Resultado prático: a codebase tem uma boa base de testes comportamentais, mas
não há métrica instrumentada de linhas, branches, funções ou statements. A
análise abaixo usa cobertura comportamental, leitura estática e comparação de
arquivos de produção com testes pareados.

Inventário aproximado dos arquivos TypeScript/TSX:

- `apps/api/src`: 82 arquivos, 25 arquivos de teste.
- `apps/web/src`: 59 arquivos, 18 arquivos de teste.
- `packages/shared/src`: 13 arquivos, 6 arquivos de teste.
- `packages/database/src`: 4 arquivos, 2 arquivos de teste.
- `e2e`: 2 arquivos, 1 arquivo de teste.

Comparando arquivos de produção com testes pareados em `apps` e `packages`,
107 arquivos de produção foram encontrados, 51 arquivos de teste existem, e 60
arquivos de produção não têm teste pareado direto. Nem todos exigem teste
próprio, pois parte deles contém apenas tipos, interfaces ou reexports.

## Escala de severidade

- **Crítica**: lacuna pode quebrar autenticação, sessão, privacidade,
  persistência essencial, onboarding de produção, ou publicação de evidência de
  aprendizagem.
- **Alta**: lacuna cobre fluxo de usuário principal, integração externa,
  importação de dados, regra de seleção/scoring, ou erro difícil de detectar em
  revisão manual.
- **Média**: lacuna cobre estados de erro, branches, validações, mapeadores,
  páginas com fallback, ou comportamento importante mas recuperável.
- **Baixa**: lacuna cobre wrappers simples, reexports, componentes visuais
  pequenos, ou smoke tests úteis.

## Cobertura existente relevante

Há testes fortes para:

- Contratos compartilhados de idiomas, idade/objetivos, preferências,
  introdução de perfil e perguntas diagnósticas.
- Seleção do diagnóstico inicial em `initial-diagnostic-selector.test.ts`,
  incluindo avanço/regressão de nível, validação final, reparo, limites e
  diversidade.
- Serviço de tentativa diagnóstica e runtime feliz do diagnóstico inicial.
- Scoring básico de múltipla escolha, fill blank, don't know e parte de word
  bank.
- Rotas principais via `http/app.test.ts`, incluindo login, callback, `/me`,
  onboarding, logout e OpenAPI.
- Rotas focadas de introdução de perfil e diagnóstico inicial.
- Repositórios Prisma principais com fakes de Prisma.
- Clientes HTTP de frontend no caminho feliz e 401.
- Um E2E completo do onboarding pelo caminho de diagnóstico curto.

## Lacunas críticas e altas

### COV-001: `AuthService` sem teste unitário direto

Severidade: **Crítica**

Arquivos:

- `apps/api/src/services/auth-service.ts`
- `apps/api/src/sessions/session-token.ts`

Casos faltantes:

- Geração de OAuth state com entropia e formato esperados.
- `validateOAuthState` retorna `false` para valores ausentes, comprimentos
  diferentes e valores diferentes.
- `validateOAuthState` usa comparação segura quando os comprimentos batem.
- `completeLogin` rejeita `emailVerified=false` sem criar usuário ou sessão.
- `completeLogin` cria sessão com hash do token, TTL correto e `lastSeenAt`.
- `resolveSession` retorna `null` sem token e consulta pelo hash quando existe
  token.
- `revokeSession` ignora token ausente e revoga pelo hash quando existe token.
- `hashSessionToken` produz hash estável em `base64url` e não retorna o token
  bruto.

Tipo recomendado: unitário com fakes de `UserRepository` e
`SessionRepository`.

### COV-002: `PrismaSessionRepository` sem testes

Severidade: **Crítica**

Arquivo: `apps/api/src/repositories/prisma-session-repository.ts`

Casos faltantes:

- `create` persiste `userId`, `tokenHash`, `expiresAt` e `lastSeenAt`.
- `findValidByTokenHash` retorna perfil autenticado com learner e learning
  track quando a sessão é válida.
- Sessão inexistente retorna `null`.
- Sessão revogada retorna `null`.
- Sessão expirada no instante `expiresAt <= now` retorna `null`.
- Usuário sem learner retorna `null`.
- `lastSeenAt` é atualizado para `now` no retorno, incluindo o objeto
  retornado.
- Falha no update assíncrono de `lastSeenAt` não quebra a resposta.
- `revokeByTokenHash` só atualiza sessões com `revokedAt: null`.

Tipo recomendado: unitário com fake Prisma e um teste de integração com banco
de teste para constraints de `tokenHash`.

### COV-003: rotas de auth têm cobertura ampla, mas faltam branches focados

Severidade: **Alta**

Arquivo: `apps/api/src/http/routes/auth-routes.ts`

Casos faltantes:

- `/auth/callback` sem `code` retorna `400 missing_oauth_code` e limpa cookie
  de state.
- Cookie de OAuth state é criado com `httpOnly`, `sameSite`, `secure`,
  `maxAge` e path corretos.
- Callback propaga erro inesperado do provider sem criar cookie de sessão.
- Logout continua seguro quando o provider de logout falha.
- Logout limpa cookie com os mesmos atributos usados na criação.

Tipo recomendado: route unit test com Fastify inject e fakes mínimos.

### COV-004: `CognitoAuthProvider` cobre sucesso, mas não falhas

Severidade: **Alta**

Arquivo: `apps/api/src/auth/cognito-auth-provider.ts`

Casos faltantes:

- `getAuthorizationUrl` inclui `client_id`, `response_type=code`, scopes,
  `redirect_uri` e `state`.
- Token endpoint não-OK lança erro útil.
- Resposta sem `access_token` ou sem `id_token` lança erro.
- ID token sem payload ou payload JSON inválido lança
  `cognito_id_token_invalid`.
- ID token sem `sub` ou sem `email` lança
  `cognito_identity_missing_required_claims`.
- `email_verified` em string `"true"` é aceito como booleano.
- `name` ausente retorna `name: null`.

Tipo recomendado: unitário com `fetch` stubado.

### COV-005: runtime do diagnóstico inicial sem testes de erro

Severidade: **Alta**

Arquivo: `apps/api/src/diagnostics/initial-diagnostic-runtime-service.ts`

Casos faltantes:

- Início sem question bank publicado lança
  `initial_diagnostic_question_bank_not_found`.
- Resposta sem tentativa em progresso lança
  `initial_diagnostic_attempt_not_found`.
- Resposta sem item pendente lança
  `initial_diagnostic_pending_item_not_found`.
- Item pendente ausente no question bank lança
  `diagnostic_item_not_found_in_question_bank`.
- Erro de scoring não deve gravar resposta nem completar tentativa.
- `startInitialDiagnostic` retorna `item: null` quando não há seleção inicial,
  sem completar a tentativa indevidamente.
- Retomada com tentativa obsoleta depende do `DiagnosticAttemptService` e deve
  registrar item novo na tentativa nova.

Tipo recomendado: unitário com repositórios em memória já usados no teste
existente.

### COV-006: scorer de word bank cobre pouco os critérios internos

Severidade: **Alta**

Arquivo: `apps/api/src/diagnostics/initial-diagnostic-scorer.ts`

Casos faltantes:

- `fill_blank_choice` com `blankId` incorreto lança
  `diagnostic_response_blank_mismatch`.
- Prompt e scoring rule incompatíveis lançam
  `unsupported_diagnostic_response_format`.
- `no_extra_tokens` aceita só tokens permitidos e falha em token extra.
- `adjacency` exige sequência contígua.
- `token_at_position` usa posição 1-based corretamente.
- `token_before_group` falha quando grupo não aparece e passa quando token vem
  antes de qualquer token do grupo.
- `token_after_group` falha quando grupo não aparece e passa quando token vem
  depois de todos os tokens do grupo.
- Critérios duplicados com o mesmo `mistakeCodeOnFail` geram códigos únicos.
- Scores e confidences são clampados para o intervalo 0..1 e arredondados como
  esperado.
- Resposta `word_bank_sequence` parcial vira `isStrongCorrect=true` quando a
  política permite spread sem sequência exata.

Tipo recomendado: unitário focado em `scoreInitialDiagnosticResponse`.

### COV-007: persistência diagnóstica não roda contra constraints reais

Severidade: **Alta**

Arquivos:

- `apps/api/src/repositories/prisma-diagnostic-attempt-repository.ts`
- `packages/database/prisma/schema.prisma`

Casos faltantes:

- Inserir dois attempt items com mesma posição falha na constraint real.
- Inserir o mesmo diagnostic item duas vezes na mesma tentativa falha na
  constraint real.
- `score` e `confidence` fora de 0..1 falham na constraint real da migration.
- Completar tentativa duas vezes não deve duplicar evidência sem decisão
  explícita.
- Evidências diretas e inferidas usam timestamps e `sourceId` corretos no
  banco real.
- Estado de competência existente incrementa `evidenceCount` e substitui
  `details` como o repositório promete.
- Itens não respondidos ou sem score/confidence não publicam evidência direta.
- JSON inválido ou arrays onde o código espera objeto caem para `{}` sem
  quebrar mapeamento.

Tipo recomendado: integração com Postgres de teste ou branch Neon efêmera.

### COV-008: importador de catálogo de competências sem testes

Severidade: **Alta**

Arquivo: `packages/database/scripts/import-competency-catalog.mjs`

Casos faltantes:

- `parseArgs` aceita defaults e rejeita argumento desconhecido.
- `--transaction-timeout-ms` rejeita zero, negativo e valor não inteiro.
- `assertCatalogShape` rejeita campos obrigatórios ausentes, competências não
  array e `competencyCount` divergente.
- Normalização de idioma e família cobre acentos, maiúsculas e espaços.
- `buildImportPlan` rejeita chave de competência duplicada.
- `buildImportPlan` rejeita pré-requisito desconhecido.
- `buildImportPlan` rejeita prioridade de objetivo desconhecida.
- Status `published` preenche `publishedAt`; status `draft` mantém `null`.
- IDs determinísticos ficam estáveis para catálogo, competências e prioridades.
- `--dry-run` não chama writes no Prisma.
- `writePlan` apaga e recria pré-requisitos e prioridades apenas para
  competências do plano.

Tipo recomendado: extrair funções puras para módulo testável ou testar o script
via processo Node com fixtures temporários.

### COV-009: importador de question bank ainda tem branches sem cobertura

Severidade: **Alta**

Arquivo: `packages/database/src/diagnostic-question-bank-import.ts`

Casos faltantes:

- `readDiagnosticQuestionBankFile` rejeita JSON inválido com erro claro.
- `buildDiagnosticQuestionBankImportPlan` rejeita target language divergente.
- `buildDiagnosticQuestionBankImportPlan` rejeita catalog version divergente.
- Chaves duplicadas de diagnostic item são reportadas de forma ordenada.
- `dryRun` retorna resumo sem chamar upsert, delete, createMany ou update.
- Quando não há targets, `createMany` não é chamado.
- Metadados existentes do catálogo são preservados e recebem
  `diagnosticQuestionBank`.
- `compactJson` remove `undefined` em objetos aninhados e arrays.
- CLI `import-diagnostic-question-bank.ts` valida argumentos e `--help`.

Tipo recomendado: unitário com fakes de transação e fixtures pequenas.

### COV-010: introdução de perfil multipart precisa de matriz negativa

Severidade: **Alta**

Arquivo: `apps/api/src/http/routes/profile-introduction-routes.ts`

Casos faltantes:

- POST sem sessão retorna 401.
- POST com origin não confiável retorna 403.
- POST sem `instructionLanguage` retorna 400.
- POST sem arquivo retorna `invalid_audio_upload`.
- Arquivo vazio retorna `invalid_audio_upload`.
- MIME não permitido retorna `invalid_audio_upload`.
- MIME declarado diferente do MIME real retorna `invalid_audio_upload`.
- `byteSize` declarado diferente do tamanho real retorna
  `invalid_audio_upload`.
- Duração ausente, decimal, zero, negativa, ou não numérica retorna
  `invalid_audio_upload`.
- Upload acima de 12 MB ou erro do parser multipart retorna
  `invalid_audio_upload`.
- Buffer de áudio é zerado em todos os caminhos de rejeição.
- Endpoint manual com origin não confiável retorna 403.

Tipo recomendado: route tests com `app.inject` e FormData.

### COV-011: página de introdução de perfil sem teste de interação

Severidade: **Alta**

Arquivo: `apps/web/src/pages/profile-introduction-onboarding-page.tsx`

Casos faltantes:

- Usuário sem sessão navega para `/login`.
- Usuário sem idiomas navega para `/onboarding/languages`.
- Learner `under_13` chama fallback manual e mostra tela sem gravação.
- Falha em `getUserMedia` mostra erro e mantém opção manual.
- `MediaRecorder` grava chunks, para, cria URL local e mostra player.
- Limite de 90 segundos para automaticamente.
- `recordAgain` limpa áudio, URL e timer.
- Unmount para tracks e revoga object URL.
- Submit com sucesso navega para `/onboarding/preferences`.
- Submit com erro mantém áudio na tela e mostra erro.
- Fallback manual não autorizado deve navegar para `/login`.

Tipo recomendado: teste de componente React com stubs de `MediaRecorder`,
`navigator.mediaDevices`, `URL.createObjectURL` e cliente HTTP.

### COV-012: página do diagnóstico inicial sem teste de interação

Severidade: **Alta**

Arquivo: `apps/web/src/pages/initial-diagnostic-onboarding-page.tsx`

Casos faltantes:

- Todos os redirects de `getInitialDiagnosticRedirect`, incluindo idade ausente,
  objetivo ausente, introdução pendente, preferências ausentes e onboarding
  completo.
- Falha de load mostra estado de erro e botão de retry dispara nova tentativa.
- Resultado inicial já completo chama `completeOnboarding` e navega para
  `/private`.
- Resposta feliz troca para o próximo item e limpa `selectedResponse`.
- Resposta que completa o diagnóstico chama `completeOnboarding`.
- Falha no submit mostra retry e reaproveita `selectedResponse`.
- Clique duplo enquanto `advancing=true` não envia duas respostas.
- Erro 401 de qualquer cliente navega para `/login`.
- Falha de `completeOnboarding` durante load ou submit não deixa tela presa sem
  feedback.

Tipo recomendado: teste de componente com clientes mockados e fake timers.

### COV-013: caminho beginner não está coberto por E2E

Severidade: **Alta**

Arquivos:

- `e2e/language-onboarding.spec.ts`
- `apps/web/src/pages/onboarding-starting-point-page.tsx`
- `apps/api/src/repositories/prisma-onboarding-completion-repository.ts`

Casos faltantes:

- Learner escolhe "Começar do zero" e finaliza onboarding sem diagnóstico.
- API completa beginner path e semeia competências Pre-A1 core.
- Frontend navega para `/private` após `completeOnboarding`.
- Reabrir onboarding completo mantém usuário em `/private`.

Tipo recomendado: E2E adicional e teste de componente da página.

### COV-014: fluxo under-13 e fallback manual sem E2E

Severidade: **Alta**

Arquivos:

- `apps/web/src/pages/profile-introduction-onboarding-page.tsx`
- `apps/api/src/http/routes/profile-introduction-routes.ts`

Casos faltantes:

- Learner menor de 13 anos nunca pede microfone.
- API rejeita upload de áudio para `under_13`.
- Frontend chama fallback manual e segue para preferências.
- E2E garante que nenhuma gravação é solicitada nesse caminho.

Tipo recomendado: E2E com fake API e teste de rota.

### COV-015: provider Gemini sem testes de erro

Severidade: **Alta**

Arquivo: `apps/api/src/profile/gemini-providers.ts`

Casos faltantes:

- `createGeminiGenerate` lança `gemini_request_failed:<status>` em HTTP
  não-OK.
- Resposta sem texto lança `gemini_empty_response`.
- `GeminiTranscriptionProvider` rejeita transcript vazio ou só espaços.
- `GeminiProfileExtractionProvider` rejeita JSON inválido.
- Extração rejeita campos fora do schema, arrays longos demais e strings fora
  do limite.
- Request com `responseJsonSchema` inclui `responseMimeType` e schema no corpo.

Tipo recomendado: unitário com `fetch` e `generate` fake.

## Lacunas médias

### COV-016: configuração runtime cobre só `.env` feliz

Severidade: **Média**

Arquivo: `apps/api/src/config.ts`

Casos faltantes:

- Variável obrigatória ausente lança o nome correto.
- Boolean inválido em `SESSION_COOKIE_SECURE` lança erro.
- Inteiro inválido em `PORT` ou `SESSION_TTL_DAYS` lança erro.
- Valores como `3000abc` não devem ser aceitos se a intenção for inteiro
  estrito.
- Defaults de `NODE_ENV`, cookie name, TTL, porta e modelo Gemini.
- `DOTENV_CONFIG_PATH` tem prioridade sobre busca por `.env`.
- Busca por `.env` retorna `null` quando chega à raiz sem encontrar arquivo.

Tipo recomendado: unitário puro com env isolado.

### COV-017: bootstrap de API sem teste

Severidade: **Média**

Arquivo: `apps/api/src/index.ts`

Casos faltantes:

- `recoverInterrupted` é chamado antes de `listen`.
- `ProfileIntroductionService` agenda jobs com `setImmediate`.
- Repositórios, providers e runtime são compostos com as dependências corretas.
- Erro em config ou DB impede `listen`.

Tipo recomendado: transformar bootstrap em função injetável ou usar teste de
módulo com mocks.

### COV-018: DTOs e mapeadores HTTP sem testes focados

Severidade: **Média**

Arquivos:

- `apps/api/src/http/dtos/me-dto.ts`
- `apps/api/src/http/dtos/initial-diagnostic-dto.ts`
- `apps/api/src/http/dtos/error-dto.ts`

Casos faltantes:

- `toMeDto` converte datas para ISO e preserva `null`.
- `meDtoSchema` rejeita datas não ISO e e-mails inválidos.
- DTO de diagnóstico rejeita posição não positiva e item inválido.
- `errorDtoSchema` rejeita payload sem `error`.

Tipo recomendado: unitário de schema e mapper.

### COV-019: `/health` sem smoke test direto

Severidade: **Média**

Arquivo: `apps/api/src/http/routes/health-routes.ts`

Caso faltante:

- `GET /health` retorna 200 com `{ ok: true }`.

Tipo recomendado: route test com `createApp` ou registrar rota em Fastify.

### COV-020: rotas de onboarding cobertas por `app.test`, mas pouco isoladas

Severidade: **Média**

Arquivo: `apps/api/src/http/routes/onboarding-routes.ts`

Casos faltantes:

- Cada endpoint rejeita origin não confiável independentemente.
- Cada endpoint rejeita sessão ausente independentemente.
- Cada endpoint rejeita body inválido pelo schema correto.
- `completeOnboarding` mapeia cada conflito conhecido para 409.
- Erro desconhecido em `completeOnboarding` é propagado.

Tipo recomendado: route tests focados com fake `AuthService` e
`OnboardingService`.

### COV-021: `OnboardingService` precisa de mais casos de conflito

Severidade: **Média**

Arquivo: `apps/api/src/services/onboarding-service.ts`

Casos faltantes:

- Beginner path sem catálogo publicado propaga
  `published_competency_catalog_required`.
- Diagnostic path usa a tentativa completada mais recente.
- Diagnostic path não aceita tentativa completada para outro purpose.
- Starting point desconhecido ou nulo sempre falha antes de chamar
  repositório de completion.
- Erros de repositório não são engolidos.

Tipo recomendado: unitário com fakes.

### COV-022: `PrismaUserRepository` cobre retorno, mas não criação

Severidade: **Média**

Arquivo: `apps/api/src/repositories/prisma-user-repository.ts`

Casos faltantes:

- Novo login cria `User`, `Learner` e `AuthIdentity` em uma transação.
- `primaryEmail`, `emailVerifiedAt`, `lastLoginAt` e `displayName` são
  preenchidos.
- Login recorrente atualiza `lastSeenAt` e `lastLoginAt`.
- Login recorrente não sobrescreve `auth_identities.email_at_auth_time`.
- Mapeamento retorna learner e current learning track quando existentes.

Tipo recomendado: unitário com fake transaction e integração DB opcional.

### COV-023: `PrismaLearnerRepository` sem testes de erro e idempotência real

Severidade: **Média**

Arquivo: `apps/api/src/repositories/prisma-learner-repository.ts`

Casos faltantes:

- Selecionar o mesmo target language atualiza track existente, não cria outro.
- Selecionar outro target language troca `currentLearningTrackId`.
- Salvar idade/objetivos sem current track falha de forma conhecida.
- `displayName: null` limpa nome persistido.
- `additionalGoals: []`, `studyPace: null` e `lessonEmphases` vazios são
  persistidos conforme contrato.

Tipo recomendado: unidade com fake Prisma e integração DB para unique
constraints.

### COV-024: `PrismaOnboardingCompletionRepository` sem integração real

Severidade: **Média**

Arquivo: `apps/api/src/repositories/prisma-onboarding-completion-repository.ts`

Casos faltantes:

- Catálogo publicado mais recente vence quando há múltiplos catálogos.
- Catálogo sem competências root Pre-A1 completa onboarding sem criar estados.
- Reexecutar beginner path atualiza estados existentes sem duplicar.
- Diagnostic path com `competencyCatalogId` inexistente falha por FK.
- Completion limpa `onboardingStep` e preserva demais campos do track.

Tipo recomendado: integração DB.

### COV-025: `PrismaDiagnosticQuestionBankRepository` precisa de variantes

Severidade: **Média**

Arquivo: `apps/api/src/repositories/prisma-diagnostic-question-bank-repository.ts`

Casos faltantes:

- Seleciona o catálogo publicado mais recente por `publishedAt` e `createdAt`.
- Ignora diagnostic items não publicados.
- Ordena targets com primary antes de supporting e depois por key.
- `weight: null` vira 100.
- `details` não objeto vira `{}`.
- Prerequisites e goal priorities saem ordenados.
- JSON inválido para prompt/scoring/details falha pelo schema.

Tipo recomendado: unitário com fake row e integração DB leve.

### COV-026: `DiagnosticAttemptService` sem testes de validação negativa

Severidade: **Média**

Arquivo: `apps/api/src/diagnostics/diagnostic-attempt-service.ts`

Casos faltantes:

- Inputs inválidos nos schemas de create, record, answer e complete rejeitam
  antes de chamar repositório.
- Janela de retomada em exatamente 48 horas ainda retoma.
- Tentativa iniciada no futuro não cria tentativa nova.
- Erro ao abandonar tentativa obsoleta impede criação da substituta.

Tipo recomendado: unitário.

### COV-027: política diagnóstica sem testes próprios

Severidade: **Média**

Arquivo: `apps/api/src/diagnostics/initial-diagnostic-policy.ts`

Casos faltantes:

- `initialDiagnosticPolicyConfigSchema` rejeita limites negativos ou fora de
  0..1.
- `levelRegressionThreshold` precisa ser negativo.
- `toInitialDiagnosticAttemptDetails` usa defaults quando políticas não são
  fornecidas.
- Versões de selection e scoring são preservadas no details.

Tipo recomendado: unitário.

### COV-028: contratos de perguntas diagnósticas têm lacunas de validação

Severidade: **Média**

Arquivo: `packages/shared/src/diagnostic-question.ts`

Casos faltantes:

- Localização com idioma não suportado falha.
- Localizações vazias falham.
- IDs de opções ou tokens duplicados devem ter decisão explícita e teste.
- `correctOptionIds` que referenciam opção inexistente devem ter decisão
  explícita e teste.
- `correctTokenSequences` que referenciam token inexistente devem ter decisão
  explícita e teste.
- `token_before_group` e `token_after_group` rejeitam grupo ausente.
- `targets` com zero ou múltiplos primary falham.
- `primary_target_must_match_primary_competency` falha quando primary target é
  outro.
- `authoredDiagnosticQuestionBankSchema` permite lista vazia hoje; se isso for
  indesejado, adicionar teste e regra.

Tipo recomendado: unitário de schemas.

### COV-029: clientes HTTP do frontend precisam de matriz de erro

Severidade: **Média**

Arquivos:

- `apps/web/src/auth/me-client.ts`
- `apps/web/src/onboarding/*-client.ts`

Casos faltantes:

- Status 403 e 409 viram erro genérico esperado.
- Status 500 vira erro genérico esperado.
- Resposta 200 com JSON inválido rejeita via schema.
- Resposta 200 sem JSON rejeita de forma previsível.
- Rejeição de rede propaga erro.
- Todos os clients normalizam API origin com barras finais.
- `submitProfileIntroduction` arredonda `durationMs` e envia `mimeType`,
  `byteSize` e filename corretos.

Tipo recomendado: unitário parametrizado por client.

### COV-030: páginas de onboarding sem testes de componente

Severidade: **Média**

Arquivos:

- `apps/web/src/pages/language-onboarding-page.tsx`
- `apps/web/src/pages/age-and-goals-onboarding-page.tsx`
- `apps/web/src/pages/goals-onboarding-page.tsx`
- `apps/web/src/pages/lesson-preferences-onboarding-page.tsx`
- `apps/web/src/pages/study-pace-onboarding-page.tsx`
- `apps/web/src/pages/onboarding-starting-point-page.tsx`

Casos faltantes:

- Estados de loading desabilitam controles.
- Sessão expirada navega para `/login`.
- Onboarding já completo navega para `/private`.
- Pré-requisitos ausentes navegam para a etapa correta.
- Valores existentes do perfil preenchem o formulário.
- Erros de load e save mostram alertas.
- `AgeAndGoalsOnboardingPage` salva draft em sessionStorage.
- `GoalsOnboardingPage` limpa draft depois do save.
- `StudyPaceOnboardingPage` salva `studyPace: null` quando "Ainda não sei".
- `OnboardingStartingPointPage` diferencia beginner e diagnostic path.
- Falha de `completeOnboarding` no beginner path mostra erro e não navega.

Tipo recomendado: testes de componente com router em memória e clientes
mockados.

### COV-031: `DiagnosticQuestionPanel` sem testes DOM completos

Severidade: **Média**

Arquivo: `apps/web/src/onboarding/diagnostic-question.tsx`

Casos faltantes:

- Clique em opção de múltipla escolha envia resposta correta.
- Clique em opção fill blank envia `blankId` correto.
- Botão "Não sei" envia response `dont_know`.
- Word bank adiciona tokens, remove token selecionado, limpa seleção e envia
  sequência.
- Botão "Responder" fica desabilitado com menos de dois tokens.
- `selectedResponse` recebido do pai marca opção ou sequência selecionada.
- Trocar item reseta seleção local de word bank.
- `disabled=true` bloqueia todos os botões.

Tipo recomendado: teste de componente.

### COV-032: `about-you-draft` sem testes

Severidade: **Média**

Arquivo: `apps/web/src/onboarding/about-you-draft.ts`

Casos faltantes:

- `loadAboutYouDraft` retorna `null` sem valor armazenado.
- JSON inválido retorna `null`.
- JSON válido mas fora do schema retorna `null`.
- `saveAboutYouDraft` grava JSON esperado.
- `clearAboutYouDraft` remove a chave.
- Falha de `sessionStorage` indisponível tem decisão explícita e teste.

Tipo recomendado: unitário com fake `sessionStorage`.

### COV-033: `PrivatePage` e rotas principais precisam de mais branches

Severidade: **Média**

Arquivos:

- `apps/web/src/pages/private-page.tsx`
- `apps/web/src/pages/login-redirect-page.tsx`
- `apps/web/src/routes/app-routes.tsx`

Casos faltantes:

- `getNextOnboardingRoute` cobre idade ausente, objetivo ausente, preferences
  ausentes, starting point beginner em progresso e fallback final.
- `PrivatePage` mostra erro quando `fetchMe` falha.
- `PrivatePage` navega para `/login` em 401.
- Form de logout usa `createLogoutAction`.
- `LoginRedirectPage` chama `window.location.replace`.
- Rota desconhecida renderiza `NotFoundPage`.

Tipo recomendado: unitário e componente.

## Lacunas baixas

### COV-034: componentes de design system sem cobertura visual básica

Severidade: **Baixa**

Arquivos:

- `apps/web/src/components/page-header.tsx`
- `apps/web/src/components/theme-toggle.tsx`
- `apps/web/src/design-system/components/surface.tsx`

Casos faltantes:

- Header renderiza marca e ações esperadas.
- Theme toggle alterna atributo/classe esperado, se houver persistência.
- Surface aplica variantes e permite `className`.

Tipo recomendado: componente ou snapshot estrutural pequeno.

### COV-035: reexports sem smoke tests

Severidade: **Baixa**

Arquivos:

- `packages/shared/src/index.ts`
- `packages/database/src/index.ts`
- `apps/web/src/design-system/components/index.ts`

Casos faltantes:

- Pacotes exportam os símbolos públicos esperados.
- Build de consumidor consegue importar entrypoints principais.

Tipo recomendado: smoke test de import ou confiar em `pnpm build`.

## Lacunas E2E

O E2E atual cobre um fluxo feliz completo do login fake até o diagnóstico e
retorno para `/private`. Faltam fluxos ponta a ponta que reduzem risco de
regressão em caminhos alternativos:

- **Alta**: beginner path sem diagnóstico.
- **Alta**: learner `under_13` com fallback manual e sem microfone.
- **Alta**: sessão expirada durante onboarding redireciona para login.
- **Média**: logout limpa sessão e impede acesso posterior a `/private`.
- **Média**: refresh no meio do onboarding retoma etapa correta.
- **Média**: erro de rede/API em save mostra alerta e permite retry.
- **Média**: diagnóstico com mais de uma pergunta, incluindo fill blank, word
  bank e don't know.
- **Baixa**: viewport mobile para formulários longos e diagnóstico.

## Lacunas de infraestrutura

Arquivos:

- `infra/main.tf`
- `infra/cognito.tf`
- `infra/variables.tf`
- `infra/cognito-outputs.tf`

Casos faltantes:

- `terraform fmt -check` e `terraform validate` em CI.
- Validação que `session_cookie_secure` não seja `false` em `prod`.
- Validação que `google_client_id` e `google_client_secret` sejam obrigatórios
  quando `enable_google_idp=true`.
- Validação de formato para `callback_urls`, `logout_urls`,
  `frontend_origin` e `api_origin`.
- Teste/policy que o Cognito app client secret só aparece em output sensível.
- Teste/policy que `deletion_protection` fica `ACTIVE` em produção.
- Teste/policy que scopes OAuth continuam restritos a `openid`, `email` e
  `profile`.

Tipo recomendado: `terraform validate`, `tflint`, `terraform test` ou policy
tests com fixture de plano.

## Lacunas de tooling e CI

Casos faltantes:

- Adicionar `@vitest/coverage-v8` para habilitar coverage instrumentado.
- Definir thresholds por workspace, começando por branches críticos de API.
- Gerar relatório HTML/LCOV em CI.
- Rodar `pnpm check`, `pnpm test`, `pnpm test:e2e` e `pnpm format` em CI.
- Fazer fail do CI quando `apps/api/src/**/*.ts` de comportamento novo entra
  sem teste correspondente ou justificativa.
- Separar coverage de arquivos type-only, DTO-only e reexports para evitar
  metas artificiais.

## Arquivos sem teste pareado que merecem prioridade

Prioridade alta:

- `apps/api/src/services/auth-service.ts`
- `apps/api/src/repositories/prisma-session-repository.ts`
- `apps/api/src/diagnostics/initial-diagnostic-policy.ts`
- `apps/api/src/http/dtos/me-dto.ts`
- `apps/api/src/http/routes/auth-routes.ts`
- `apps/api/src/http/routes/me-routes.ts`
- `apps/api/src/http/routes/onboarding-routes.ts`
- `apps/api/src/http/routes/health-routes.ts`
- `apps/api/src/index.ts`
- `apps/web/src/pages/profile-introduction-onboarding-page.tsx`
- `apps/web/src/pages/initial-diagnostic-onboarding-page.tsx`
- `apps/web/src/pages/onboarding-starting-point-page.tsx`
- `apps/web/src/onboarding/about-you-draft.ts`
- `packages/database/scripts/import-competency-catalog.mjs`
- `packages/database/scripts/import-diagnostic-question-bank.ts`

Prioridade média:

- `apps/api/src/http/dtos/initial-diagnostic-dto.ts`
- `apps/api/src/http/openapi.ts`
- `apps/api/src/repositories/prisma-diagnostic-question-bank-repository.ts`
- `apps/api/src/repositories/prisma-learner-repository.ts`
- `apps/api/src/repositories/prisma-onboarding-completion-repository.ts`
- `apps/api/src/repositories/prisma-user-repository.ts`
- `apps/web/src/pages/language-onboarding-page.tsx`
- `apps/web/src/pages/age-and-goals-onboarding-page.tsx`
- `apps/web/src/pages/goals-onboarding-page.tsx`
- `apps/web/src/pages/lesson-preferences-onboarding-page.tsx`
- `apps/web/src/pages/study-pace-onboarding-page.tsx`
- `apps/web/src/pages/private-page.tsx`
- `apps/web/src/onboarding/diagnostic-question.tsx`

Baixa prioridade ou type-only:

- Interfaces de repositório e provider.
- Tipos de domínio sem lógica.
- Reexports simples.
- `main.tsx`, quando coberto por build.

## Ordem recomendada de implementação futura

1. Cobrir `AuthService` e `PrismaSessionRepository`.
2. Cobrir branches negativos do diagnóstico inicial runtime e scorer.
3. Cobrir matriz multipart de profile introduction.
4. Criar testes de integração de banco para sessões, diagnostic attempts e
   onboarding completion.
5. Cobrir páginas de onboarding principais com testes de componente.
6. Adicionar E2E para beginner path e under-13/manual fallback.
7. Testar importadores de catálogo e question bank.
8. Habilitar coverage instrumentado e thresholds no CI.
9. Adicionar validação de Terraform/IaC.
