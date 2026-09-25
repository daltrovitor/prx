// Hello World
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:3100";
const VIEWPORTS = [
  { name: "se-375", width: 375, height: 667 },
  { name: "iphone-390", width: 390, height: 844 },
  { name: "compact-320", width: 320, height: 568 },
  { name: "android-412", width: 412, height: 915 },
];

fs.mkdirSync("test-results/mobile", { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const consoleMessages = [];

  console.log("Starting Mobile Responsiveness & Zero Console Audit...");

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
    });

    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("prx_intro_seen", "true");
      } catch {}
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      consoleMessages.push(`[${vp.name}] ${msg.type()}: ${msg.text()}`);
    });

    // 1. Autentica como membro demo via API
    const loginRes = await context.request.post(`${BASE}/api/auth/login`, {
      data: { email: "membro@prx.dev", password: "Prx2026!", rememberMe: true },
    });

    if (!loginRes.ok()) {
      throw new Error(`Falha no login da API: ${loginRes.status()}`);
    }

    // 2. Acessa app logado
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");

    // Verifica se intro preloader está ativo ou conclui
    const loader = page.locator(".prx-loader");
    if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
      await loader.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    }

    // Aguarda o app principal carregar
    await page.waitForSelector(".prx-app", { timeout: 15000 });

    const tabs = [
      { key: "home", label: "Início" },
      { key: "pass", label: "Pass" },
      { key: "bank", label: "Bank" },
      { key: "live", label: "Live" },
      { key: "profile", label: "Perfil" },
    ];

    for (const tab of tabs) {
      // Clica na aba da barra inferior mobile
      const bottomNav = page.locator('nav.fixed[aria-label="Seções do app"]');
      const tabButton = bottomNav.getByRole("button", { name: tab.label, exact: true });

      if (await tabButton.isVisible()) {
        await tabButton.click({ force: true });
        await page.waitForTimeout(600);
      }

      // Checa overflow horizontal
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);

      const pass = !hasOverflow;
      results.push({
        viewport: vp.name,
        tab: tab.key,
        pass,
        scrollWidth,
        innerWidth,
      });

      // Screenshot da tela em light
      await page.screenshot({
        path: `test-results/mobile/${vp.name}-${tab.key}-light.png`,
        fullPage: false,
      });

      // Alterna para dark mode no mobile header se for o primeiro tab
      if (tab.key === "home") {
        const themeBtn = page.locator("header button").filter({ has: page.locator("svg") }).first();
        if (await themeBtn.isVisible()) {
          await themeBtn.click();
          await page.waitForTimeout(400);
          await page.screenshot({
            path: `test-results/mobile/${vp.name}-home-dark.png`,
            fullPage: false,
          });
          // Volta para o tema claro
          await themeBtn.click();
          await page.waitForTimeout(400);
        }
      }
    }

    // Testa abertura e responsividade de modal Sheet no mobile
    const bankTab = page.locator('nav.fixed[aria-label="Seções do app"]').getByRole("button", { name: "Bank", exact: true });
    await bankTab.click();
    await page.waitForTimeout(500);

    const pixBtn = page.getByRole("button", { name: "Enviar Pix" }).first();
    if (await pixBtn.isVisible()) {
      await pixBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `test-results/mobile/${vp.name}-bank-pix-sheet.png`,
      });
      // Fecha a Sheet pelo botão fechar
      const closeBtn = page.getByRole("button", { name: "Fechar" }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    await context.close();
  }

  await browser.close();

  console.log("\n--- RESULTADOS DE RESPONSIVIDADE MOBILE ---");
  let allPassed = true;
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    if (!r.pass) allPassed = false;
    console.log(`[${status}] ${r.viewport} | Tab: ${r.tab} | Width: ${r.innerWidth}px, Content: ${r.scrollWidth}px`);
  }

  console.log("\n--- AUDITORIA DE CONSOLE DEVTOOLS ---");
  console.log(`Mensagens capturadas no console do navegador: ${consoleMessages.length}`);
  if (consoleMessages.length > 0) {
    console.log(consoleMessages.slice(0, 10).join("\n"));
  } else {
    console.log("[PASS] Zero logs, advertências ou erros no console do navegador!");
  }

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
