// Hello World
// Teste ponta a ponta da PRX 2.0 (pontos, níveis, Pix em parceiro, Reels, financeiro,
// LGPD e lista VIP). Requer `npm run dev` sem Supabase (contas de demonstração e sandbox).
// Uso: BASE=http://localhost:3000 node scripts/e2e-prx2.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failures = 0;
const check = (name, cond, extra = "") => {
  if (!cond) failures += 1;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
};

function client() {
  let cookie = "";
  return async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
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

const stamp = Date.now().toString(36);
const admin = client();
const member = client();
const anon = client();

// ---------- LGPD: cadastro exige aceite ----------
const noConsent = await anon("/api/auth/signup", { method: "POST", body: { fullName: "Sem Aceite", email: `sem-${stamp}@prx.dev`, password: "Prx2026!x" } });
check("cadastro sem aceite dos termos é recusado", noConsent.status === 400 && /Termos/.test(noConsent.data.error || ""), noConsent.data.error);
const signup = await member("/api/auth/signup", { method: "POST", body: { fullName: "Nova Geração", email: `ng-${stamp}@prx.dev`, password: "Prx2026!x", termsAccepted: true } });
check("cadastro com aceite cria a conta", signup.status === 200, signup.data.error);

// ---------- Carteira de pontos ----------
let wallet = (await member("/api/points")).data.wallet;
check("carteira nasce com 100 PRX Coins", wallet?.coins === 100, JSON.stringify(wallet?.coins));
check("nível derivado do XP (régua infinita)", wallet?.level >= 1);
const weekly = wallet.rules.find((r) => r.trigger === "checkin" && r.periodicity === "weekly");
const claim = await member("/api/points", { method: "POST", body: { action: "checkin", ruleId: weekly.id } });
check("check-in semanal credita coins e XP", claim.status === 200 && claim.data.wallet.coins === 100 + weekly.coins, JSON.stringify(claim.data.earned));
const again = await member("/api/points", { method: "POST", body: { action: "checkin", ruleId: weekly.id } });
check("check-in repetido no período é recusado", again.status === 409, again.data.error);

// ---------- Admin: parceiro, benefício e viabilidade ----------
check("admin login", (await admin("/api/admin/login", { method: "POST", body: { email: "admin@prx.dev", password: "AdminPrx2026!" } })).status === 200);
const partnerInput = {
  tradeName: `Burger Lab ${stamp}`,
  legalName: "Burger Lab Alimentos LTDA",
  document: "04.252.011/0001-10",
  categoryId: "gastronomia",
  location: "São Paulo, SP",
  representative: { name: "Rafa Lima", document: "52998224725", role: "Sócio", email: "rafa@burger.dev", phone: "11999990000" },
  contact: { name: "Caixa", phone: "1133330000", email: `pix-${stamp}@burger.dev` },
};
const created = await admin("/api/admin/partners", { method: "POST", body: { partner: partnerInput } });
const partnerId = created.data.partner?.id;
check("parceiro criado", Boolean(partnerId), created.data.error);
const activated = await admin("/api/admin/partners", { method: "PUT", body: { id: partnerId, partner: { ...partnerInput, status: "ATIVO" } } });
check("parceiro ativo", activated.status === 200 && activated.data.partner?.status === "ATIVO", activated.data.error);

const base = { partnerId, categoryId: "gastronomia", title: `Combo ${stamp}`, discountLabel: "2 por 1", minPrxLevel: 1, terms: [] };
const loss = await admin("/api/admin/benefits", { method: "POST", body: { ...base, costPrice: 20, prxRevenuePerRedemption: 2, partnerFeePct: 8, pointsCost: 100 } });
check("calculadora bloqueia benefício com prejuízo", loss.status === 422 && /viabilidade/.test(loss.data.error || ""), loss.data.error);
const ok = await admin("/api/admin/benefits", { method: "POST", body: { ...base, costPrice: 20, prxRevenuePerRedemption: 2, partnerFeePct: 8, pointsCost: 300 } });
check("benefício com 30% de margem é publicado", ok.status === 200 && ok.data.benefit?.pointsCost === 300, ok.data.error);
const benefitId = ok.data.benefit?.id;

const passData = (await member("/api/pass/data")).data;
const memberBenefit = passData.benefits?.find((b) => b.id === benefitId);
check("membro vê o preço em coins", memberBenefit?.pointsCost === 300);
check("membro não vê custo, receita nem comissão", memberBenefit && !("costPrice" in memberBenefit) && !("prxRevenuePerRedemption" in memberBenefit) && !("partnerFeePct" in memberBenefit));

const poor = await member("/api/pass/redeem", { method: "POST", body: { benefitId } });
check("resgate sem coins suficientes é recusado", poor.status === 409 && /insuficientes/.test(poor.data.error || ""), poor.data.error);

// ---------- PRX Bank sandbox + motor de compra em parceiro ----------
const lookup = await member("/api/bank", { method: "POST", body: { action: "lookup_partner", key: "04252011000110", amount: 250 } });
check("chave CNPJ reconhecida como parceiro", lookup.data.partner?.partnerId === partnerId && lookup.data.partner?.verticalCode === "BITE", JSON.stringify(lookup.data));
const sandbox = await member("/api/bank", { method: "POST", body: { action: "sandbox_activate" } });
check("conta sandbox ativada com saldo fictício", sandbox.status === 200 && sandbox.data.account.status === "active" && sandbox.data.account.balance === 1000);
const pix = await member("/api/bank", { method: "POST", body: { action: "send_pix", key: "04252011000110", amount: 250, description: "Almoço" } });
check("Pix para parceiro credita coins e XP", pix.status === 200 && pix.data.reward?.coins === 250 && pix.data.reward?.xp === 500, JSON.stringify(pix.data.reward ?? pix.data.error));
const categorized = pix.data.account?.transactions?.find((t) => t.kind === "pix_out");
check("gasto categorizado no nicho do parceiro (PRX Map)", categorized?.categoryId === "gastronomia" && categorized?.counterparty?.startsWith("Burger Lab"));
const other = await member("/api/bank", { method: "POST", body: { action: "send_pix", key: `ninguem-${stamp}@exemplo.dev`, amount: 10 } });
check("Pix para quem não é parceiro não pontua", other.status === 200 && other.data.reward === null);

wallet = (await member("/api/points")).data.wallet;
check("extrato registra a compra em parceiro", wallet.purchases.length === 1 && wallet.transactions.some((t) => t.source === "partner_purchase"));

const redeem = await member("/api/pass/redeem", { method: "POST", body: { benefitId } });
check("resgate debita os coins do preço", redeem.status === 200 && redeem.data.points?.coins === wallet.coins - 300, JSON.stringify(redeem.data.points ?? redeem.data.error));

// ---------- Reels ----------
const reel = await admin("/api/admin/reels", {
  method: "POST",
  body: { partnerId, title: "Drop do combo", videoUrl: "https://cdn.prx.app.br/reels/combo.mp4", collection: "drops", ctaKind: "benefit", ctaTarget: benefitId },
});
check("admin publica Reel com botão para o benefício", reel.status === 200, reel.data.error);
const feed = (await member("/api/reels")).data.reels ?? [];
const mine = feed.find((r) => r.id === reel.data.reel?.id);
check("Reel aparece no feed com o botão padrão", mine?.ctaLabel === "Aproveitar Benefício");
check("feed não expõe métricas de negócio", mine && !("views" in mine) && !("ctaClicks" in mine));
const like = await member("/api/reels", { method: "POST", body: { action: "like", reelId: mine?.id } });
check("curtida conta uma vez", like.data.state?.likes === 1 && like.data.state?.liked === true);
await member("/api/reels", { method: "POST", body: { action: "like", reelId: mine?.id } });
const metrics = (await admin("/api/admin/reels")).data.reels?.find((r) => r.id === mine?.id);
check("admin vê curtidas sem duplicar", metrics?.likes === 1);

// ---------- Financeiro ----------
const finance = (await admin("/api/admin/finance?period=30")).data.finance;
check("financeiro soma a comissão da compra em parceiro", finance?.summary.purchaseRevenue >= 20, JSON.stringify(finance?.summary));
check("financeiro lista a viabilidade do benefício", finance?.benefits.some((b) => b.id === benefitId && b.status === "ok"));

// ---------- Lista VIP ----------
const vipBad = await anon("/api/waitlist", { method: "POST", body: { email: "nao-e-email", consent: true } });
check("lista VIP valida o e-mail", vipBad.status === 422);
const vip = await anon("/api/waitlist", { method: "POST", body: { email: `vip-${stamp}@prx.dev`, consent: true } });
check("lista VIP aceita o cadastro", vip.status === 200, vip.data.error);

// ---------- Rotas públicas ----------
for (const path of ["/institucional", "/termos", "/privacidade", "/em-breve"]) {
  check(`rota ${path} abre`, (await anon(path)).status === 200);
}
check("rota desconhecida volta para /", (await anon("/qualquer-coisa")).status === 307);

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} verificações passaram.`);
process.exit(failures ? 1 : 0);
