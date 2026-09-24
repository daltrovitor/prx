import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  const outDir = path.join(process.cwd(), "public", "screenshots", "admin");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Test visiting /admin as normal user (Rafael Molina, role = 'user')
  const userContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const userPage = await userContext.newPage();
  
  // Login as normal user
  await userPage.goto("http://localhost:3000");
  await userPage.evaluate(async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rafael.molina@prx.app", password: "Prx2026!" }),
    });
  });

  // Navigate to /admin
  await userPage.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await userPage.waitForTimeout(500);
  await userPage.screenshot({ path: path.join(outDir, "01_user_blocked_403.png") });
  console.log("📸 Captured 01_user_blocked_403.png");

  // 2. Test visiting /admin as admin (admin@ashens.store, role = 'admin')
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();

  // Login as admin
  await adminPage.goto("http://localhost:3000");
  await adminPage.evaluate(async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@ashens.store", password: "AdminPrx2026!" }),
    });
  });

  // Navigate to /admin
  await adminPage.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(600);
  await adminPage.screenshot({ path: path.join(outDir, "02_admin_dashboard_allowed.png") });
  console.log("📸 Captured 02_admin_dashboard_allowed.png");

  await browser.close();
}

main().catch(console.error);
