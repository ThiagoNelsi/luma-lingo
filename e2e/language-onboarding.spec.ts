import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3100";

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${apiOrigin}/test-control/reset`);
  expect(response).toBeOK();
});

test("learner resumes onboarding and completes the diagnostic path", async ({
  page,
}) => {
  await installRecordingMock(page);
  await authenticate(page);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/languages$/);

  const instructionLanguage = page.getByLabel("Sei falar");
  const targetLanguage = page.getByLabel("Quero aprender");
  await expect(instructionLanguage.locator("option")).toHaveCount(8);
  await expect(instructionLanguage.locator("option").nth(1)).toHaveText(
    "🇧🇷 Português",
  );

  await instructionLanguage.selectOption("pt");
  await targetLanguage.selectOption("pt");
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha idiomas diferentes.",
  );
  await expect(
    page.getByRole("button", { name: "Salvar idiomas" }),
  ).toBeDisabled();

  await targetLanguage.selectOption("en");
  await page.getByRole("button", { name: "Salvar idiomas" }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);

  await page.goto("/private");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Escolha sua faixa etária.");
  await page.getByLabel("25–39").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/goals$/);

  await page.reload();
  await expect(page).toHaveURL(/\/onboarding\/goals$/);

  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha seu objetivo principal.",
  );
  await page.getByLabel("Alcançar um nível CEFR").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha o nível CEFR que deseja alcançar.",
  );
  await page
    .getByRole("group", { name: "Nível que deseja alcançar" })
    .getByLabel("B2")
    .check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/introduction$/);

  await expect(
    page.getByText(/Sua gravação não será armazenada/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gravar apresentação" }).click();
  await page.getByRole("button", { name: "Parar gravação" }).click();
  await page.getByRole("button", { name: "Enviar apresentação" }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);

  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha pelo menos uma forma de estudar.",
  );
  await page.getByLabel("Ler").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/pace$/);
  await expect(page.getByLabel("Ainda não sei")).toBeChecked();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/starting-point$/);

  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha como quer começar.",
  );
  await page.getByLabel("Fazer um teste rápido").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/initial-diagnostic$/);

  await page.getByRole("button", { name: "Synthetic option A" }).click();
  await expect(
    page.getByRole("button", { name: "Synthetic option C" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Synthetic option C" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Synthetic option C" }).click();
  await expect(page).toHaveURL(/\/onboarding\/profile-review$/);
  await expect(page.getByLabel("Interesses")).toHaveValue("viagens");
  await page.getByLabel("Área de trabalho ou atuação").fill("Professora");
  const completionResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiOrigin}/me/onboarding/complete` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect((await completionResponse).json()).resolves.toMatchObject({
    initialLearningPriority: {
      competencyId: "synthetic-competency-1",
    },
  });
  await expect(page).toHaveURL(/\/private$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("learner completes onboarding directly through the beginner path", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "starting-point");

  await page.goto("/onboarding/starting-point");
  await page.getByLabel("Começar do zero").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/profile-review$/);
  await page.getByLabel("Área de trabalho ou atuação").fill("Estudante");
  await page.getByLabel("Interesses").fill("viagens");
  const completionResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiOrigin}/me/onboarding/complete` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect((await completionResponse).json()).resolves.toMatchObject({
    initialLearningPriority: {
      competencyId: "synthetic-competency-1",
    },
  });
  await expect(page).toHaveURL(/\/private$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("learner can finish manually while the recorded introduction is still processing", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-pending");

  await page.goto("/onboarding/profile-review");
  await expect(
    page.getByText(/analisando sua apresentação em segundo plano/),
  ).toBeVisible();
  await page.getByLabel("Área de trabalho ou atuação").fill("Designer");
  await page.getByLabel("Interesses").fill("cinema");
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("pending extraction fills the final review without overwriting learner edits", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-pending");
  await page.goto("/onboarding/profile-review");

  await request.post(`${apiOrigin}/test-control/profile-introduction`, {
    data: {
      status: "completed",
      profile: {
        jobOrField: "Extraído",
        interests: ["cinema"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      },
    },
  });
  await expect(page.getByLabel("Área de trabalho ou atuação")).toHaveValue(
    "Extraído",
  );
  await expect(page.getByLabel("Interesses")).toHaveValue("cinema");

  await seedAuthenticatedLearner(request, "profile-review-pending");
  await page.goto("/onboarding/profile-review");
  await page.getByLabel("Área de trabalho ou atuação").fill("Manual");
  await request.post(`${apiOrigin}/test-control/profile-introduction`, {
    data: {
      status: "completed",
      profile: {
        jobOrField: "Extraído depois",
        interests: ["viagens"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      },
    },
  });
  await expect(
    page.getByText(/Recuperamos os detalhes da sua apresentação/),
  ).toBeVisible();
  await expect(page.getByLabel("Área de trabalho ou atuação")).toHaveValue(
    "Manual",
  );
});

test("learner cannot bypass an unfinished diagnostic through the final profile route", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-diagnostic");

  await page.goto("/onboarding/profile-review");
  await expect(page).toHaveURL(/\/onboarding\/initial-diagnostic$/);
  await expect(
    page.getByRole("button", { name: "Synthetic option A" }),
  ).toBeVisible();
});

test("learner remains on profile review after a completed diagnostic", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(
    request,
    "profile-review-diagnostic-completed",
  );

  const diagnosticStatus = page.waitForResponse(
    (response) =>
      response.url() === `${apiOrigin}/me/initial-diagnostic/start` &&
      response.request().method() === "POST",
  );
  await page.goto("/onboarding/profile-review");

  await expect((await diagnosticStatus).json()).resolves.toMatchObject({
    attempt: { status: "completed" },
    item: null,
  });
  await expect(
    page.getByRole("heading", { name: "Revise seu perfil" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\/profile-review$/);
});

test("learner can complete the profile manually after extraction fails", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-failed");

  await page.goto("/onboarding/profile-review");
  await expect(
    page.getByText(/Não foi possível analisar a gravação/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gravar uma apresentação" }),
  ).toBeVisible();
  await page.getByLabel("Área de trabalho ou atuação").fill("Analista");
  await page.getByLabel("Interesses").fill("música");
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("a failed extraction after refresh offers a new recording and manual completion", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-failed");
  await page.goto("/onboarding/profile-review");
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Gravar uma apresentação" }),
  ).toBeVisible();
  await page.getByLabel("Área de trabalho ou atuação").fill("Analista");
  await page.getByLabel("Interesses").fill("música");
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("learner keeps the profile details when confirmation or completion temporarily fails", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-review-failed");

  let failConfirmation = true;
  let failCompletion = true;
  await page.route(
    `${apiOrigin}/me/profile-introduction/confirm`,
    async (route) => {
      if (failConfirmation) {
        failConfirmation = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "profile_confirmation_failed" }),
        });
        return;
      }
      await route.continue();
    },
  );
  await page.route(`${apiOrigin}/me/onboarding/complete`, async (route) => {
    if (failCompletion) {
      failCompletion = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "onboarding_completion_failed" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/onboarding/profile-review");
  await page.getByLabel("Área de trabalho ou atuação").fill("Analista");
  await page.getByLabel("Interesses").fill("música");
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Não foi possível salvar seu perfil. Tente novamente.",
  );
  await expect(page.getByLabel("Área de trabalho ou atuação")).toHaveValue(
    "Analista",
  );

  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Não foi possível salvar seu perfil. Tente novamente.",
  );
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

test("learner can continue without audio after microphone access is denied", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-introduction");

  await page.goto("/onboarding/introduction");
  await page.getByRole("button", { name: "Gravar apresentação" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    /Não foi possível acessar o microfone/,
  );
  await page.getByRole("button", { name: "Continuar sem áudio" }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);
});

test("learner can retry sending a recorded introduction", async ({
  page,
  request,
}) => {
  await installRecordingMock(page);
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-introduction");

  let failFirstSubmission = true;
  await page.route(`${apiOrigin}/me/profile-introduction`, async (route) => {
    if (route.request().method() === "POST" && failFirstSubmission) {
      failFirstSubmission = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "profile_introduction_failed" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/onboarding/introduction");
  await page.getByRole("button", { name: "Gravar apresentação" }).click();
  await page.getByRole("button", { name: "Parar gravação" }).click();
  await page.getByRole("button", { name: "Enviar apresentação" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    /Não foi possível enviar sua introdução/,
  );
  await expect(
    page.getByRole("button", { name: "Enviar apresentação" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enviar apresentação" }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);
});

test("learner under 13 is sent through the manual introduction path", async ({
  page,
  request,
}) => {
  await authenticate(page);
  await seedAuthenticatedLearner(request, "profile-introduction-under-13");

  await page.goto("/onboarding/introduction");
  await expect(
    page.getByRole("heading", { name: "Vamos continuar sem gravação" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gravar apresentação" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);
  await page.getByLabel("Ler").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await page.getByLabel("Começar do zero").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/profile-review$/);
  await page.getByLabel("Área de trabalho ou atuação").fill("Estudante");
  await page.getByLabel("Interesses").fill("desenho");
  await page.getByRole("button", { name: "Confirmar e começar" }).click();
  await expect(page).toHaveURL(/\/private$/);
});

async function authenticate(page: Page) {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/private$/);
}

async function seedAuthenticatedLearner(
  request: APIRequestContext,
  state:
    | "starting-point"
    | "profile-introduction"
    | "profile-introduction-under-13"
    | "profile-review-pending"
    | "profile-review-failed"
    | "profile-review-diagnostic"
    | "profile-review-diagnostic-completed",
) {
  const response = await request.post(`${apiOrigin}/test-control/seed`, {
    data: { state },
  });
  expect(response).toBeOK();
}

async function installRecordingMock(page: Page) {
  await page.addInitScript(() => {
    const stream = { getTracks: () => [{ stop: () => undefined }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type.startsWith("audio/webm");
      }
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["fake-audio"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
  });
}
