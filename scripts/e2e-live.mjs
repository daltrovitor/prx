// Hello World
// Teste ponta a ponta do PRX LIVE, da Equipe PRX e da conta PRX BANK pré-ativação
// (requer `npm run dev` sem Supabase, com as contas de demonstração).
// Uso: BASE=http://localhost:3000 node scripts/e2e-live.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failures = 0;
const check = (name, cond, extra = "") => {
  if (!cond) failures += 1;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra && !cond ? `  — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`);
};

/** Cliente HTTP com cookie de sessão próprio (um por papel). */
function client() {
  let cookie = "";
  return async (path, { method = "GET", body, form } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(form ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: form ?? (body ? JSON.stringify(body) : undefined),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    const session = set.find((c) => c.startsWith("prx_session="));
    if (session) cookie = session.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data, type };
  };
}

const stamp = Date.now().toString(36);
const inHours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

const admin = client();
const partner = client();
const staff = client();
const member = client();
const member2 = client();

// ---------- Contas ----------
check("admin entra", (await admin("/api/admin/login", { method: "POST", body: { email: "admin@prx.dev", password: "AdminPrx2026!" } })).status === 200);
check("membro demo entra", (await member("/api/auth/login", { method: "POST", body: { email: "membro@prx.dev", password: "Prx2026!" } })).status === 200);
const signup2 = await member2("/api/auth/signup", { method: "POST", body: { fullName: "Bruna Tavares", email: `bruna-${stamp}@prx.dev`, password: "Prx2026!x" } });
check("segundo membro se cadastra", signup2.status === 200 || signup2.status === 201, signup2.data);

const partnerEmail = `portaria-${stamp}@parceiro.dev`;
const createdPartner = await admin("/api/admin/partners", {
  method: "POST",
  body: {
    partner: { tradeName: `Arena ${stamp}`, legalName: "Arena Eventos LTDA", document: "11.444.777/0001-61", categoryId: "gastronomia", location: "São Paulo, SP" },
    access: { mode: "create", email: partnerEmail, name: "Portaria Arena" },
  },
});
check("admin cria parceiro com login", createdPartner.status === 200 && Boolean(createdPartner.data.temporaryPassword), createdPartner.data.error);
const partnerId = createdPartner.data.partner?.id;
check("parceiro entra no portal", (await partner("/api/partner/login", { method: "POST", body: { email: partnerEmail, password: createdPartner.data.temporaryPassword } })).status === 200);

const staffEmail = `equipe-${stamp}@prx.dev`;
const createdStaff = await admin("/api/admin/staff", { method: "POST", body: { mode: "create", name: "Carla Equipe", email: staffEmail, canValidateTickets: true, canValidateBenefits: false } });
check("admin cria funcionário com senha temporária", createdStaff.status === 201 && Boolean(createdStaff.data.temporaryPassword), createdStaff.data.error);
const staffId = createdStaff.data.staff?.id;
const dupStaff = await admin("/api/admin/staff", { method: "POST", body: { mode: "link", name: "Carla", email: staffEmail } });
check("mesmo e-mail não entra duas vezes na equipe", dupStaff.status === 409, dupStaff.data.error);
const partnerAsStaff = await admin("/api/admin/staff", { method: "POST", body: { mode: "link", name: "Arena", email: partnerEmail } });
check("login de parceiro não vira funcionário", partnerAsStaff.status === 409, partnerAsStaff.data.error);
check("membro comum não entra no portal da equipe", (await client()("/api/staff/login", { method: "POST", body: { email: "membro@prx.dev", password: "Prx2026!" } })).status === 403);
check("funcionário entra no portal da equipe", (await staff("/api/staff/login", { method: "POST", body: { email: staffEmail, password: createdStaff.data.temporaryPassword } })).status === 200);
const staffMe = await staff("/api/staff/me");
check("sessão da equipe traz as permissões", staffMe.data.isStaff && staffMe.data.user?.canValidateTickets === true && staffMe.data.user?.canValidateBenefits === false, staffMe.data);

// ---------- Eventos ----------
const baseEvent = { summary: "Evento de teste automatizado do PRX LIVE.", venue: "Arena Zona Oeste", city: "São Paulo, SP", perUserLimit: 1 };
const evA = await admin("/api/admin/live/events", {
  method: "POST",
  body: {
    ...baseEvent,
    series: "session",
    title: `Session ${stamp}`,
    startsAt: inHours(2),
    capacity: 3,
    partnerId,
    staffCheckin: false,
    status: "published",
    batches: [
      { id: "vip", name: "VIP", price: 50, quantity: 1 },
      { id: "free", name: "Entrada", price: 0 },
    ],
  },
});
check("admin cria evento ligado ao parceiro, já publicado", evA.status === 201 && evA.data.event?.partnerName === `Arena ${stamp}`, evA.data.error);
const eventA = evA.data.event;
const evB = await admin("/api/admin/live/events", {
  method: "POST",
  body: { ...baseEvent, series: "talks", title: `Talks ${stamp}`, startsAt: inHours(3), staffCheckin: true, status: "published", batches: [{ id: "free", name: "Entrada", price: 0 }] },
});
check("admin cria evento com portaria da equipe", evB.status === 201, evB.data.error);
const eventB = evB.data.event;
const evDraft = await admin("/api/admin/live/events", { method: "POST", body: { ...baseEvent, series: "ctrl", title: `Rascunho ${stamp}`, startsAt: inHours(48), batches: [{ id: "b1", name: "Lote", price: 10 }] } });
check("evento nasce como rascunho por padrão", evDraft.status === 201 && evDraft.data.event?.status === "draft", evDraft.data.error);
const badEvent = await admin("/api/admin/live/events", { method: "POST", body: { ...baseEvent, series: "run", title: "RUN sem config", startsAt: inHours(10), batches: [{ id: "b", name: "L", price: 0 }] } });
check("RUN sem distâncias é recusada", badEvent.status === 400, badEvent.data.error);

const agenda = await member("/api/live");
check("membro vê os publicados e não vê rascunho", agenda.status === 200 && agenda.data.events.some((e) => e.id === eventA.id) && !agenda.data.events.some((e) => e.id === evDraft.data.event?.id), agenda.data.error);
check("vitrine não expõe dados internos", agenda.data.events.every((e) => !("createdBy" in e) && !("partnerId" in e)));

// ---------- Reservas ----------
const reserveVip = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: eventA.id, batchId: "vip" } });
check("lote pago vira reserva aguardando pagamento", reserveVip.status === 201 && reserveVip.data.ticket?.status === "pending_payment" && Boolean(reserveVip.data.ticket?.holdUntil), reserveVip.data.error);
const soldOut = await member2("/api/live", { method: "POST", body: { action: "reserve", eventId: eventA.id, batchId: "vip" } });
check("lote com 1 unidade esgota para o próximo", soldOut.status === 409 && /esgot/i.test(soldOut.data.error || ""), soldOut.data.error);
const limit = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: eventA.id, batchId: "free" } });
check("limite de 1 ingresso por pessoa", limit.status === 409, limit.data.error);
const cancelOwn = await member("/api/live", { method: "POST", body: { action: "cancel", ticketId: reserveVip.data.ticket.id } });
check("membro desiste da reserva e libera o lugar", cancelOwn.status === 200 && cancelOwn.data.wallet.tickets.find((t) => t.id === reserveVip.data.ticket.id)?.status === "cancelled", cancelOwn.data.error);
const vip2 = await member2("/api/live", { method: "POST", body: { action: "reserve", eventId: eventA.id, batchId: "vip" } });
check("lugar liberado vai para o próximo membro", vip2.status === 201, vip2.data.error);
const free1 = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: eventA.id, batchId: "free" } });
check("ingresso gratuito sai válido na hora com QR", free1.status === 201 && free1.data.ticket?.status === "valid" && free1.data.ticket?.qrPayload?.startsWith("PRX_LIVE::UP-"), free1.data.error);
const draftReserve = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: evDraft.data.event?.id, batchId: "b1" } });
check("rascunho não aceita reserva", draftReserve.status === 404, draftReserve.data.error);

// ---------- Portaria: parceiro ----------
const pendingLookup = await partner("/api/validate", { method: "POST", body: { code: vip2.data.ticket.code, action: "lookup" } });
check("reserva sem pagamento não libera entrada", pendingLookup.status === 200 && pendingLookup.data.canCheckin === false && /Pagamento pendente/.test(pendingLookup.data.warning || ""), pendingLookup.data);
const confirmPay = await admin("/api/admin/live/tickets", { method: "POST", body: { action: "confirm_payment", ticketId: vip2.data.ticket.id } });
check("admin confirma o pagamento", confirmPay.status === 200 && confirmPay.data.ticket?.status === "valid", confirmPay.data.error);
const lookup = await partner("/api/validate", { method: "POST", body: { code: free1.data.ticket.qrPayload, action: "lookup" } });
check("parceiro consulta o QR do ingresso do evento dele", lookup.status === 200 && lookup.data.kind === "ticket" && lookup.data.canCheckin === true, lookup.data);
check("parceiro vê só primeiro nome e inicial", lookup.data.ticket?.holderName === "Membro D.", lookup.data.ticket?.holderName);
const checkin = await partner("/api/validate", { method: "POST", body: { code: free1.data.ticket.code, action: "confirm" } });
check("parceiro libera a entrada", checkin.status === 200 && checkin.data.ticket?.status === "used", checkin.data);
const again = await partner("/api/validate", { method: "POST", body: { code: free1.data.ticket.code, action: "confirm" } });
check("mesmo ingresso não entra duas vezes", again.status === 400 && /já foi utilizado/.test(again.data.error || ""), again.data);
const partnerHistory = await partner("/api/validate");
check("histórico do parceiro mostra a entrada", partnerHistory.data.history?.some((h) => h.kind === "ticket" && h.ticket.code === free1.data.ticket.code), partnerHistory.data);
const partnerEvents = await partner("/api/partner/events");
check("aba Eventos do parceiro lista o evento ligado", partnerEvents.status === 200 && partnerEvents.data.events.length === 1 && partnerEvents.data.events[0].stats.used === 1, partnerEvents.data);

// ---------- Portaria: equipe ----------
const staffOnA = await staff("/api/validate", { method: "POST", body: { code: vip2.data.ticket.code, action: "lookup" } });
check("equipe não valida evento sem portaria da equipe", staffOnA.status === 403, staffOnA.data);
const freeB = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: eventB.id, batchId: "free" } });
check("membro garante ingresso do segundo evento", freeB.status === 201, freeB.data.error);
const partnerOnB = await partner("/api/validate", { method: "POST", body: { code: freeB.data.ticket.code, action: "lookup" } });
check("parceiro não valida evento de outro", partnerOnB.status === 403, partnerOnB.data);
const staffCheckin = await staff("/api/validate", { method: "POST", body: { code: freeB.data.ticket.qrPayload, action: "confirm" } });
check("equipe libera entrada no evento com portaria da equipe", staffCheckin.status === 200 && staffCheckin.data.ticket?.checkedInBy?.includes("Carla Equipe"), staffCheckin.data);
check("equipe vê o nome completo", staffCheckin.data.ticket?.holderName === "Membro Demo", staffCheckin.data.ticket?.holderName);
const staffVoucher = await staff("/api/validate", { method: "POST", body: { code: "PRX-0000-0000", action: "lookup" } });
check("equipe sem permissão de benefícios não consulta vouchers", staffVoucher.status === 403, staffVoucher.data);
const staffEvents = await staff("/api/staff/events");
check("aba Eventos da equipe lista só eventos liberados", staffEvents.status === 200 && staffEvents.data.events.some((e) => e.event.id === eventB.id) && !staffEvents.data.events.some((e) => e.event.id === eventA.id), staffEvents.data);

// ---------- Admin ----------
const invite = await admin("/api/admin/live/tickets", { method: "POST", body: { action: "invite", eventId: eventB.id, email: "membro@prx.dev", note: "Convidado da banca" } });
check("admin emite convite (cortesia) para um membro", invite.status === 201 && invite.data.ticket?.source === "invite" && invite.data.ticket?.status === "valid", invite.data.error);
const inviteUnknown = await admin("/api/admin/live/tickets", { method: "POST", body: { action: "invite", eventId: eventB.id, email: `ninguem-${stamp}@prx.dev` } });
check("convite exige conta PRX", inviteUnknown.status === 404, inviteUnknown.data.error);
const adminCheckin = await admin("/api/admin/live/tickets", { method: "POST", body: { action: "checkin", code: invite.data.ticket.code } });
check("admin faz check-in manual", adminCheckin.status === 200, adminCheckin.data.error);
const attendees = await admin(`/api/admin/live/tickets?eventId=${eventA.id}`);
check("lista do admin traz números do evento", attendees.status === 200 && attendees.data.stats.used === 1 && attendees.data.stats.valid === 1 && attendees.data.stats.confirmedRevenue === 50, attendees.data.stats);
const delWithTickets = await admin(`/api/admin/live/events?id=${eventA.id}`, { method: "DELETE" });
check("evento com ingressos não pode ser excluído", delWithTickets.status === 409, delWithTickets.data.error);
const removeBatch = await admin("/api/admin/live/events", { method: "PUT", body: { id: eventA.id, action: "update", event: { ...baseEvent, series: "session", title: eventA.title, startsAt: eventA.startsAt, partnerId, batches: [{ id: "free", name: "Entrada", price: 0 }] } } });
check("lote com ingressos não pode sumir", removeBatch.status === 409, removeBatch.data.error);
const delDraft = await admin(`/api/admin/live/events?id=${evDraft.data.event.id}`, { method: "DELETE" });
check("rascunho sem ingressos é excluído", delDraft.status === 200, delDraft.data.error);
const cancelB = await admin("/api/admin/live/events", { method: "PUT", body: { id: eventB.id, action: "status", status: "cancelled" } });
check("admin cancela evento", cancelB.status === 200 && cancelB.data.event?.status === "cancelled", cancelB.data.error);
const reopen = await admin("/api/admin/live/events", { method: "PUT", body: { id: eventB.id, action: "status", status: "published" } });
check("evento cancelado não reabre", reopen.status === 409, reopen.data.error);

// ---------- PRX RUN ----------
const run = await admin("/api/admin/live/events", {
  method: "POST",
  body: {
    ...baseEvent,
    series: "run",
    title: `RUN ${stamp}`,
    startsAt: inHours(20),
    status: "published",
    batches: [{ id: "geral", name: "Inscrição", price: 0 }],
    run: { modalities: ["5k", "10k"], categories: ["Geral", "Sub-23"], kitPickup: "Loja parceira, sexta 10h-20h" },
  },
});
check("admin cria etapa da PRX RUN", run.status === 201, run.data.error);
const noTerms = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: run.data.event.id, batchId: "geral", run: { modality: "5k", category: "Geral", shirtSize: "M", acceptedTerms: false } } });
check("inscrição sem aceite do termo é recusada", noTerms.status === 422, noTerms.data.error);
const wrongDistance = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: run.data.event.id, batchId: "geral", run: { modality: "42k", category: "Geral", shirtSize: "M", acceptedTerms: true } } });
check("distância fora da etapa é recusada", wrongDistance.status === 422, wrongDistance.data.error);
const runTicket = await member("/api/live", { method: "POST", body: { action: "reserve", eventId: run.data.event.id, batchId: "geral", run: { modality: "10k", category: "Sub-23", shirtSize: "M", acceptedTerms: true } } });
check("inscrição na RUN gera código RUN com dados do atleta", runTicket.status === 201 && runTicket.data.ticket?.code?.startsWith("RUN-") && runTicket.data.ticket?.runDetails?.modality === "10k", runTicket.data.error);
const resultsBad = await admin("/api/admin/live/events", { method: "PUT", body: { id: run.data.event.id, action: "results", text: "primeiro;Ana" } });
check("resultado com linha inválida é recusado", resultsBad.status === 422, resultsBad.data.error);
const resultsOk = await admin("/api/admin/live/events", { method: "PUT", body: { id: run.data.event.id, action: "results", text: "1;Ana Souza;Sub-23;10k;38:12\n2;Bruno Lima;Geral;10k;39:05" } });
check("admin publica resultados", resultsOk.status === 200 && resultsOk.data.count === 2, resultsOk.data.error);

// ---------- PRX FOUNDERS ----------
const pdf = new Blob([new TextEncoder().encode("%PDF-1.4\n% deck de teste\n")], { type: "application/pdf" });
const form = () => {
  const f = new FormData();
  f.set("startupName", `Startup ${stamp}`);
  f.set("oneLiner", "Plataforma que conecta jovens a primeiros empregos com mentoria.");
  f.set("stage", "mvp");
  f.set("videoUrl", "");
  f.set("deck", pdf, "pitch.pdf");
  return f;
};
const fake = new FormData();
fake.set("startupName", "Fake");
fake.set("oneLiner", "Arquivo que não é PDF de verdade para testar a checagem.");
fake.set("stage", "ideia");
fake.set("deck", new Blob(["nada"], { type: "application/pdf" }), "x.pdf");
check("arquivo que não é PDF é recusado", (await member2("/api/live/founders", { method: "POST", form: fake })).status === 422);
const founders = await member("/api/live/founders", { method: "POST", form: form() });
check("membro envia startup com pitch deck", founders.status === 201 && founders.data.submission?.hasDeck === true, founders.data.error);
check("segunda startup em análise é recusada", (await member("/api/live/founders", { method: "POST", form: form() })).status === 409);
const list = await admin("/api/admin/live/founders");
const submission = list.data.submissions?.find((s) => s.startupName === `Startup ${stamp}`);
check("admin vê a submissão", Boolean(submission), list.data.error);
const deck = await admin(`/api/admin/live/founders?deck=${submission?.id}`);
check("admin abre o PDF", deck.status === 200 && deck.type.includes("application/pdf"));
check("membro não abre o PDF", (await member(`/api/admin/live/founders?deck=${submission?.id}`)).status === 403);
const review = await admin("/api/admin/live/founders", { method: "PUT", body: { id: submission?.id, status: "review", adminNote: "Gostamos da tração." } });
check("admin move para análise com retorno", review.status === 200, review.data.error);
const walletAfter = await member("/api/live");
const mySub = walletAfter.data.wallet.submissions.find((s) => s.id === submission?.id);
check("membro vê a etapa e o retorno", mySub?.status === "review" && mySub?.adminNote === "Gostamos da tração." && !("deckPath" in mySub), mySub);

// ---------- Equipe: desativação ----------
const off = await admin("/api/admin/staff", { method: "PUT", body: { id: staffId, active: false } });
check("admin desativa funcionário", off.status === 200 && off.data.staff?.active === false, off.data.error);
check("funcionário desativado perde a portaria na hora", (await staff("/api/validate")).status === 403);
check("funcionário desativado não entra de novo", (await client()("/api/staff/login", { method: "POST", body: { email: staffEmail, password: createdStaff.data.temporaryPassword } })).status === 403);
const on = await admin("/api/admin/staff", { method: "PUT", body: { id: staffId, active: true } });
check("admin reativa funcionário", on.status === 200 && on.data.staff?.active === true, on.data.error);
check("admin também entra no portal da equipe", (await client()("/api/staff/login", { method: "POST", body: { email: "admin@prx.dev", password: "AdminPrx2026!" } })).status === 200);

// ---------- PRX BANK pré-ativação ----------
const bank = await member2("/api/bank");
check("conta nasce zerada, em ativação e sem extrato", bank.status === 200 && bank.data.account.status === "pending_activation" && bank.data.account.balance === 0 && bank.data.account.transactions.length === 0 && bank.data.account.virtualCard === null, bank.data);
const key = await member2("/api/bank", { method: "POST", body: { action: "add_pix_key", key: { type: "random" } } });
check("pré-cadastro de chave aleatória", key.status === 200 && key.data.account.pixKeys[0]?.status === "pending_activation", key.data.error);
check("CPF inválido é recusado", (await member2("/api/bank", { method: "POST", body: { action: "add_pix_key", key: { type: "cpf", value: "111.111.111-11" } } })).status === 422);
const pix = await member2("/api/bank", { method: "POST", body: { action: "send_pix", key: "a@b.com", amount: 10 } });
check("Pix só depois da ativação", pix.status === 409 && /ativada/.test(pix.data.error || ""), pix.data.error);
const card = await member2("/api/bank", { method: "POST", body: { action: "request_card", address: { cep: "01310-100", street: "Av. Paulista", number: "1000", city: "São Paulo/SP" } } });
check("pedido do cartão físico fica aguardando ativação", card.status === 200 && card.data.account.cardRequest?.status === "waiting_activation", card.data.error);
check("um pedido de cartão por vez", (await member2("/api/bank", { method: "POST", body: { action: "request_card", address: { cep: "01310-100", street: "Av. Paulista", number: "1000", city: "São Paulo/SP" } } })).status === 409);
const cancelCard = await member2("/api/bank", { method: "POST", body: { action: "cancel_card_request", id: card.data.account.cardRequest.id } });
check("membro cancela o pedido do cartão", cancelCard.status === 200 && cancelCard.data.account.cardRequest === null, cancelCard.data.error);
const users = await admin("/api/admin/users");
const demo = users.data.users?.find((u) => u.email === "membro@prx.dev");
await admin("/api/admin/users", { method: "PUT", body: { id: demo?.id, walletBalance: 999 } });
check("saldo não é editável pelo admin", (await admin("/api/admin/users")).data.users?.find((u) => u.email === "membro@prx.dev")?.walletBalance === 0);
check("papel da equipe não é atribuído pela aba Membros", (await admin("/api/admin/users", { method: "PUT", body: { id: demo?.id, role: "staff" } })).status === 400);

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} passaram`);
process.exit(failures > 0 ? 1 : 0);
