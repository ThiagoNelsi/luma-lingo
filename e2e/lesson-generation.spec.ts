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

test("learner waits for and reveals incrementally generated blocks in plan order", async ({
  page,
  request,
}) => {
  await authenticateCompletedLearner(page, request);
  await page.goto("/home");

  await expect(
    page.getByRole("heading", { name: "Your first greeting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Preparando o próximo bloco…")).toBeVisible();

  await updateLessonGeneration(request, {
    approvedBlockPositions: [0, 2],
  });
  await waitForLessonPoll(page);
  await expect(
    page.getByRole("heading", { name: "Put the greeting together" }),
  ).not.toBeVisible();
  await expect(page.getByText("Preparando o próximo bloco…")).toBeVisible();

  await updateLessonGeneration(request, {
    approvedBlockPositions: [0, 1, 2],
  });
  await waitForLessonPoll(page);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Introduce yourself" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Put the greeting together" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar" }),
  ).not.toBeVisible();
});

test("learner recovers generated blocks after leaving and returning to the Lesson", async ({
  page,
  request,
}) => {
  await authenticateCompletedLearner(page, request);
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Your first greeting" }),
  ).toBeVisible();

  await updateLessonGeneration(request, {
    approvedBlockPositions: [0, 1],
  });
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Your first greeting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Introduce yourself" }),
  ).toBeVisible();
});

test("learner keeps approved blocks accessible after a later block fails", async ({
  page,
  request,
}) => {
  await authenticateCompletedLearner(page, request);
  await updateLessonGeneration(request, {
    approvedBlockPositions: [0, 1],
    failed: true,
  });
  await page.goto("/home");

  await expect(
    page.getByRole("heading", { name: "Your first greeting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Introduce yourself" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "O próximo bloco não pôde ser preparado. Os blocos concluídos continuam disponíveis.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();

  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(
    page.getByRole("heading", { name: "Your first greeting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Introduce yourself" }),
  ).toBeVisible();
});

async function authenticateCompletedLearner(
  page: Page,
  request: APIRequestContext,
) {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding\/languages$/);
  const response = await request.post(`${apiOrigin}/test-control/seed`, {
    data: { state: "lesson-ready" },
  });
  expect(response).toBeOK();
}

async function updateLessonGeneration(
  request: APIRequestContext,
  state: {
    approvedBlockPositions: number[];
    failed?: boolean;
  },
) {
  const response = await request.post(`${apiOrigin}/test-control/lesson`, {
    data: state,
  });
  expect(response).toBeOK();
}

async function waitForLessonPoll(page: Page) {
  await page.waitForResponse(
    (response) =>
      response.url().includes("/me/lessons/") &&
      response.request().method() === "GET",
  );
}
