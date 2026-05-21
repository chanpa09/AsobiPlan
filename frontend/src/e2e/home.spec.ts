import { expect, test } from "@playwright/test";

test("home page shows the route planning shell", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AsobiPlan" })).toBeVisible();
  await expect(page.getByText("Koto-ku Stroller Route")).toBeVisible();
  await expect(page.getByRole("button", { name: /상세 필터 설정/ })).toBeVisible();
});
