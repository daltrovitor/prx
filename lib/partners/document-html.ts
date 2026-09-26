// Hello World
import { formatDocument } from "@/lib/partners/documents";
import { PRX_OPERATOR, TERMS_ID, formatDateBR, formatDateTimeBR, type ContractBlock } from "@/lib/partners/contract";
import { REDEMPTION_MODES, VISIBILITY_PLANS, describeOffer, formatMoney, mediaBillingText } from "@/lib/partners/plans";
import type { ContractView } from "@/lib/partners/service";

/**
 * Documentos imprimíveis (Ctrl+P → Salvar como PDF): contrato integral e
 * Certificado da Campanha. Todo texto passa por esc(); a rota serve com CSP
 * sem rede externa e script só por nonce.
 */

export type DocumentAudience = "admin" | "partner";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLES = `
:root{--ink:#0b0b10;--muted:#5b5b66;--line:#e7e7ec;--surface:#f7f7f9;--accent:#6c0cf0;--success:#0f7b4f;--warning:#8a5300}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--ink)}
body{font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
::selection{background:var(--accent);color:#fff}
main{max-width:780px;margin:0 auto;padding:48px 24px 72px}
.bar{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:32px}
.brand{font-weight:700;letter-spacing:-.02em;font-size:18px}
button{font:inherit;font-size:14px;min-height:44px;padding:0 16px;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:3px;cursor:pointer}
button:hover{border-color:var(--ink)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1{font-size:26px;line-height:1.15;letter-spacing:-.03em;margin:0}
.subtitle{color:var(--muted);margin:8px 0 0}
.meta{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);margin-top:16px;word-break:break-all}
.status{border-left:2px solid;padding:10px 14px;margin:24px 0 8px;font-size:14px}
.status.ok{border-color:var(--success);background:#0f7b4f0d;color:var(--success)}
.status.draft{border-color:var(--warning);background:#8a53000f;color:var(--warning)}
.status.bad{border-color:#c8102e;background:#c8102e0d;color:#c8102e}
h2{font-size:15px;letter-spacing:.01em;margin:32px 0 8px}
p{margin:0 0 10px}
ul{margin:0 0 10px;padding-left:20px}
table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{width:38.2%;background:var(--surface);font-weight:600}
.evidence{margin-top:40px;border-top:1px solid var(--line);padding-top:20px}
.evidence dl{display:grid;grid-template-columns:minmax(140px,38.2%) 1fr;gap:6px 16px;margin:0;font-size:13px}
.evidence dt{color:var(--muted)}
.evidence dd{margin:0;word-break:break-word}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.cert{border:1px solid var(--ink);padding:40px 36px}
.cert-id{font:600 22px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;margin:18px 0 28px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 28px}
.grid .full{grid-column:1/-1}
.label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.value{font-size:15px;margin-top:2px}
.foot{margin-top:28px;font-size:12px;color:var(--muted)}
@media (max-width:560px){main{padding:28px 16px 48px}.grid{grid-template-columns:1fr}.evidence dl{grid-template-columns:1fr}.cert{padding:24px 18px}}
@media print{.bar button{display:none}main{padding:0;max-width:none}.bar{margin-bottom:20px}@page{size:A4;margin:16mm}}
`;

function page(title: string, nonce: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style nonce="${nonce}">${STYLES}</style>
</head>
<body>
<main>
<div class="bar"><span class="brand">PRX PASS</span><button type="button" id="print">Imprimir ou salvar em PDF</button></div>
${body}
</main>
<script nonce="${nonce}">document.getElementById("print").addEventListener("click",function(){window.print()});</script>
</body>
</html>`;
}

function renderBlock(block: ContractBlock): string {
  if (block.kind === "paragraph") return `<p>${esc(block.text)}</p>`;
  if (block.kind === "list") return `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
  return `<table><tbody>${block.rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join("")}</tbody></table>`;
}

function statusBanner(view: ContractView): string {
  if (view.acceptance) {
    const integrity = view.verified
      ? "Integridade verificada: o texto abaixo corresponde ao hash registrado no aceite."
      : "Atenção: o texto re-gerado não corresponde ao hash do aceite. Consulte a equipe PRX.";
    return `<div class="status ${view.verified ? "ok" : "bad"}">Aceito eletronicamente em ${esc(formatDateTimeBR(view.acceptance.acceptedAt))} · Certificado ${esc(view.acceptance.certificateId)}.<br>${esc(integrity)}</div>`;
  }
  if (view.campaign.status === "cancelled") return `<div class="status bad">Campanha cancelada${view.campaign.cancelReason ? `: ${esc(view.campaign.cancelReason)}` : ""}. Este documento não foi aceito.</div>`;
  return `<div class="status draft">Minuta — aguardando aceite eletrônico do representante do parceiro na Área do Parceiro.</div>`;
}

function evidence(view: ContractView, audience: DocumentAudience): string {
  const a = view.acceptance;
  if (!a) return "";
  const rows: Array<[string, string, boolean?]> = [
    ["Instrumento", view.campaign.id, true],
    ["Versão do Termo", a.termsVersion],
    ["Versão do Resumo Comercial", String(a.campaignVersion)],
    ["Hash SHA-256 do contrato", a.contentHash, true],
    ["Data e hora do aceite", `${formatDateTimeBR(a.acceptedAt)} · ${a.acceptedAt} (UTC)`],
    ["Usuário autenticado", a.userEmail],
    ["Empresa", `${a.partnerSnapshot.legalName} · ${a.partnerSnapshot.documentType} ${formatDocument(a.partnerSnapshot.documentType, a.partnerSnapshot.document)}`],
    ["Representante", `${a.partnerSnapshot.representative.name} · CPF ${formatDocument("CPF", a.partnerSnapshot.representative.document)}`],
    ["Método de autenticação", a.authMethod],
    ["Declaração aceita", a.declaration],
  ];
  if (audience === "admin") {
    rows.push(["IP de origem", a.ipAddress || "Não informado"], ["Navegador", a.userAgent || "Não informado"], ["ID do registro", a.id, true]);
  }
  return `<section class="evidence" aria-labelledby="ev"><h2 id="ev">REGISTRO DO ACEITE ELETRÔNICO</h2><dl>${rows
    .map(([label, value, mono]) => `<dt>${esc(label)}</dt><dd${mono ? ' class="mono"' : ""}>${esc(value)}</dd>`)
    .join("")}</dl></section>`;
}

export function renderContractHtml(view: ContractView, audience: DocumentAudience, nonce: string): string {
  const doc = view.document;
  const body = `
<header>
<h1>${esc(doc.title)}</h1>
<p class="subtitle">${esc(doc.subtitle)}</p>
<p class="meta">Termo ${esc(TERMS_ID)} · Instrumento ${esc(doc.campaignId)} · Resumo Comercial v${esc(doc.campaignVersion)}<br>SHA-256 ${esc(view.hash)}</p>
</header>
${statusBanner(view)}
${doc.sections.map((s) => `<section><h2>${esc(`${s.number}. ${s.title}`)}</h2>${s.blocks.map(renderBlock).join("")}</section>`).join("")}
${evidence(view, audience)}`;
  return page(`Termo PRX PASS · ${view.partner.tradeName}`, nonce, body);
}

export function renderCertificateHtml(view: ContractView, nonce: string): string | null {
  const a = view.acceptance;
  if (!a) return null;
  const s = a.summarySnapshot;
  const p = a.partnerSnapshot;
  const plan = VISIBILITY_PLANS[s.plan];
  const field = (label: string, value: string, full = false) =>
    `<div${full ? ' class="full"' : ""}><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`;

  const body = `
<div class="cert">
<h1>Certificado da Campanha PRX</h1>
<p class="subtitle">Resumo do Termo de Adesão e Parceria Comercial — PRX PASS aceito eletronicamente.</p>
<div class="cert-id">${esc(a.certificateId)}</div>
<div class="grid">
${field("Empresa", `${p.legalName} (${p.tradeName})`, true)}
${field(p.documentType, formatDocument(p.documentType, p.document))}
${field("Representante", `${p.representative.name}, ${p.representative.role}`)}
${field("Benefício", `${s.benefitTitle} — ${describeOffer(s)}`, true)}
${field("Quantidade garantida", `${s.quantity.toLocaleString("pt-BR")} ${s.quantityUnit} · limite de ${s.perUserLimit} por usuário`)}
${field("Vigência", `${formatDateBR(s.startDate)} a ${formatDateBR(s.endDate)}`)}
${field("Modalidade de uso", s.redemptionModes.map((m) => REDEMPTION_MODES[m].label).join(", "))}
${field("Prazo de uso", `${s.usageDeadlineDays} dias após a aquisição`)}
${field("Exclusividade", s.exclusive ? `Benefício Exclusivo PRX · ${s.exclusivityMonths} ${s.exclusivityMonths === 1 ? "mês" : "meses"} após a campanha` : "Sem exclusividade")}
${field("Plano contratado", `${plan.label} · ${s.mediaPrice === 0 ? "sem custo de mídia" : `${formatMoney(s.mediaPrice)} (${mediaBillingText(s.plan, s.mediaPeriods).toLowerCase()})`}`)}
${field("Aceite", formatDateTimeBR(a.acceptedAt), true)}
${field("Hash SHA-256 do contrato", a.contentHash, true)}
</div>
<p class="foot">Operadora: ${esc(PRX_OPERATOR.legalName)}, CNPJ ${esc(formatDocument("CNPJ", PRX_OPERATOR.document))}. Termo ${esc(a.termsVersion)} · Instrumento ${esc(view.campaign.id)} · Resumo Comercial v${esc(a.campaignVersion)}. Em caso de divergência, prevalece o instrumento integral disponível na Área do Parceiro.</p>
</div>`;
  return page(`Certificado ${a.certificateId}`, nonce, body);
}
