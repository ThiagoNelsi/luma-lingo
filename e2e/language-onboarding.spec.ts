import { expect, test } from "@playwright/test";

test("authenticated learner chooses and persists onboarding languages", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/private$/);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding\/languages$/);
  await expect(
    page.getByRole("heading", { name: "Vamos escolher seus idiomas" }),
  ).toBeVisible();

  const instructionLanguage = page.getByLabel("Eu falo");
  const targetLanguage = page.getByLabel("E quero aprender");
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
  await page
    .getByRole("group", { name: "Objetivo principal" })
    .getByLabel("Alcançar um nível CEFR")
    .check();
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
  await expect(page.getByRole("status")).toHaveText(
    "Idade e objetivos salvos.",
  );

  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Objetivo principal" })
      .getByLabel("Alcançar um nível CEFR"),
  ).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "Nível que deseja alcançar" })
      .getByLabel("B2"),
  ).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "Objetivos adicionais (opcional)" })
      .getByLabel("Viagens"),
  ).toBeChecked();
});
