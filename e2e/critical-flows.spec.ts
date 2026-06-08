import { test, expect } from "@playwright/test";

// Each test starts with a fresh context (clean IndexedDB), so numbering is
// deterministic (first doc = INV-0001 / EST-0001).

test("invoice: totals recompute from line items", async ({ page }) => {
  await page.goto("/new");
  const row = page.locator(".li").first();
  await row.getByPlaceholder("Item or service").fill("Consulting");
  await row.getByLabel("Quantity").fill("8");
  await row.getByLabel("Rate").fill("150");
  await page.getByLabel("Tax %").fill("10");

  // preview grand total = 8*150 = 1200 + 10% = 1320
  await expect(page.locator(".pv-tot .r.g .v")).toHaveText(/1,320\.00/);
});

test("status: chip dropdown changes status", async ({ page }) => {
  await page.goto("/new");
  await page.locator(".chip-btn").click();
  await page.locator(".bar-menu .bar-menu-item", { hasText: "Sent" }).click();
  await expect(page.locator(".chip-btn")).toHaveClass(/sent/);
  await expect(page.locator(".chip-btn")).toContainText("Sent");
});

test("color picker: swatch applies a colored header band (clickable, not blocked)", async ({ page }) => {
  await page.goto("/new");
  // no band by default (classic/white)
  await expect(page.locator(".pv-band")).toHaveCount(0);

  await page.locator(".color-trigger").click();
  // this click MUST land on the swatch — if a backdrop covers it, Playwright fails
  await page.locator('.bar-menu .accent-dot[title="#1E4F6B"]').click();

  const band = page.locator(".pv-band");
  await expect(band).toBeVisible();
  await expect(band).toHaveCSS("background-color", "rgb(30, 79, 107)");
  // picking white removes the band again
  await page.locator(".color-trigger").click();
  await page.locator('.bar-menu .accent-dot[title="Classic (no color)"]').click();
  await expect(page.locator(".pv-band")).toHaveCount(0);
});

test("item catalog: add an item, then insert it into a line", async ({ page }) => {
  await page.goto("/new");
  // add via the Saved items modal (name only, rate optional)
  await page.locator(".add-li", { hasText: "Saved items" }).click();
  const modal = page.locator(".modal");
  await modal.getByPlaceholder("e.g. Strategy session").fill("Logo design");
  await modal.locator('input[type="number"]').fill("350");
  await modal.getByRole("button", { name: "Add" }).click();
  await modal.locator(".x").click();

  // insert it via the dropdown
  await page.locator("select.add-saved").selectOption({ index: 1 }); // first saved item
  const firstRow = page.locator(".li").first();
  await expect(firstRow.getByPlaceholder("Item or service")).toHaveValue("Logo design");
  await expect(firstRow.getByLabel("Rate")).toHaveValue("350");
});

test("estimate: EST numbering + convert to invoice", async ({ page }) => {
  await page.goto("/new?type=estimate");
  await expect(page.locator(".pv-inv-no .big")).toContainText("Estimate #EST-");
  // estimate has no pay link even if business has one (none here) — sanity: status set
  await expect(page.locator(".chip-btn")).toBeVisible();

  // add a line so the converted invoice has content, then convert
  await page.locator(".li").first().getByPlaceholder("Item or service").fill("Kitchen reno");
  await page.locator(".app-actions .btn-ghost", { hasText: "More" }).click();
  await page.locator(".bar-menu-item", { hasText: "Convert to invoice" }).click();

  await expect(page).toHaveURL(/\/invoice\?id=/);
  await expect(page.locator(".pv-inv-no .big")).toContainText("Invoice #INV-");
});

test("companies: add two, switch between them, delete one", async ({ page }) => {
  await page.goto("/new");
  const fromSelect = page.getByLabel("From (your company)");

  // add first company
  await fromSelect.selectOption("__new__");
  let modal = page.locator(".modal");
  await modal.getByLabel("Business name").fill("Acme LLC");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".pv-co")).toContainText("Acme LLC");

  // add a second company
  await fromSelect.selectOption("__new__");
  modal = page.locator(".modal");
  await modal.getByLabel("Business name").fill("Beta Studio");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".pv-co")).toContainText("Beta Studio");

  // switch back to the first
  await fromSelect.selectOption({ label: "Acme LLC" });
  await expect(page.locator(".pv-co")).toContainText("Acme LLC");

  // delete the selected company (Acme) via Edit → Delete
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.locator(".modal").getByRole("button", { name: "Delete" }).click();
  // Acme is gone; only Beta remains as an option
  await expect(fromSelect.locator("option", { hasText: "Acme LLC" })).toHaveCount(0);
  await expect(fromSelect.locator("option", { hasText: "Beta Studio" })).toHaveCount(1);
});

test("mobile: no horizontal overflow on editor and list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/new", "/app"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBe(false);
  }
});
