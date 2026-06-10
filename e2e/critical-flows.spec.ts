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

  // template picker lives below the invoice preview, bottom-left
  await page.locator('.preview-theme .accent-dot[title="#1E4F6B"]').click();

  const band = page.locator(".pv-band");
  await expect(band).toBeVisible();
  await expect(band).toHaveCSS("background-color", "rgb(30, 79, 107)");
  // picking white removes the band again
  await page.locator('.preview-theme .accent-dot[title="Classic (no color)"]').click();
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

  // delete Acme via the Saved companies manager
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Saved companies/ }).click();
  const mgr = page.locator(".modal", { hasText: "Saved companies" });
  await mgr.locator(".mgr-row", { hasText: "Acme LLC" }).getByLabel("Delete Acme LLC").click();
  await expect(mgr.locator(".mgr-row", { hasText: "Acme LLC" })).toHaveCount(0);
  await expect(mgr.locator(".mgr-row", { hasText: "Beta Studio" })).toHaveCount(1);
});

test("clients: add then delete via Saved clients manager", async ({ page }) => {
  await page.goto("/new");
  // add a client through the picker
  await page.getByLabel("Client").selectOption("__new__");
  const addModal = page.locator(".modal");
  await addModal.getByLabel("Name").fill("Northwind");
  await addModal.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Client").locator("option", { hasText: "Northwind" })).toHaveCount(1);

  // delete it via the Saved clients manager
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Saved clients/ }).click();
  const mgr = page.locator(".modal", { hasText: "Saved clients" });
  await mgr.locator(".mgr-row", { hasText: "Northwind" }).getByLabel("Delete Northwind").click();
  await expect(mgr.locator(".mgr-row", { hasText: "Northwind" })).toHaveCount(0);
});

test("flow 1: new invoice gets a Net-14 due date by default", async ({ page }) => {
  await page.goto("/new");
  const issue = await page.getByLabel("Issue date").inputValue();
  const due = await page.getByLabel("Due date").inputValue();
  expect(due).not.toBe("");
  const days = (Date.parse(due) - Date.parse(issue)) / 86_400_000;
  expect(days).toBe(14);
});

test("flow 4: donate prompt shows once after first send (mailto desktop path)", async ({ page }) => {
  // desktop Chromium has no file-share, so the modal uses the download+mailto path
  await page.addInitScript(() => {
    // stop the mailto navigation from leaving the page
    const orig = Object.getOwnPropertyDescriptor(window.location, "href");
    Object.defineProperty(window.location, "href", { set() {}, get: orig?.get });
  });
  await page.goto("/new");
  // add a business so Send doesn't divert to the company form
  await page.getByLabel("From (your company)").selectOption("__new__");
  await page.locator(".modal").getByLabel("Business name").fill("Acme LLC");
  await page.locator(".modal").getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".modal.wide").getByRole("button", { name: /Download PDF/ }).click();
  await expect(page.locator(".donate-bar")).toBeVisible();
  await page.locator(".donate-bar .donate-x").click();
  await expect(page.locator(".donate-bar")).toHaveCount(0);
});

test("chat-to-invoice: AI draft maps to lines, totals computed in code, uses decrement", async ({ page }) => {
  // stub the AI endpoint (no real API call in CI)
  await page.route("**/api/ai/parse-invoice", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ draft: { currency: "USD", dueInDays: 30, lines: [
        { description: "Consulting", qty: 2, rate: 120 },
        { description: "Setup fee", rate: 500 }, // total deliberately omitted
      ] } }),
    }),
  );
  await page.goto("/new");
  await expect(page.locator(".ai-uses")).toHaveText("10 AI uses left");
  await page.getByLabel("Describe the invoice").fill("2h consulting at $120 and a $500 setup fee, due in 30 days");
  await page.getByRole("button", { name: /Draft it/ }).click();

  // lines mapped + total recomputed in code (2*120 + 500 = 740) — AI never sent a total
  await expect(page.locator(".li").first().getByPlaceholder("Item or service")).toHaveValue("Consulting");
  await expect(page.locator(".pv-tot .r.g .v")).toHaveText(/740\.00/);
  await expect(page.locator(".ai-uses")).toHaveText("9 AI uses left");
});

test("chat-to-invoice: paste a long chat → many line items mapped", async ({ page }) => {
  // The endpoint does the extraction; here we assert the client maps a many-item
  // result from a long multi-line paste and recomputes the total in code.
  let sentText = "";
  await page.route("**/api/ai/parse-invoice", (route) => {
    sentText = (route.request().postDataJSON() as { text: string }).text;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ draft: { currency: "USD", lines: [
      { description: "Discovery call", qty: 1, rate: 0 },        // rate 0 is valid (free item)
      { description: "Brand strategy", qty: 1, rate: 1500 },
      { description: "Logo design", qty: 1, rate: 800 },
      { description: "Consulting hours", qty: 6, rate: 120 },     // qty × rate
      { description: "Revisions", qty: 2, rate: 90 },
    ] } }) });
  });

  await page.goto("/new");
  const chat = [
    "Hey! Thanks for hopping on the call earlier 🙏",
    "So to recap what we agreed:",
    "- discovery call (no charge, on me)",
    "- brand strategy doc — $1,500",
    "- logo design, let's say $800",
    "- you'll need about 6 hours of consulting at $120/hr",
    "- and 2 rounds of revisions at $90 each",
    "Sound good? Can you send the invoice to Acme?",
  ].join("\n");
  await page.getByLabel("Describe the invoice").fill(chat);
  await page.getByRole("button", { name: /Draft it/ }).click();

  // all five items land, in order
  const rows = page.locator(".li");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(1).getByPlaceholder("Item or service")).toHaveValue("Brand strategy");
  await expect(rows.nth(3).getByLabel("Quantity")).toHaveValue("6");
  // total recomputed in code: 0 + 1500 + 800 + 6*120 + 2*90 = 3200
  await expect(page.locator(".pv-tot .r.g .v")).toHaveText(/3,200\.00/);
  // the full multi-line paste was sent (not truncated to a single line)
  expect(sentText).toContain("6 hours of consulting");
});

test("chat-to-invoice: graceful message when AI isn't configured (503)", async ({ page }) => {
  await page.route("**/api/ai/parse-invoice", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"ai_not_configured"}' }));
  await page.goto("/new");
  await page.getByLabel("Describe the invoice").fill("some work for $100");
  await page.getByRole("button", { name: /Draft it/ }).click();
  await expect(page.locator(".ai-error")).toContainText(/isn't switched on/);
  await expect(page.locator(".ai-uses")).toHaveText("10 AI uses left"); // not spent on failure
});

test("translate: labels swap free, free-text AI-translated, cached (no re-bill)", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/ai/translate", async (route) => {
    calls++;
    const body = route.request().postDataJSON() as { strings: string[] };
    const map: Record<string, string> = { Consulting: "Conseil", "Thanks!": "Merci !" };
    const translations = body.strings.map((s) => map[s] ?? `FR:${s}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ translations }) });
  });

  await page.goto("/new");
  await page.locator(".li").first().getByPlaceholder("Item or service").fill("Consulting");
  await page.locator(".li").first().getByLabel("Rate").fill("100");
  await page.getByLabel("Notes / terms").fill("Thanks!");
  await expect(page.locator(".ai-uses")).toHaveText("10 AI uses left");

  // pick French → labels translate instantly, content via the (stubbed) AI
  await page.getByLabel("Invoice language").selectOption("fr");

  await expect(page.locator(".pv-inv-no .big")).toContainText("Facture");
  await expect(page.locator(".pv-tbl tbody tr td").first()).toHaveText("Conseil");
  await expect(page.locator(".pv-tot")).toContainText("Sous-total");
  await expect(page.locator(".ai-uses")).toHaveText("9 AI uses left");
  expect(calls).toBe(1);

  // "Show original" reverts to English labels + original text, no extra bill
  await page.locator(".lang-orig").click();
  await expect(page.locator(".pv-inv-no .big")).toContainText("Invoice");
  await expect(page.locator(".pv-tbl tbody tr td").first()).toHaveText("Consulting");

  // back to French via en → cache hit, still 9, still one call
  await page.locator(".lang-orig").click();
  await page.getByLabel("Invoice language").selectOption("en");
  await page.getByLabel("Invoice language").selectOption("fr");
  await expect(page.locator(".pv-inv-no .big")).toContainText("Facture");
  await expect(page.locator(".ai-uses")).toHaveText("9 AI uses left");
  expect(calls).toBe(1);
});

test("translate: labels-only language switch costs no AI use", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/ai/translate", async (route) => { calls++; await route.fulfill({ status: 200, body: '{"translations":[]}' }); });
  await page.goto("/new");
  await page.getByLabel("Invoice language").selectOption("es");
  await expect(page.locator(".pv-inv-no .big")).toContainText("Factura");
  await expect(page.locator(".ai-uses")).toHaveText("10 AI uses left");
  expect(calls).toBe(0);
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
