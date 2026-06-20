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
  await expect(
    page.getByRole("heading", { name: "Sua jornada já tem uma direção" }),
  ).toBeVisible();
  await expect(
    page.getByText("Eu falo Português e quero aprender Inglês"),
  ).toBeVisible();

  await page.reload();
  await expect(instructionLanguage).toHaveValue("pt");
  await expect(targetLanguage).toHaveValue("en");
});
