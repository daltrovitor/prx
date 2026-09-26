// Hello World
const fs = require('fs');
const path = require('path');

const gsapMin = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'gsap', 'dist', 'gsap.min.js'), 'utf8');

const htmlContent = `<!-- Hello World -->
<!DOCTYPE html>
<html lang="pt-BR" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="PRX">
  <title>Modo Offline · PRX</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" type="image/svg+xml" href="/brand/prx-app-icon.svg">
  <link rel="apple-touch-icon" href="/brand/prx-icon-192.png">

  <!-- Script imediato para evitar FOUC de tema -->
  <script>
    (function() {
      try {
        var t = localStorage.getItem('prx-app-theme') || localStorage.getItem('prx-theme');
        if (t === 'dark' || (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
      } catch (e) {}
    })();
  </script>

  <!-- GSAP Engine Inlined (100% autossuficiente e offline sem dependência de rede) -->
  <script>
${gsapMin}
  </script>

  <style>
    :root {
      --bg: #ffffff;
      --surface: #f8fafc;
      --surface-card: #ffffff;
      --border: #e2e8f0;
      --border-strong: rgba(15, 23, 42, 0.12);
      --text-main: #0b0b10;
      --text-muted: #64748b;
      --primary: #6c0cf0;
      --primary-hover: #5708c9;
      --primary-rgb: 108, 12, 240;
      --accent: #00f0ff;
      --online: #10b981;
      --offline-amber: #f59e0b;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color-scheme: light;
    }

    html.dark {
      --bg: #000000;
      --surface: #0a0b0e;
      --surface-card: #0a0b0e;
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text-main: #f3f4f6;
      --text-muted: #94a3b8;
      --primary: #7c3aed;
      --primary-hover: #6d28d9;
      --primary-rgb: 124, 58, 237;
      color-scheme: dark;
    }

    html.dark body {
      background-color: #000000;
      color: #f3f4f6;
    }

    html.dark .offline-card {
      background-color: #0a0b0e;
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
    }

    html.dark .icon-wrapper {
      background-color: #12151e;
      border-color: rgba(255, 255, 255, 0.12);
    }

    html.dark .btn-home {
      border-color: rgba(255, 255, 255, 0.12);
      color: #f3f4f6;
    }

    html.dark .btn-home:hover {
      background-color: #141722;
      border-color: rgba(255, 255, 255, 0.2);
    }

    html.dark .theme-toggle-btn {
      background-color: #0a0b0e;
      border-color: rgba(255, 255, 255, 0.12);
      color: #f3f4f6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    ::selection {
      background-color: var(--primary);
      color: #ffffff;
    }

    html, body {
      width: 100%;
      height: 100%;
      min-height: 100vh;
      min-height: -webkit-fill-available;
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      overflow-x: hidden;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .top-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 4.5rem;
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      z-index: 50;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
    }

    .top-header.visible {
      opacity: 1;
      pointer-events: auto;
    }

    .theme-toggle-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.65rem;
      border-radius: 12px;
      border: 1px solid var(--border);
      background-color: var(--surface);
      color: var(--text-main);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
    }

    .theme-toggle-btn:hover {
      transform: scale(1.05);
      border-color: var(--border-strong);
    }

    .theme-toggle-btn:active {
      transform: scale(0.95);
    }

    /* Estágio do Logo: Inicia centralizado na tela */
    .logo-stage {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(82vw, 520px);
      z-index: 40;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      will-change: transform, top, width;
    }

    .prx-logo-svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
      color: var(--text-main);
      filter: drop-shadow(0 0 24px rgba(var(--primary-rgb), 0.22));
      transition: color 0.3s ease;
    }

    .page-viewport {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6.5rem 1.5rem 2.5rem;
      position: relative;
      z-index: 10;
    }

    .logo-placeholder {
      width: min(76vw, 400px);
      height: 5.5rem;
      margin-bottom: 1.5rem;
      visibility: hidden;
    }

    .offline-card {
      width: 100%;
      max-width: 480px;
      background-color: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.25rem 1.75rem;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
      text-align: center;
      opacity: 0;
      transform: translateY(35px);
      pointer-events: none;
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .offline-card.visible {
      pointer-events: auto;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: var(--offline-amber);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
      transition: all 0.3s ease;
    }

    .status-badge.online-restored {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.3);
      color: var(--online);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: var(--offline-amber);
      box-shadow: 0 0 8px var(--offline-amber);
      transition: background-color 0.3s ease, box-shadow 0.3s ease;
    }

    .status-badge.online-restored .status-dot {
      background-color: var(--online);
      box-shadow: 0 0 8px var(--online);
    }

    .icon-wrapper {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.25rem;
      border-radius: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
    }

    h1 {
      font-size: 1.625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: var(--text-main);
      margin-bottom: 0.75rem;
    }

    @media (min-width: 640px) {
      h1 {
        font-size: 1.875rem;
      }
    }

    p.description {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 1.75rem;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    @media (min-width: 480px) {
      .actions {
        flex-direction: row;
      }
    }

    button.btn-retry {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      min-height: 48px;
      background-color: var(--primary);
      color: #ffffff;
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(var(--primary-rgb), 0.35);
      transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
    }

    button.btn-retry:hover {
      background-color: var(--primary-hover);
      box-shadow: 0 6px 20px rgba(var(--primary-rgb), 0.45);
      transform: translateY(-1px);
    }

    button.btn-retry:active {
      transform: translateY(1px);
    }

    button.btn-retry.loading {
      opacity: 0.85;
      pointer-events: none;
    }

    button.btn-home {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      min-height: 48px;
      background-color: transparent;
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 500;
      border: 1px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    button.btn-home:hover {
      background-color: var(--surface);
      border-color: var(--border-strong);
    }

    .network-indicator {
      margin-top: 1.25rem;
      font-size: 0.8125rem;
      font-family: var(--font-mono);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    .pulse-ring {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
      opacity: 0.7;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }

    .spinning {
      animation: spin 0.85s linear infinite;
    }

    @supports (padding: env(safe-area-inset-top)) {
      .top-header {
        top: env(safe-area-inset-top);
      }
      body {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
    }
  </style>
</head>
<body>
  <!-- Header com Theme Toggle -->
  <header class="top-header" id="top-header">
    <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="Alternar Tema" title="Alternar Tema">
      <svg id="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg id="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>
  </header>

  <!-- Estágio do Logo: Inicia centralizado na tela -->
  <div class="logo-stage" id="logo-stage" aria-label="PRX">
    <svg id="prx-logo" class="prx-logo-svg" style="visibility: hidden;" viewBox="0 0 776.5 181" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ld-s" gradientUnits="userSpaceOnUse" cx="330" cy="172" r="140">
          <stop offset="0" stop-color="#7607FD"/>
          <stop offset="0.42" stop-color="#6430FA"/>
          <stop offset="0.7" stop-color="#3C9CFD"/>
          <stop offset="1" stop-color="#0BD9FD"/>
        </radialGradient>
        <linearGradient id="ld-x" gradientUnits="userSpaceOnUse" x1="450" y1="310" x2="570" y2="405">
          <stop offset="0" stop-color="#7C04F0"/>
          <stop offset="0.4" stop-color="#6420F9"/>
          <stop offset="0.55" stop-color="#4F80FE"/>
          <stop offset="1" stop-color="#06E4F9"/>
        </linearGradient>
        <linearGradient id="ld-b" gradientUnits="userSpaceOnUse" x1="500.18" y1="0" x2="582.32" y2="0">
          <stop offset="0" stop-color="#7607FD"/>
          <stop offset="1" stop-color="#0BD9FD"/>
        </linearGradient>

        <clipPath id="ld-wc">
          <rect x="90" y="296" width="500" height="112"/>
        </clipPath>
        <clipPath id="ld-tc">
          <rect data-tag-clip id="tag-clip-rect" x="0" y="0" width="0" height="181"/>
        </clipPath>
      </defs>

      <!-- FASE 1: Somente o Ícone (inicia no centro) -->
      <g data-symbol-group id="symbol-group">
        <g transform="translate(-214 -92)">
          <path data-piece="white" id="piece-white" fill="currentColor" d="M214 119H312L340 147.8H282.2L333.7 199.7L261.2 272.7H221L293.5 199Z"/>
          <path data-piece="color" id="piece-color" fill="url(#ld-s)" d="M414 92H464.5L383.3 173L458.2 253.2H359.5L332 223.2H389.5L339.2 167.8Z"/>
        </g>
      </g>

      <!-- FASE 2: PRX (oculto no frame zero, revelado somente após o ícone deslizar à esquerda) -->
      <g id="wordmark-group" transform="translate(205.0 -290.78)">
        <g clipPath="url(#ld-wc)">
          <path data-letter id="letter-p" fill="currentColor" fill-rule="evenodd" d="M101 306.2H174A31.3 31.3 0 0 1 174 368.8H118.5V405.6H101ZM118.5 320.8H172A15.8 16.7 0 0 1 172 354.2H118.5Z"/>
          <path data-letter id="letter-r" fill="currentColor" fill-rule="evenodd" d="M279.2 306.2H350.5A32.5 31.6 0 0 1 350.5 369.4H348L383.5 405.6H361.2L324.2 369.4H296.8V405.6H279.2ZM296.8 321H350.5A16 16.95 0 0 1 350.5 354.9H296.8Z"/>
          <path data-letter id="letter-x" fill="url(#ld-x)" d="M447.5 306.5H471.5L570.6 405.6H546.6L508.4 367.5L469.8 405.6H447L496 355.5Z"/>
        </g>
        <path data-piece="x-arm" id="piece-x-arm" fill="url(#ld-x)" d="M548 306.5H571.5L527 351L515.5 339.5Z"/>
      </g>

      <!-- FASE 3: Subtítulo (oculto no frame zero, desdobra após o PRX) -->
      <g id="tagline-group" clipPath="url(#ld-tc)">
        <path fill="currentColor" transform="translate(306.0 144.08) scale(0.7975)" d="M7.39 -10.57H1.29Q1.22 -10.57 1.22 -10.51V-6.41Q1.22 -6.35 1.29 -6.35H5.56Q5.73 -6.35 5.73 -6.18V-5.49Q5.73 -5.32 5.56 -5.32H1.29Q1.22 -5.32 1.22 -5.25V-1.09Q1.22 -1.03 1.29 -1.03H7.39Q7.55 -1.03 7.55 -0.86V-0.17Q7.55 0 7.39 0H0.21Q0.05 0 0.05 -0.17V-11.43Q0.05 -11.6 0.21 -11.6H7.39Q7.55 -11.6 7.55 -11.43V-10.74Q7.55 -10.57 7.39 -10.57ZM17.39 -0.2 20.87 -5.75Q20.9 -5.8 20.87 -5.85L17.39 -11.4Q17.36 -11.47 17.36 -11.5Q17.36 -11.6 17.49 -11.6H18.42Q18.53 -11.6 18.62 -11.48L21.57 -6.76Q21.58 -6.74 21.62 -6.74Q21.65 -6.74 21.67 -6.76L24.6 -11.48Q24.68 -11.6 24.8 -11.6H25.71Q25.81 -11.6 25.83 -11.54Q25.86 -11.48 25.81 -11.4L22.35 -5.83Q22.33 -5.78 22.35 -5.73L25.81 -0.2Q25.84 -0.13 25.84 -0.1Q25.84 0 25.71 0H24.8Q24.68 0 24.6 -0.12L21.67 -4.82Q21.65 -4.86 21.62 -4.86Q21.58 -4.86 21.57 -4.82L18.62 -0.12Q18.53 0 18.42 0H17.49Q17.39 0 17.37 -0.06Q17.34 -0.12 17.39 -0.2ZM43.88 -8.37Q43.88 -6.93 42.97 -6.05Q42.07 -5.17 40.6 -5.17H37.37Q37.3 -5.17 37.3 -5.1V-0.17Q37.3 0 37.13 0H36.29Q36.12 0 36.12 -0.17V-11.45Q36.12 -11.62 36.29 -11.62H40.65Q42.1 -11.62 42.99 -10.72Q43.88 -9.83 43.88 -8.37ZM42.72 -8.35Q42.72 -9.36 42.1 -9.98Q41.49 -10.59 40.51 -10.59H37.37Q37.3 -10.59 37.3 -10.52V-6.21Q37.3 -6.15 37.37 -6.15H40.51Q41.49 -6.15 42.1 -6.75Q42.72 -7.36 42.72 -8.35ZM61.29 -10.57H55.19Q55.12 -10.57 55.12 -10.51V-6.41Q55.12 -6.35 55.19 -6.35H59.46Q59.63 -6.35 59.63 -6.18V-5.49Q59.63 -5.32 59.46 -5.32H55.19Q55.12 -5.32 55.12 -5.25V-1.09Q55.12 -1.03 55.19 -1.03H61.29Q61.45 -1.03 61.45 -0.86V-0.17Q61.45 0 61.29 0H54.11Q53.95 0 53.95 -0.17V-11.43Q53.95 -11.6 54.11 -11.6H61.29Q61.45 -11.6 61.45 -11.43V-10.74Q61.45 -10.57 61.29 -10.57ZM78.58 -0.12 76.14 -5.25Q76.12 -5.3 76.07 -5.3H73.26Q73.19 -5.3 73.19 -5.24V-0.17Q73.19 0 73.02 0H72.18Q72.01 0 72.01 -0.17V-11.43Q72.01 -11.6 72.18 -11.6H76.47Q77.9 -11.6 78.78 -10.71Q79.65 -9.83 79.65 -8.4Q79.65 -7.24 79.02 -6.43Q78.39 -5.62 77.32 -5.39Q77.25 -5.35 77.28 -5.3L79.77 -0.2Q79.79 -0.17 79.79 -0.12Q79.79 0 79.65 0H78.78Q78.63 0 78.58 -0.12ZM73.19 -10.51V-6.31Q73.19 -6.25 73.26 -6.25H76.34Q77.3 -6.25 77.9 -6.84Q78.49 -7.44 78.49 -8.4Q78.49 -9.36 77.9 -9.97Q77.3 -10.57 76.34 -10.57H73.26Q73.19 -10.57 73.19 -10.51ZM91.31 -0.17V-11.43Q91.31 -11.6 91.48 -11.6H92.32Q92.49 -11.6 92.49 -11.43V-0.17Q92.49 0 92.32 0H91.48Q91.31 0 91.31 -0.17ZM111.64 -10.57H105.54Q105.47 -10.57 105.47 -10.51V-6.41Q105.47 -6.35 105.54 -6.35H109.81Q109.98 -6.35 109.98 -6.18V-5.49Q109.98 -5.32 109.81 -5.32H105.54Q105.47 -5.32 105.47 -5.25V-1.09Q105.47 -1.03 105.54 -1.03H111.64Q111.8 -1.03 111.8 -0.86V-0.17Q111.8 0 111.64 0H104.46Q104.3 0 104.3 -0.17V-11.43Q104.3 -11.6 104.46 -11.6H111.64Q111.8 -11.6 111.8 -11.43V-10.74Q111.8 -10.57 111.64 -10.57ZM105.94 -12.93 107.26 -14.72Q107.33 -14.81 107.48 -14.81H108.44Q108.59 -14.81 108.65 -14.72L110 -12.93Q110.03 -12.89 110.03 -12.83Q110.03 -12.79 110 -12.76Q109.96 -12.73 109.9 -12.73H109.23Q109.09 -12.73 109.02 -12.83L108.03 -14.19Q108.01 -14.22 107.98 -14.22Q107.94 -14.22 107.93 -14.19L106.91 -12.83Q106.85 -12.73 106.7 -12.73H106.04Q105.94 -12.73 105.9 -12.78Q105.87 -12.84 105.94 -12.93ZM129.43 -11.6H130.28Q130.44 -11.6 130.44 -11.43V-0.17Q130.44 0 130.28 0H129.45Q129.33 0 129.25 -0.12L123.6 -9.31Q123.58 -9.36 123.55 -9.35Q123.52 -9.35 123.52 -9.3L123.53 -0.17Q123.53 0 123.37 0H122.52Q122.36 0 122.36 -0.17V-11.43Q122.36 -11.6 122.52 -11.6H123.35Q123.47 -11.6 123.55 -11.48L129.2 -2.29Q129.22 -2.24 129.25 -2.25Q129.28 -2.25 129.28 -2.3L129.27 -11.43Q129.27 -11.6 129.43 -11.6ZM141.26 -3.53V-8.09Q141.26 -9.16 141.74 -9.99Q142.23 -10.82 143.11 -11.28Q143.99 -11.73 145.15 -11.73Q146.31 -11.73 147.19 -11.29Q148.07 -10.84 148.56 -10.03Q149.04 -9.21 149.04 -8.15Q149.04 -8.07 148.99 -8.02Q148.94 -7.97 148.88 -7.97L148.03 -7.92Q147.87 -7.92 147.87 -8.07V-8.12Q147.87 -9.3 147.12 -10Q146.38 -10.71 145.15 -10.71Q143.92 -10.71 143.18 -9.99Q142.43 -9.28 142.43 -8.12V-3.48Q142.43 -2.32 143.18 -1.61Q143.92 -0.89 145.15 -0.89Q146.38 -0.89 147.12 -1.6Q147.87 -2.3 147.87 -3.48V-3.51Q147.87 -3.66 148.03 -3.66L148.88 -3.61Q149.04 -3.61 149.04 -3.46Q149.04 -2.39 148.56 -1.57Q148.07 -0.75 147.19 -0.3Q146.31 0.15 145.15 0.15Q143.99 0.15 143.11 -0.31Q142.23 -0.76 141.74 -1.6Q141.26 -2.44 141.26 -3.53ZM160.31 -0.17V-11.43Q160.31 -11.6 160.48 -11.6H161.32Q161.49 -11.6 161.49 -11.43V-0.17Q161.49 0 161.32 0H160.48Q160.31 0 160.31 -0.17ZM180.4 -0.13 179.74 -2.22Q179.72 -2.27 179.67 -2.27H174.72Q174.67 -2.27 174.65 -2.22L173.99 -0.13Q173.94 0 173.79 0H172.9Q172.71 0 172.76 -0.18L176.43 -11.47Q176.48 -11.6 176.63 -11.6H177.75Q177.9 -11.6 177.95 -11.47L181.63 -0.18L181.65 -0.12Q181.65 0 181.5 0H180.6Q180.45 0 180.4 -0.13ZM175.05 -3.23H179.33Q179.36 -3.23 179.38 -3.26Q179.41 -3.28 179.39 -3.31L177.24 -10.08Q177.22 -10.11 177.19 -10.11Q177.16 -10.11 177.14 -10.08L174.98 -3.31Q174.97 -3.28 174.99 -3.26Q175.02 -3.23 175.05 -3.23ZM191.84 -2.97V-3.48Q191.84 -3.65 192.01 -3.65H192.82Q192.98 -3.65 192.98 -3.48V-3.03Q192.98 -2.07 193.78 -1.48Q194.57 -0.89 195.98 -0.89Q197.26 -0.89 197.92 -1.43Q198.58 -1.97 198.58 -2.87Q198.58 -3.45 198.28 -3.86Q197.97 -4.28 197.33 -4.64Q196.69 -5 195.53 -5.49Q194.29 -5.98 193.6 -6.36Q192.92 -6.73 192.49 -7.32Q192.07 -7.9 192.07 -8.8Q192.07 -10.19 193.04 -10.96Q194.01 -11.73 195.7 -11.73Q197.54 -11.73 198.6 -10.87Q199.66 -10.01 199.66 -8.58V-8.22Q199.66 -8.05 199.5 -8.05H198.67Q198.5 -8.05 198.5 -8.22V-8.52Q198.5 -9.48 197.75 -10.09Q196.99 -10.71 195.65 -10.71Q194.47 -10.71 193.84 -10.22Q193.21 -9.74 193.21 -8.83Q193.21 -8.24 193.52 -7.85Q193.83 -7.46 194.4 -7.17Q194.97 -6.88 196.16 -6.41Q197.37 -5.92 198.11 -5.49Q198.85 -5.05 199.3 -4.43Q199.76 -3.81 199.76 -2.92Q199.76 -1.52 198.73 -0.7Q197.71 0.13 195.88 0.13Q194.01 0.13 192.92 -0.71Q191.84 -1.56 191.84 -2.97ZM231.51 -7.99V-3.55Q231.51 -2.05 230.66 -1.08Q229.8 -0.1 228.36 0.1Q228.3 0.1 228.3 0.17V1.74Q228.3 1.91 228.13 1.91H227.29Q227.12 1.91 227.12 1.74V0.17Q227.12 0.1 227.05 0.1Q225.61 -0.1 224.75 -1.08Q223.89 -2.05 223.89 -3.55V-7.99Q223.89 -9.1 224.36 -9.94Q224.83 -10.79 225.7 -11.26Q226.57 -11.73 227.7 -11.73Q228.83 -11.73 229.7 -11.26Q230.57 -10.79 231.04 -9.94Q231.51 -9.1 231.51 -7.99ZM230.33 -8.04Q230.33 -9.23 229.61 -9.97Q228.88 -10.71 227.7 -10.71Q226.52 -10.71 225.79 -9.97Q225.07 -9.23 225.07 -8.04V-3.56Q225.07 -2.37 225.79 -1.63Q226.52 -0.89 227.7 -0.89Q228.88 -0.89 229.61 -1.63Q230.33 -2.37 230.33 -3.56ZM242.86 -3.58V-11.43Q242.86 -11.6 243.02 -11.6H243.87Q244.03 -11.6 244.03 -11.43V-3.55Q244.03 -2.37 244.79 -1.63Q245.56 -0.89 246.8 -0.89Q248.04 -0.89 248.81 -1.63Q249.57 -2.37 249.57 -3.55V-11.43Q249.57 -11.6 249.73 -11.6H250.58Q250.74 -11.6 250.74 -11.43V-3.58Q250.74 -2.47 250.26 -1.63Q249.77 -0.8 248.87 -0.33Q247.98 0.13 246.8 0.13Q245.64 0.13 244.75 -0.33Q243.85 -0.8 243.35 -1.63Q242.86 -2.47 242.86 -3.58ZM269.64 -10.57H263.54Q263.47 -10.57 263.47 -10.51V-6.41Q263.47 -6.35 263.54 -6.35H267.81Q267.98 -6.35 267.98 -6.18V-5.49Q267.98 -5.32 267.81 -5.32H263.54Q263.47 -5.32 263.47 -5.25V-1.09Q263.47 -1.03 263.54 -1.03H269.64Q269.8 -1.03 269.8 -0.86V-0.17Q269.8 0 269.64 0H262.46Q262.3 0 262.3 -0.17V-11.43Q262.3 -11.6 262.46 -11.6H269.64Q269.8 -11.6 269.8 -11.43V-10.74Q269.8 -10.57 269.64 -10.57ZM292.71 -3.53V-8.09Q292.71 -9.16 293.19 -9.99Q293.68 -10.82 294.56 -11.28Q295.44 -11.73 296.6 -11.73Q297.76 -11.73 298.64 -11.29Q299.52 -10.84 300.01 -10.03Q300.49 -9.21 300.49 -8.15Q300.49 -8.07 300.44 -8.02Q300.39 -7.97 300.33 -7.97L299.48 -7.92Q299.32 -7.92 299.32 -8.07V-8.12Q299.32 -9.3 298.57 -10Q297.83 -10.71 296.6 -10.71Q295.37 -10.71 294.63 -9.99Q293.88 -9.28 293.88 -8.12V-3.48Q293.88 -2.32 294.63 -1.61Q295.37 -0.89 296.6 -0.89Q297.83 -0.89 298.57 -1.6Q299.32 -2.3 299.32 -3.48V-3.51Q299.32 -3.66 299.48 -3.66L300.33 -3.61Q300.49 -3.61 300.49 -3.46Q300.49 -2.39 300.01 -1.57Q299.52 -0.75 298.64 -0.3Q297.76 0.15 296.6 0.15Q295.44 0.15 294.56 -0.31Q293.68 -0.76 293.19 -1.6Q292.71 -2.44 292.71 -3.53ZM311.25 -3.71V-7.89Q311.25 -9.03 311.74 -9.9Q312.23 -10.77 313.12 -11.25Q314.02 -11.73 315.19 -11.73Q316.37 -11.73 317.27 -11.25Q318.17 -10.77 318.66 -9.9Q319.15 -9.03 319.15 -7.89V-3.71Q319.15 -2.57 318.66 -1.7Q318.17 -0.83 317.27 -0.35Q316.37 0.13 315.19 0.13Q314.02 0.13 313.12 -0.35Q312.23 -0.83 311.74 -1.7Q311.25 -2.57 311.25 -3.71ZM317.98 -3.66V-7.9Q317.98 -9.16 317.21 -9.93Q316.45 -10.71 315.19 -10.71Q313.95 -10.71 313.19 -9.93Q312.42 -9.16 312.42 -7.9V-3.66Q312.42 -2.4 313.19 -1.64Q313.95 -0.88 315.19 -0.88Q316.45 -0.88 317.21 -1.64Q317.98 -2.4 317.98 -3.66ZM337.68 -11.6H338.53Q338.69 -11.6 338.69 -11.43V-0.17Q338.69 0 338.53 0H337.7Q337.58 0 337.5 -0.12L331.85 -9.31Q331.83 -9.36 331.8 -9.35Q331.77 -9.35 331.77 -9.3L331.78 -0.17Q331.78 0 331.62 0H330.77Q330.61 0 330.61 -0.17V-11.43Q330.61 -11.6 330.77 -11.6H331.6Q331.72 -11.6 331.8 -11.48L337.45 -2.29Q337.47 -2.24 337.5 -2.25Q337.53 -2.25 337.53 -2.3L337.52 -11.43Q337.52 -11.6 337.68 -11.6ZM357.14 -10.57H351.04Q350.97 -10.57 350.97 -10.51V-6.41Q350.97 -6.35 351.04 -6.35H355.31Q355.48 -6.35 355.48 -6.18V-5.49Q355.48 -5.32 355.31 -5.32H351.04Q350.97 -5.32 350.97 -5.25V-1.09Q350.97 -1.03 351.04 -1.03H357.14Q357.3 -1.03 357.3 -0.86V-0.17Q357.3 0 357.14 0H349.96Q349.8 0 349.8 -0.17V-11.43Q349.8 -11.6 349.96 -11.6H357.14Q357.3 -11.6 357.3 -11.43V-10.74Q357.3 -10.57 357.14 -10.57ZM367.26 -3.53V-8.09Q367.26 -9.16 367.74 -9.99Q368.23 -10.82 369.11 -11.28Q369.99 -11.73 371.15 -11.73Q372.31 -11.73 373.19 -11.29Q374.07 -10.84 374.56 -10.03Q375.04 -9.21 375.04 -8.15Q375.04 -8.07 374.99 -8.02Q374.94 -7.97 374.88 -7.97L374.03 -7.92Q373.87 -7.92 373.87 -8.07V-8.12Q373.87 -9.3 373.12 -10Q372.38 -10.71 371.15 -10.71Q369.92 -10.71 369.18 -9.99Q368.43 -9.28 368.43 -8.12V-3.48Q368.43 -2.32 369.18 -1.61Q369.92 -0.89 371.15 -0.89Q372.38 -0.89 373.12 -1.6Q373.87 -2.3 373.87 -3.48V-3.51Q373.87 -3.66 374.03 -3.66L374.88 -3.61Q375.04 -3.61 375.04 -3.46Q375.04 -2.39 374.56 -1.57Q374.07 -0.75 373.19 -0.3Q372.31 0.15 371.15 0.15Q369.99 0.15 369.11 -0.31Q368.23 -0.76 367.74 -1.6Q367.26 -2.44 367.26 -3.53ZM392.9 -11.43V-10.72Q392.9 -10.56 392.74 -10.56H389.49Q389.42 -10.56 389.42 -10.49V-0.17Q389.42 0 389.26 0H388.41Q388.25 0 388.25 -0.17V-10.49Q388.25 -10.56 388.18 -10.56H385.06Q384.9 -10.56 384.9 -10.72V-11.43Q384.9 -11.6 385.06 -11.6H392.74Q392.9 -11.6 392.9 -11.43ZM409.15 -0.13 408.49 -2.22Q408.47 -2.27 408.42 -2.27H403.47Q403.42 -2.27 403.4 -2.22L402.74 -0.13Q402.69 0 402.54 0H401.65Q401.46 0 401.51 -0.18L405.18 -11.47Q405.23 -11.6 405.38 -11.6H406.5Q406.65 -11.6 406.7 -11.47L410.38 -0.18L410.4 -0.12Q410.4 0 410.25 0H409.35Q409.2 0 409.15 -0.13ZM403.8 -3.23H408.08Q408.11 -3.23 408.13 -3.26Q408.16 -3.28 408.14 -3.31L405.99 -10.08Q405.97 -10.11 405.94 -10.11Q405.91 -10.11 405.89 -10.08L403.73 -3.31Q403.72 -3.28 403.74 -3.26Q403.77 -3.23 403.8 -3.23ZM429.05 -11.6H429.91Q430.07 -11.6 430.07 -11.43V-0.17Q430.07 0 429.91 0H429.06Q428.9 0 428.9 -0.17V-9.38Q428.9 -9.43 428.87 -9.45Q428.83 -9.46 428.82 -9.41L426.11 -5.27Q426.03 -5.15 425.92 -5.15H425.48Q425.37 -5.15 425.29 -5.25L422.58 -9.36Q422.57 -9.41 422.53 -9.4Q422.5 -9.38 422.5 -9.33V-0.17Q422.5 0 422.34 0H421.49Q421.33 0 421.33 -0.17V-11.43Q421.33 -11.6 421.49 -11.6H422.35Q422.49 -11.6 422.55 -11.5L425.67 -6.78Q425.68 -6.76 425.72 -6.76Q425.75 -6.76 425.77 -6.78L428.85 -11.48Q428.93 -11.6 429.05 -11.6ZM453.66 -3.51V-8.09Q453.66 -9.16 454.15 -9.99Q454.64 -10.82 455.52 -11.28Q456.4 -11.73 457.56 -11.73Q458.7 -11.73 459.59 -11.29Q460.47 -10.84 460.96 -10.03Q461.44 -9.23 461.44 -8.22V-8Q461.44 -7.84 461.27 -7.84H460.43Q460.26 -7.84 460.26 -8V-8.2Q460.26 -9.31 459.52 -10.01Q458.78 -10.71 457.56 -10.71Q456.33 -10.71 455.59 -9.99Q454.84 -9.28 454.84 -8.12V-3.48Q454.84 -2.32 455.6 -1.61Q456.37 -0.89 457.61 -0.89Q458.82 -0.89 459.54 -1.56Q460.26 -2.22 460.26 -3.33V-4.84Q460.26 -4.91 460.19 -4.91H457.76Q457.59 -4.91 457.59 -5.07V-5.77Q457.59 -5.93 457.76 -5.93H461.27Q461.44 -5.93 461.44 -5.77V-3.63Q461.44 -1.86 460.38 -0.86Q459.33 0.13 457.56 0.13Q456.4 0.13 455.52 -0.32Q454.64 -0.78 454.15 -1.61Q453.66 -2.44 453.66 -3.51ZM479.49 -10.57H473.39Q473.32 -10.57 473.32 -10.51V-6.41Q473.32 -6.35 473.39 -6.35H477.66Q477.83 -6.35 477.83 -6.18V-5.49Q477.83 -5.32 477.66 -5.32H473.39Q473.32 -5.32 473.32 -5.25V-1.09Q473.32 -1.03 473.39 -1.03H479.49Q479.65 -1.03 479.65 -0.86V-0.17Q479.65 0 479.49 0H472.31Q472.15 0 472.15 -0.17V-11.43Q472.15 -11.6 472.31 -11.6H479.49Q479.65 -11.6 479.65 -11.43V-10.74Q479.65 -10.57 479.49 -10.57ZM496.48 -0.12 494.04 -5.25Q494.02 -5.3 493.97 -5.3H491.16Q491.09 -5.3 491.09 -5.24V-0.17Q491.09 0 490.92 0H490.08Q489.91 0 489.91 -0.17V-11.43Q489.91 -11.6 490.08 -11.6H494.37Q495.8 -11.6 496.68 -10.71Q497.55 -9.83 497.55 -8.4Q497.55 -7.24 496.92 -6.43Q496.29 -5.62 495.22 -5.39Q495.15 -5.35 495.18 -5.3L497.67 -0.2Q497.69 -0.17 497.69 -0.12Q497.69 0 497.55 0H496.68Q496.53 0 496.48 -0.12ZM491.09 -10.51V-6.31Q491.09 -6.25 491.16 -6.25H494.24Q495.2 -6.25 495.8 -6.84Q496.39 -7.44 496.39 -8.4Q496.39 -9.36 495.8 -9.97Q495.2 -10.57 494.24 -10.57H491.16Q491.09 -10.57 491.09 -10.51ZM515.4 -0.13 514.74 -2.22Q514.72 -2.27 514.67 -2.27H509.72Q509.67 -2.27 509.65 -2.22L508.99 -0.13Q508.94 0 508.79 0H507.9Q507.71 0 507.76 -0.18L511.43 -11.47Q511.48 -11.6 511.63 -11.6H512.75Q512.9 -11.6 512.95 -11.47L516.63 -0.18L516.65 -0.12Q516.65 0 516.5 0H515.6Q515.45 0 515.4 -0.13ZM510.05 -3.23H514.33Q514.36 -3.23 514.38 -3.26Q514.41 -3.28 514.39 -3.31L512.24 -10.08Q512.22 -10.11 512.19 -10.11Q512.16 -10.11 512.14 -10.08L509.98 -3.31Q509.97 -3.28 509.99 -3.26Q510.02 -3.23 510.05 -3.23ZM534.53 -7.97 533.68 -7.92Q533.52 -7.92 533.52 -8.07V-8.12Q533.52 -9.3 532.77 -10Q532.03 -10.71 530.8 -10.71Q529.57 -10.71 528.83 -9.99Q528.08 -9.28 528.08 -8.12V-3.48Q528.08 -2.32 528.83 -1.61Q529.57 -0.89 530.8 -0.89Q532.03 -0.89 532.77 -1.6Q533.52 -2.3 533.52 -3.48V-3.51Q533.52 -3.66 533.68 -3.66L534.53 -3.61Q534.69 -3.61 534.69 -3.46Q534.69 -2.39 534.21 -1.57Q533.72 -0.75 532.84 -0.3Q531.96 0.15 530.8 0.15Q530.77 0.15 530.85 0.23Q531.65 0.91 531.65 1.74Q531.65 1.99 531.61 2.1Q531.48 2.63 531.08 2.87Q530.68 3.1 530.15 3.1Q529.81 3.1 529.47 3.02Q529.34 2.97 529.36 2.82L529.42 2.44Q529.44 2.35 529.5 2.33Q529.56 2.3 529.62 2.32Q529.82 2.37 529.99 2.37Q530.34 2.37 530.57 2.17Q530.8 1.97 530.8 1.59Q530.8 1.21 530.52 0.81Q530.24 0.41 529.77 0.07Q529.77 0.05 529.69 0.02Q528.4 -0.27 527.65 -1.21Q526.91 -2.15 526.91 -3.53V-8.09Q526.91 -9.16 527.39 -9.99Q527.88 -10.82 528.76 -11.28Q529.64 -11.73 530.8 -11.73Q531.96 -11.73 532.84 -11.29Q533.72 -10.84 534.21 -10.03Q534.69 -9.21 534.69 -8.15V-8.07Q534.69 -8.04 534.64 -8Q534.59 -7.97 534.53 -7.97ZM545.5 -3.71V-7.89Q545.5 -9.03 545.99 -9.9Q546.48 -10.77 547.37 -11.25Q548.27 -11.73 549.44 -11.73Q550.62 -11.73 551.52 -11.25Q552.42 -10.77 552.91 -9.9Q553.4 -9.03 553.4 -7.89V-3.71Q553.4 -2.57 552.91 -1.7Q552.42 -0.83 551.52 -0.35Q550.62 0.13 549.44 0.13Q548.27 0.13 547.37 -0.35Q546.48 -0.83 545.99 -1.7Q545.5 -2.57 545.5 -3.71ZM552.23 -3.66V-7.9Q552.23 -9.16 551.46 -9.93Q550.7 -10.71 549.44 -10.71Q548.2 -10.71 547.44 -9.93Q546.67 -9.16 546.67 -7.9V-3.66Q546.67 -2.4 547.44 -1.64Q548.2 -0.88 549.44 -0.88Q550.7 -0.88 551.46 -1.64Q552.23 -2.4 552.23 -3.66ZM549.46 -13.57Q549.16 -13.75 548.99 -13.82Q548.83 -13.89 548.63 -13.89Q548.33 -13.89 548.12 -13.8Q547.92 -13.7 547.72 -13.47Q547.62 -13.32 547.49 -13.44L547.19 -13.74Q547.07 -13.85 547.15 -13.97Q547.7 -14.78 548.58 -14.78Q548.85 -14.78 549.05 -14.7Q549.26 -14.62 549.43 -14.52Q549.61 -14.43 549.66 -14.4Q549.72 -14.37 549.9 -14.27Q550.07 -14.17 550.21 -14.12Q550.35 -14.07 550.49 -14.07Q551.03 -14.07 551.36 -14.53Q551.46 -14.7 551.6 -14.57L551.89 -14.28Q552.01 -14.17 551.91 -14.04Q551.68 -13.64 551.29 -13.42Q550.9 -13.21 550.49 -13.21Q550.17 -13.21 549.94 -13.31Q549.71 -13.41 549.46 -13.57ZM571.49 -10.57H565.39Q565.32 -10.57 565.32 -10.51V-6.41Q565.32 -6.35 565.39 -6.35H569.66Q569.83 -6.35 569.83 -6.18V-5.49Q569.83 -5.32 569.66 -5.32H565.39Q565.32 -5.32 565.32 -5.25V-1.09Q565.32 -1.03 565.39 -1.03H571.49Q571.65 -1.03 571.65 -0.86V-0.17Q571.65 0 571.49 0H564.31Q564.15 0 564.15 -0.17V-11.43Q564.15 -11.6 564.31 -11.6H571.49Q571.65 -11.6 571.65 -11.43V-10.74Q571.65 -10.57 571.49 -10.57ZM582.04 -2.97V-3.48Q582.04 -3.65 582.21 -3.65H583.02Q583.18 -3.65 583.18 -3.48V-3.03Q583.18 -2.07 583.98 -1.48Q584.77 -0.89 586.18 -0.89Q587.46 -0.89 588.12 -1.43Q588.78 -1.97 588.78 -2.87Q588.78 -3.45 588.48 -3.86Q588.17 -4.28 587.53 -4.64Q586.89 -5 585.73 -5.49Q584.49 -5.98 583.8 -6.36Q583.12 -6.73 582.69 -7.32Q582.27 -7.9 582.27 -8.8Q582.27 -10.19 583.24 -10.96Q584.21 -11.73 585.9 -11.73Q587.74 -11.73 588.8 -10.87Q589.86 -10.01 589.86 -8.58V-8.22Q589.86 -8.05 589.7 -8.05H588.87Q588.7 -8.05 588.7 -8.22V-8.52Q588.7 -9.48 587.95 -10.09Q587.19 -10.71 585.85 -10.71Q584.67 -10.71 584.04 -10.22Q583.41 -9.74 583.41 -8.83Q583.41 -8.24 583.72 -7.85Q584.03 -7.46 584.6 -7.17Q585.17 -6.88 586.36 -6.41Q587.57 -5.92 588.31 -5.49Q589.05 -5.05 589.5 -4.43Q589.96 -3.81 589.96 -2.92Q589.96 -1.52 588.93 -0.7Q587.91 0.13 586.08 0.13Q584.21 0.13 583.12 -0.71Q582.04 -1.56 582.04 -2.97Z"/>
      </g>

      <!-- FASE 3: Barra (oculta no frame zero, expande a partir do centro) -->
      <rect data-bar id="word-bar" x="500.18" y="162.08" width="82.14" height="3.5" fill="url(#ld-b)"/>
    </svg>
  </div>

  <!-- Conteúdo Principal -->
  <main class="page-viewport">
    <div class="logo-placeholder" id="logo-placeholder" aria-hidden="true"></div>

    <div class="offline-card" id="offline-panel">
      <div class="status-badge" id="badge-status">
        <span class="status-dot"></span>
        <span id="badge-text">Sem Conexão</span>
      </div>

      <div class="icon-wrapper" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M1 1l22 22"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <path d="M12 20h.01"/>
        </svg>
      </div>

      <h1>Você está offline</h1>
      <p class="description" id="offline-message">
        Não foi possível carregar a página solicitada porque o dispositivo está sem conexão com a internet. Verifique seu Wi-Fi ou dados móveis.
      </p>

      <div class="actions">
        <button type="button" class="btn-retry" id="btn-retry" aria-label="Tentar recarregar a página">
          <svg id="retry-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
            <path d="M20 4v6h-6"/>
            <path d="M20 10 16 5.5H4v5"/>
            <path d="M4 20v-6h6"/>
            <path d="M4 14l4 4.5h12v-5"/>
          </svg>
          <span id="retry-label">Tentar novamente</span>
        </button>

        <button type="button" class="btn-home" id="btn-home" aria-label="Voltar para o início">
          Início
        </button>
      </div>

      <div class="network-indicator" id="network-indicator">
        <span class="pulse-ring"></span>
        <span id="indicator-text">Aguardando sinal para reconectar automaticamente...</span>
      </div>
    </div>
  </main>

  <script>
    // 1. Gerenciamento do Tema Claro / Escuro sincronizado
    (function setupThemeSystem() {
      var btn = document.getElementById('theme-toggle');
      var iconSun = document.getElementById('icon-sun');
      var iconMoon = document.getElementById('icon-moon');

      function getSavedTheme() {
        try {
          var appTheme = localStorage.getItem('prx-app-theme');
          var landingTheme = localStorage.getItem('prx-theme');
          var theme = appTheme || landingTheme;
          if (theme === 'dark' || theme === 'light') return theme;
        } catch (e) {}
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }

      function applyTheme(newTheme) {
        var root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(newTheme);
        root.setAttribute('data-theme', newTheme);
        root.style.colorScheme = newTheme;

        var metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', newTheme === 'dark' ? '#000000' : '#ffffff');

        if (newTheme === 'dark') {
          if (iconSun) iconSun.style.display = 'block';
          if (iconMoon) iconMoon.style.display = 'none';
          if (btn) {
            btn.setAttribute('title', 'Mudar para Modo Claro');
            btn.setAttribute('aria-label', 'Alternar para modo claro');
          }
        } else {
          if (iconSun) iconSun.style.display = 'none';
          if (iconMoon) iconMoon.style.display = 'block';
          if (btn) {
            btn.setAttribute('title', 'Mudar para Modo Escuro');
            btn.setAttribute('aria-label', 'Alternar para modo escuro');
          }
        }

        try {
          localStorage.setItem('prx-theme', newTheme);
          localStorage.setItem('prx-app-theme', newTheme);
        } catch (e) {}
      }

      var currentTheme = getSavedTheme();
      applyTheme(currentTheme);

      if (btn) {
        btn.addEventListener('click', function() {
          var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
          applyTheme(next);
        });
      }
    })();

    // 2. Animação Oficial GSAP 100% idêntica ao PrxLoader online
    (function runOfficialAnimation() {
      var logoStage = document.getElementById('logo-stage');
      var logoSvg = document.getElementById('prx-logo');
      var panel = document.getElementById('offline-panel');
      var header = document.getElementById('top-header');

      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function transitionLogoToTop() {
        if (!logoStage) return;

        var targetTop = '4.5rem';
        var targetWidth = Math.min(window.innerWidth * 0.76, 400);

        if (window.gsap && !reduceMotion) {
          var transTl = gsap.timeline();
          
          transTl.to(logoStage, {
            top: targetTop,
            yPercent: 0,
            y: 0,
            transform: 'translate(-50%, 0)',
            width: targetWidth,
            duration: 0.95,
            ease: "power3.inOut"
          })
          .fromTo(panel, 
            { autoAlpha: 0, y: 35 }, 
            { autoAlpha: 1, y: 0, duration: 0.75, ease: "power3.out" }, 
            "-=0.4"
          )
          .to(header, {
            autoAlpha: 1,
            duration: 0.45,
            ease: "power2.out",
            onComplete: function() {
              if (panel) panel.classList.add('visible');
              if (header) header.classList.add('visible');
            }
          }, "-=0.5");
        } else {
          if (panel) {
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
            panel.classList.add('visible');
          }
          if (header) {
            header.style.opacity = '1';
            header.classList.add('visible');
          }
          if (logoStage) {
            logoStage.style.top = targetTop;
            logoStage.style.transform = 'translate(-50%, 0)';
            logoStage.style.width = targetWidth + 'px';
          }
        }
      }

      if (reduceMotion) {
        var tagClip = document.getElementById('tag-clip-rect');
        if (tagClip) tagClip.setAttribute('width', '776.5');
        if (window.gsap) {
          gsap.set("#symbol-group", { x: 0 });
          gsap.set("[data-piece='white'], [data-piece='color'], [data-piece='x-arm']", { autoAlpha: 1, x: 0, y: 0 });
          gsap.set("[data-letter]", { y: 0 });
          gsap.set("[data-bar]", { scaleX: 1 });
          gsap.set(logoSvg, { autoAlpha: 1 });
        }
        transitionLogoToTop();
        return;
      }

      if (window.gsap) {
        var SYMBOL_CENTER_OFFSET = 263; // 776.5 / 2 - 250.5 / 2

        var tl = gsap.timeline({
          paused: true,
          defaults: { ease: "expo.out" },
          onComplete: function() {
            setTimeout(transitionLogoToTop, 200);
          }
        });

        gsap.set("#symbol-group", { x: SYMBOL_CENTER_OFFSET });
        tl.from("#piece-white", { x: -90, y: -20, autoAlpha: 0, duration: 0.85 }, 0.1)
          .from("#piece-color", { x: 90, y: 20, autoAlpha: 0, duration: 0.85 }, 0.18)
          .to("#symbol-group", { x: 0, duration: 0.85, ease: "expo.inOut" }, 0.8)
          .from("[data-letter]", { y: 130, duration: 0.9, stagger: 0.09 }, 1.38)
          .from("#piece-x-arm", { x: 46, y: -46, autoAlpha: 0, duration: 0.7, ease: "back.out(2)" }, 1.78)
          .to("#tag-clip-rect", { attr: { width: 776.5 }, duration: 0.9, ease: "power3.inOut" }, 2.0)
          .from("#word-bar", { scaleX: 0, transformOrigin: "50% 50%", duration: 0.7, ease: "power3.out" }, 2.35)
          .to({}, { duration: 0.35 });

        // Revela o SVG já nos estados iniciais aplicados pelos .from()
        gsap.set(logoSvg, { autoAlpha: 1 });

        var elapsed = 0;
        var last = performance.now();
        var frame = 0;
        function step(now) {
          elapsed += Math.min(now - last, 1000 / 30) / 1000;
          last = now;
          tl.time(elapsed);
          if (tl.progress() < 1) frame = requestAnimationFrame(step);
        }
        frame = requestAnimationFrame(function(now) {
          last = now;
          frame = requestAnimationFrame(step);
        });
      } else {
        var clip = document.getElementById('tag-clip-rect');
        if (clip) clip.setAttribute('width', '776.5');
        transitionLogoToTop();
      }
    })();

    // 3. Lógica de Reconexão e Botão "Tentar Novamente"
    (function setupReconnection() {
      var btnRetry = document.getElementById('btn-retry');
      var btnHome = document.getElementById('btn-home');
      var retryIcon = document.getElementById('retry-icon');
      var retryLabel = document.getElementById('retry-label');
      var badgeStatus = document.getElementById('badge-status');
      var badgeText = document.getElementById('badge-text');
      var indicatorText = document.getElementById('indicator-text');
      var isRetrying = false;

      function attemptReload(manual) {
        if (isRetrying) return;
        isRetrying = true;

        if (btnRetry) btnRetry.classList.add('loading');
        if (retryIcon) retryIcon.classList.add('spinning');
        if (retryLabel) retryLabel.textContent = 'Verificando conexão...';
        if (indicatorText) indicatorText.textContent = 'Testando resposta da rede...';

        var pingUrl = '/manifest.json?_t=' + Date.now();

        fetch(pingUrl, { method: 'HEAD', cache: 'no-store' })
          .then(function(res) {
            if (res.ok || res.status < 500) {
              if (badgeStatus) badgeStatus.classList.add('online-restored');
              if (badgeText) badgeText.textContent = 'Conectado!';
              if (retryLabel) retryLabel.textContent = 'Conectado! Recarregando...';
              if (indicatorText) indicatorText.textContent = 'Sinal restabelecido! Recarregando página...';

              setTimeout(function() {
                window.location.reload();
              }, 400);
            } else {
              throw new Error('Offline');
            }
          })
          .catch(function() {
            isRetrying = false;
            if (btnRetry) btnRetry.classList.remove('loading');
            if (retryIcon) retryIcon.classList.remove('spinning');
            if (retryLabel) retryLabel.textContent = 'Tentar novamente';
            if (badgeStatus) badgeStatus.classList.remove('online-restored');
            if (badgeText) badgeText.textContent = 'Ainda Sem Conexão';
            if (indicatorText) {
              indicatorText.textContent = manual
                ? 'Sem conexão no momento. Tente novamente em instantes.'
                : 'Aguardando sinal para reconectar automaticamente...';
            }
          });
      }

      if (btnRetry) {
        btnRetry.addEventListener('click', function() {
          attemptReload(true);
        });
      }

      if (btnHome) {
        btnHome.addEventListener('click', function() {
          window.location.href = '/';
        });
      }

      window.addEventListener('online', function() {
        attemptReload(false);
      });

      setInterval(function() {
        if (navigator.onLine && !isRetrying) {
          attemptReload(false);
        }
      }, 3500);
    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'offline.html'), htmlContent, 'utf8');
console.log('Successfully generated public/offline.html with inlined GSAP');
