// Hello World
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Servidor estático simples
const server = http.createServer((req, res) => {
  const filePath = path.join(rootDir, 'public', req.url === '/' ? 'offline.html' : req.url);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
console.log(`Test server running on port ${port}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

// Carrega a página e imediatamente simula offline
await page.goto(`http://localhost:${port}/offline.html`);
await context.setOffline(true);

// Frame 0 - 300ms: Apenas o ícone deve estar visível no centro
await page.waitForTimeout(350);
const phase1Visibility = await page.evaluate(() => {
  const wordmark = document.getElementById('wordmark-group');
  const tagline = document.getElementById('tagline-group');
  const bar = document.getElementById('bar-group');
  const symbol = document.getElementById('symbol-group');
  
  const wStyle = window.getComputedStyle(wordmark);
  const tStyle = window.getComputedStyle(tagline);
  const bStyle = window.getComputedStyle(bar);
  const sStyle = window.getComputedStyle(symbol);

  return {
    wordmarkOpacity: wStyle.opacity,
    wordmarkVisibility: wStyle.visibility,
    taglineOpacity: tStyle.opacity,
    taglineVisibility: tStyle.visibility,
    barOpacity: bStyle.opacity,
    barVisibility: bStyle.visibility,
    symbolOpacity: sStyle.opacity,
  };
});
console.log('Phase 1 (at 350ms):', phase1Visibility);

// Screenshot at 350ms
await page.screenshot({ path: path.join(rootDir, 'shots', 'phase1-icon-alone.png') });

// Phase 2: at 1500ms
await page.waitForTimeout(1150);
const phase2Visibility = await page.evaluate(() => {
  const wordmark = document.getElementById('wordmark-group');
  const tagline = document.getElementById('tagline-group');
  return {
    wordmarkOpacity: window.getComputedStyle(wordmark).opacity,
    taglineOpacity: window.getComputedStyle(tagline).opacity,
  };
});
console.log('Phase 2 (at 1500ms):', phase2Visibility);
await page.screenshot({ path: path.join(rootDir, 'shots', 'phase2-prx-revealing.png') });

// Phase 4: at 4500ms (Logo at top, offline card visible)
await page.waitForTimeout(3000);
const phase4State = await page.evaluate(() => {
  const logo = document.getElementById('logo-stage');
  const panel = document.getElementById('offline-panel');
  const header = document.getElementById('top-header');
  return {
    logoTop: logo.style.top,
    panelVisible: panel.classList.contains('visible'),
    headerVisible: header.classList.contains('visible'),
  };
});
console.log('Phase 4 (at 4500ms):', phase4State);
await page.screenshot({ path: path.join(rootDir, 'shots', 'phase4-final-top.png') });

// Teste do Theme Toggle no modo offline
await page.click('#theme-toggle');
await page.waitForTimeout(400);
const themeAfterToggle = await page.evaluate(() => {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
});
console.log('Theme after click:', themeAfterToggle);
await page.screenshot({ path: path.join(rootDir, 'shots', 'phase4-dark-mode.png') });

await browser.close();
server.close();
console.log('Verification finished successfully!');
