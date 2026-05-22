import { expect, test } from "@playwright/test";

test("home page supports filtering and Google Maps route selection", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTitle("AsobiPlan")).toBeVisible();
  await expect(page.getByRole("button", { name: "상세 필터 설정" }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: /추천 장소|검색 결과/ })).toBeVisible();

  const search = page.getByPlaceholder(/고토구에서 어디로 가볼까요|장소, 주소, 키워드 검색/).first();
  await search.fill("로얄");
  const royalHostHeader = page.getByRole("heading", { name: /로얄 호스트/ }).first();
  await expect(royalHostHeader).toBeVisible();
  await royalHostHeader.click();

  await page.getByRole("button", { name: /^출발$/ }).first().click();
  await page.getByRole("button", { name: /^도착$/ }).first().click();

  const googleMapsLink = page.getByRole("link", { name: /Google Maps에서/ });
  await expect(googleMapsLink).toBeVisible();
  await expect(googleMapsLink).toHaveAttribute("href", /google\.com\/maps\/dir/);
});

test("current location can be used as start without hiding destination places", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6812, longitude: 139.7671 });
  await page.goto("/");

  await page.getByRole("button", { name: "현재 위치를 출발지로", exact: true }).click();
  await expect(page.getByText(/35\.6812, 139\.7671/).first()).toBeVisible();
  const royalHostCard = page.getByRole("heading", { name: /로얄 호스트/ }).first();
  await expect(royalHostCard).toBeVisible();
  await royalHostCard.click();

  await page.getByRole("button", { name: /^도착$/ }).first().click();
  const googleMapsLink = page.getByRole("link", { name: /Google Maps에서/ });
  await expect(googleMapsLink).toBeVisible();
  await expect(googleMapsLink).toHaveAttribute("href", /origin=35\.6812%2C139\.7671/);
});
