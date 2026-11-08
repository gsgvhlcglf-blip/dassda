// Ordinary storefront tests decline optional tracking; consent behavior has its own checks.
export async function dismissCookies(view) {
  await view.locator(".cookie-preferences").waitFor();
  const notice = view.locator(".cookie-notice");
  if (await notice.isVisible())
    await notice.getByRole("button", { name: "Reddet", exact: true }).click();
}
