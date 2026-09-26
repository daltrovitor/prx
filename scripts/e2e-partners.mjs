// Hello World
// Teste ponta a ponta do programa de parceiros (requer `npm run dev` sem Supabase,
// com as contas de demonstração). Uso: BASE=http://localhost:3000 node scripts/e2e-partners.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failures = 0;
const check = (name, cond, extra = "") => {
  if (!cond) failures += 1;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
};

/** Cliente HTTP com cookie de sessão próprio (um por papel). */
function client() {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    const session = set.find((c) => c.startsWith("prx_session="));
    if (session) cookie = session.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data };
  };
}

const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const plus = (days) => new Date(Date.now() + days * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const stamp = Date.now().toString(36);

const summary = {
  benefitTitle: `Café grátis ${stamp}`,
  benefitDescription: "Um café coado de 200 ml grátis por membro, no balcão da loja.",
  eligibleItem: "Café coado 200 ml",
  categoryId: "gastronomia",
  normalPrice: 9,
  offerKind: "preco",
  prxPrice: 0,
  discountPercent: null,
  giftDescription: "",
  catalogLabel: "",
  quantity: 2,
  quantityUnit: "unidades",
  perUserLimit: 1,
  startDate: today,
  endDate: plus(30),
  channels: "Loja Setor Bueno, Goiânia/GO",
  redemptionModes: ["qr_presencial"],
  usageDeadlineDays: 7,
  earlyEndOnSellOut: false,
  exclusive: true,
  exclusivityMonths: 3,
  plan: "spotlight",
  mediaPeriods: 1,
  mediaPrice: 299,
  commission: "Sem comissão",
  minPrxLevel: 1,
  rules: [],
};

const representative = { name: "Marina Alves", document: "52998224725", role: "Sócia-administradora", email: "marina@aurora.dev", phone: "62999990000" };
const contact = { name: "Loja Bueno", phone: "6233330000", email: "loja@aurora.dev" };

const admin = client();
const partnerA = client();
const partnerB = client();
const member = client();

// ---------- Admin cadastra dois parceiros ----------
check("admin login", (await admin("/api/admin/login", { method: "POST", body: { email: "admin@prx.dev", password: "AdminPrx2026!" } })).status === 200);

const invalid = await admin("/api/admin/partners", {
  method: "POST",
  body: { partner: { tradeName: "Loja Xis", legalName: "Xis LTDA", document: "11.222.333/0001-80", categoryId: "gastronomia", location: "Goiânia" } },
});
check("CNPJ inválido é recusado", invalid.status === 400 && /CNPJ ou CPF inválido/.test(invalid.data.error || ""), invalid.data.error);

const emailA = `aurora-${stamp}@parceiro.dev`;
const createdA = await admin("/api/admin/partners", {
  method: "POST",
  body: {
    partner: { tradeName: `Café Aurora ${stamp}`, legalName: "Aurora Cafeteria LTDA", document: "11.222.333/0001-81", categoryId: "gastronomia", location: "Goiânia, GO", representative, contact },
    access: { mode: "create", email: emailA, name: "Marina Alves" },
  },
});
check("parceiro A criado com login e senha temporária", createdA.status === 200 && Boolean(createdA.data.temporaryPassword), createdA.data.error);
const partnerAId = createdA.data.partner?.id;

// B usa uma conta PRX comum, criada pelo cadastro público e depois vinculada.
const emailB = `burger-${stamp}@parceiro.dev`;
const passwordB = "Burger2026!x";
await client()("/api/auth/signup", { method: "POST", body: { fullName: "Rafael Burger", email: emailB, password: passwordB } });
const createdB = await admin("/api/admin/partners", {
  method: "POST",
  body: {
    partner: { tradeName: `Burger B ${stamp}`, legalName: "Rafael Burger", document: "529.982.247-25", categoryId: "gastronomia", location: "Goiânia, GO" },
    access: { mode: "link", email: emailB },
  },
});
check("parceiro B criado vinculando conta existente (CPF)", createdB.status === 200 && createdB.data.partner?.documentType === "CPF", createdB.data.error);

const dup = await admin("/api/admin/partners/access", { method: "POST", body: { partnerId: partnerAId, mode: "link", email: emailB } });
check("um login não pode servir a dois parceiros", dup.status === 409, dup.data.error);

// ---------- Contrato (cláusula 3) ----------
const campaign = await admin("/api/admin/campaigns", { method: "POST", body: { partnerId: partnerAId, summary, send: true } });
check("formulário gera contrato e envia para aceite", campaign.status === 200 && campaign.data.campaign?.status === "sent", campaign.data.error);
const campaignId = campaign.data.campaign?.id;

const badSummary = await admin("/api/admin/campaigns", { method: "POST", body: { partnerId: partnerAId, summary: { ...summary, exclusivityMonths: 4 } } });
check("exclusividade acima de 3 meses é recusada", badSummary.status === 400, badSummary.data.error);

const draftDoc = await admin(`/api/partners/document?campaignId=${campaignId}&kind=contract`);
check(
  "contrato individual renderiza com o parceiro e a cláusula 3",
  draftDoc.status === 200 && draftDoc.data.includes("Aurora Cafeteria LTDA, CNPJ nº 11.222.333/0001-81") && draftDoc.data.includes("Quantidade total garantida") && draftDoc.data.includes("Minuta"),
);

// ---------- Aceite pelo parceiro A ----------
check("parceiro A entra com a senha temporária", (await partnerA("/api/partner/login", { method: "POST", body: { email: emailA, password: createdA.data.temporaryPassword } })).status === 200);
const listA = await partnerA("/api/partner/campaigns");
const pending = listA.data.campaigns?.find((c) => c.id === campaignId);
check("parceiro A vê o contrato pendente com hash", pending?.status === "sent" && /^[0-9a-f]{64}$/.test(pending?.contractHash || ""));

const wrongPass = await partnerA("/api/partner/campaigns", {
  method: "POST",
  body: { campaignId, version: pending.version, contentHash: pending.contractHash, declarationAccepted: true, password: "errada" },
});
check("aceite exige a senha correta", wrongPass.status === 401, wrongPass.data.error);

const staleHash = await partnerA("/api/partner/campaigns", {
  method: "POST",
  body: { campaignId, version: pending.version, contentHash: "0".repeat(64), declarationAccepted: true, password: createdA.data.temporaryPassword },
});
check("aceite de versão diferente da exibida é recusado", staleHash.status === 409, staleHash.data.error);

const accepted = await partnerA("/api/partner/campaigns", {
  method: "POST",
  body: { campaignId, version: pending.version, contentHash: pending.contractHash, declarationAccepted: true, password: createdA.data.temporaryPassword },
});
check("aceite registrado com certificado", accepted.status === 200 && /^PRX-CERT-\d{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(accepted.data.certificateId || ""), accepted.data.error);
check("benefício publicado no aceite", accepted.data.benefitPublished === true);

const editAfter = await admin("/api/admin/campaigns", { method: "PUT", body: { id: campaignId, summary: { ...summary, quantity: 500 } } });
check("contrato aceito não pode ser editado", editAfter.status === 409, editAfter.data.error);

const cert = await partnerA(`/api/partners/document?campaignId=${campaignId}&kind=certificate`);
check("certificado da campanha disponível ao parceiro", cert.status === 200 && cert.data.includes(accepted.data.certificateId) && cert.data.includes("Spotlight"));
const acceptedDoc = await admin(`/api/partners/document?campaignId=${campaignId}&kind=contract`);
check("contrato aceito verifica integridade pelo hash", acceptedDoc.status === 200 && acceptedDoc.data.includes("Integridade verificada") && acceptedDoc.data.includes("IP de origem"));
const docB = await partnerB(`/api/partners/document?campaignId=${campaignId}&kind=contract`);
check("parceiro B entra", (await partnerB("/api/partner/login", { method: "POST", body: { email: emailB, password: passwordB } })).status === 200);
const docB2 = await partnerB(`/api/partners/document?campaignId=${campaignId}&kind=contract`);
check("parceiro B não abre contrato do parceiro A", docB.status === 401 && docB2.status === 404);

// ---------- Membro resgata ----------
check("membro entra", (await member("/api/auth/login", { method: "POST", body: { email: "membro@prx.dev", password: "Prx2026!" } })).status === 200);
const catalog = await member("/api/pass/data");
const benefit = catalog.data.benefits?.find((b) => b.campaignId === campaignId);
check("benefício aparece no catálogo, patrocinado e dono = parceiro A", Boolean(benefit) && benefit.sponsored === true && benefit.partnerId === partnerAId);

await member("/api/pass/events", { method: "POST", body: { impressions: [benefit.id], click: benefit.id } });
const redeem = await member("/api/pass/redeem", { method: "POST", body: { benefitId: benefit.id } });
const code = redeem.data.voucher?.code;
check("membro gera voucher com prazo de uso", redeem.status === 200 && Boolean(code) && Boolean(redeem.data.voucher?.expiresAt), redeem.data.error);

// ---------- Só o parceiro dono escaneia ----------
const lookupB = await partnerB("/api/partner/validate", { method: "POST", body: { code: `PRX_PASS::${code}::x`, action: "lookup" } });
check("parceiro B NÃO consegue ler o QR do parceiro A", lookupB.status === 403 && !lookupB.data.voucher, lookupB.data.error);
const redeemB = await partnerB("/api/partner/validate", { method: "POST", body: { code, action: "redeem" } });
check("parceiro B NÃO consegue dar baixa", redeemB.status === 403);
const historyB = await partnerB("/api/partner/validate");
check("histórico do parceiro B não mostra vouchers do A", !historyB.data.vouchers?.some((v) => v.code === code));

const lookupA = await partnerA("/api/partner/validate", { method: "POST", body: { code, action: "lookup" } });
check("parceiro A lê o QR e vê só o primeiro nome", lookupA.status === 200 && lookupA.data.voucher?.userName === "Membro" && !("userEmail" in lookupA.data.voucher));
const redeemA = await partnerA("/api/partner/validate", { method: "POST", body: { code, action: "redeem" } });
check("parceiro A dá baixa", redeemA.status === 200 && redeemA.data.voucher?.status === "used", redeemA.data.error);
const again = await partnerA("/api/partner/validate", { method: "POST", body: { code, action: "redeem" } });
check("baixa dupla é recusada", again.status === 400);

const secondRedeem = await member("/api/pass/redeem", { method: "POST", body: { benefitId: benefit.id } });
check("limite por usuário é aplicado", secondRedeem.status === 409, secondRedeem.data.error);

// ---------- Métricas agregadas ----------
const metrics = await partnerA("/api/partner/metrics?days=30");
const m = metrics.data.metrics;
check(
  "métricas agregadas do parceiro A",
  metrics.status === 200 && m.impressions === 1 && m.clicks === 1 && m.redemptions === 1 && m.validations === 1 && m.ctr === 1,
  JSON.stringify({ i: m?.impressions, c: m?.clicks, r: m?.redemptions, v: m?.validations }),
);
check("faixas etárias suprimidas abaixo de 5 pessoas", m.redemptionsByAge.every((b) => b.suppressed && b.share === null));
check("progresso da quantidade garantida", metrics.data.campaigns?.[0]?.redeemed === 1 && metrics.data.campaigns?.[0]?.quantity === 2);
const metricsB = await partnerB("/api/partner/metrics?days=30");
check("parceiro B não vê métricas do A", metricsB.data.metrics?.redemptions === 0);

// ---------- Parceiro completa o cadastro e a quantidade garantida trava o excedente ----------
const campaignB = await admin("/api/admin/campaigns", {
  method: "POST",
  body: { partnerId: createdB.data.partner?.id, summary: { ...summary, benefitTitle: `Burger 1 unidade ${stamp}`, quantity: 1, plan: "basico", mediaPrice: 0 }, send: true },
});
const listB = await partnerB("/api/partner/campaigns");
const pendingB = listB.data.campaigns?.find((c) => c.id === campaignB.data.campaign?.id);
check("contrato bloqueado enquanto falta o representante", pendingB?.missing?.includes("CPF do representante"));
const blocked = await partnerB("/api/partner/campaigns", {
  method: "POST",
  body: { campaignId: pendingB.id, version: pendingB.version, contentHash: pendingB.contractHash, declarationAccepted: true, password: passwordB },
});
check("aceite recusado com cadastro incompleto", blocked.status === 422, blocked.data.error);
const profile = await partnerB("/api/partner/profile", { method: "PUT", body: { representative: { ...representative, name: "Rafael Burger" }, contact } });
check("parceiro completa representante e contato no portal", profile.status === 200 && profile.data.missing?.length === 0, profile.data.error);
const refreshedB = (await partnerB("/api/partner/campaigns")).data.campaigns.find((c) => c.id === pendingB.id);
check("hash do contrato muda com o novo representante", refreshedB.contractHash !== pendingB.contractHash);
const acceptedB = await partnerB("/api/partner/campaigns", {
  method: "POST",
  body: { campaignId: refreshedB.id, version: refreshedB.version, contentHash: refreshedB.contractHash, declarationAccepted: true, password: passwordB },
});
check("parceiro B aceita depois de completar", acceptedB.status === 200, acceptedB.data.error);
const burger = (await member("/api/pass/data")).data.benefits?.find((b) => b.campaignId === refreshedB.id);
check("plano Básico não aparece como patrocinado", burger && burger.sponsored === false);
check("primeira unidade resgatada", (await member("/api/pass/redeem", { method: "POST", body: { benefitId: burger.id } })).status === 200);
const member2 = client();
await member2("/api/auth/signup", { method: "POST", body: { fullName: "Segundo Membro", email: `m2-${stamp}@prx.dev`, password: "Prx2026!x" } });
const soldOut = await member2("/api/pass/redeem", { method: "POST", body: { benefitId: burger.id } });
check("quantidade garantida esgotada trava o próximo resgate", soldOut.status === 409 && /esgotou/.test(soldOut.data.error || ""), soldOut.data.error);

// ---------- Encerramento ----------
const cancel = await admin("/api/admin/campaigns", { method: "PATCH", body: { id: campaignId, action: "cancel", reason: "Teste automatizado" } });
check("admin encerra a campanha", cancel.status === 200, cancel.data.error);
const after = await member("/api/pass/data");
check("benefício sai do catálogo ao encerrar", !after.data.benefits?.some((b) => b.campaignId === campaignId));
const stillCert = await partnerA(`/api/partners/document?campaignId=${campaignId}&kind=certificate`);
check("aceite e certificado continuam disponíveis após o encerramento", stillCert.status === 200);

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} passaram`);
process.exit(failures > 0 ? 1 : 0);
