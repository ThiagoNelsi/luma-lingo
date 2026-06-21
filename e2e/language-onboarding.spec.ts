import { expect, test } from "@playwright/test";

test("authenticated learner chooses and persists onboarding languages", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { microphoneRequests: number }).microphoneRequests =
      0;
    const stream = { getTracks: () => [{ stop: () => undefined }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          (
            window as unknown as { microphoneRequests: number }
          ).microphoneRequests += 1;
          return stream;
        },
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
  await page.goto("/login");
  await expect(page).toHaveURL(/\/private$/);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/languages$/);
  await expect(
    page.getByRole("heading", { name: "Vamos escolher seus idiomas" }),
  ).toBeVisible();

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
  await expect(
    page.getByRole("heading", { name: "Agora, conte um pouco sobre você" }),
  ).toBeVisible();
  await expect(page.getByLabel("Como quer que eu te chame?")).toHaveValue(
    "Pessoa estudante",
  );

  await page.getByLabel("25–39").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/goals$/);
  await expect(
    page.getByRole("heading", { name: "Quais são seus objetivos?" }),
  ).toBeVisible();
  await page.getByLabel("Alcançar um nível CEFR").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Escolha o nível CEFR que deseja alcançar.",
  );
  await page
    .getByRole("group", { name: "Nível que deseja alcançar" })
    .getByLabel("B2")
    .check();
  await page
    .getByRole("group", { name: "Objetivos adicionais (opcional)" })
    .getByLabel("Viagens")
    .check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/introduction$/);
  await expect(
    page.getByRole("heading", { name: "Conte um pouco sobre você" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Sua gravação não será armazenada/),
  ).toBeVisible();
  await expect(
    page.evaluate(
      () =>
        (window as unknown as { microphoneRequests: number })
          .microphoneRequests,
    ),
  ).resolves.toBe(0);
  await page.getByRole("button", { name: "Gravar apresentação" }).click();
  await expect(
    page.evaluate(
      () =>
        (window as unknown as { microphoneRequests: number })
          .microphoneRequests,
    ),
  ).resolves.toBe(1);
  await page.getByRole("button", { name: "Parar gravação" }).click();
  await page.getByRole("button", { name: "Enviar apresentação" }).click();
  await expect(page).toHaveURL(/\/private$/);
});
