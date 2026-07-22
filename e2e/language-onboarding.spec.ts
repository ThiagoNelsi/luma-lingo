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
  await expect(page).toHaveURL(/\/private$/);
  await page.getByRole("button", { name: "Continuar" }).click();
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
});

async function authenticate(page: Page) {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/private$/);
}

async function seedAuthenticatedLearner(
  request: APIRequestContext,
  state:
    "starting-point" | "profile-introduction" | "profile-introduction-under-13",
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
