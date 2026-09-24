// Hello World

/**
 * Domínio do PRX LIVE: vitrine de eventos, PRX UP (ingressos), PRX RUN
 * (corridas) e PRX FOUNDERS (submissão de startups).
 *
 * O catálogo abaixo é a programação de lançamento. Compras, inscrições e
 * submissões ficam na carteira local do usuário (modo demonstração) até o
 * orquestrador de pagamentos e as tabelas de eventos entrarem em produção.
 */

export type EventSeries = "founders" | "session" | "ctrl" | "talks" | "run";

export interface TicketBatch {
  id: string;
  name: string;
  price: number;
  /** Lote esgotado ou encerrado. */
  closed: boolean;
}

export interface LiveEvent {
  id: string;
  series: EventSeries;
  title: string;
  summary: string;
  startsAt: string;
  venue: string;
  city: string;
  batches: TicketBatch[];
}

export const SERIES_LABEL: Record<EventSeries, string> = {
  founders: "PRX Founders",
  session: "PRX Session",
  ctrl: "Ctrl + PRX",
  talks: "PRX Talks",
  run: "PRX RUN",
};

export const LIVE_EVENTS: ReadonlyArray<LiveEvent> = [
  {
    id: "evt-founders-demo-day",
    series: "founders",
    title: "Founders Demo Day",
    summary: "Dez startups selecionadas apresentam o pitch de 5 minutos para investidores e para a banca de Rafael Molina.",
    startsAt: "2026-10-17T19:00:00-03:00",
    venue: "Galpão Vila Leopoldina",
    city: "São Paulo, SP",
    batches: [
      { id: "b1", name: "1º lote", price: 29.9, closed: true },
      { id: "b2", name: "2º lote", price: 39.9, closed: false },
      { id: "b3", name: "Founder pass", price: 89.9, closed: false },
    ],
  },
  {
    id: "evt-session-sunset",
    series: "session",
    title: "Session Sunset",
    summary: "Line-up de DJs da cena independente, pista ao ar livre e ativações das marcas parceiras do PRX PASS.",
    startsAt: "2026-10-31T16:00:00-03:00",
    venue: "Arena Zona Oeste",
    city: "São Paulo, SP",
    batches: [
      { id: "b1", name: "1º lote", price: 49.9, closed: false },
      { id: "b2", name: "2º lote", price: 69.9, closed: false },
    ],
  },
  {
    id: "evt-ctrl-lan",
    series: "ctrl",
    title: "Ctrl + PRX: LAN Night",
    summary: "Campeonato presencial de Valorant e EA FC, estações de free play e mesa de carreira em games com estúdios brasileiros.",
    startsAt: "2026-11-14T13:00:00-03:00",
    venue: "Pavilhão Barra Funda",
    city: "São Paulo, SP",
    batches: [
      { id: "b1", name: "Espectador", price: 19.9, closed: false },
      { id: "b2", name: "Jogador (inscrição)", price: 59.9, closed: false },
    ],
  },
  {
    id: "evt-talks-dinheiro",
    series: "talks",
    title: "Talks: dinheiro sem aposta",
    summary: "Conversa franca sobre primeira renda, investimento e por que bet não é plano. Build. Don't bet.",
    startsAt: "2026-11-22T19:30:00-03:00",
    venue: "Auditório Paulista",
    city: "São Paulo, SP",
    batches: [{ id: "b1", name: "Entrada", price: 0, closed: false }],
  },
];

/* ------------------------------------------------------------------------ */
/* PRX RUN                                                                  */
/* ------------------------------------------------------------------------ */

export type RunModality = "5k" | "10k" | "21k";
export type ShirtSize = "PP" | "P" | "M" | "G" | "GG" | "XGG";

export interface RunStage {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  kitPickup: string;
  fee: number;
  modalities: RunModality[];
  finished: boolean;
}

export const RUN_CATEGORIES = ["Geral", "Sub-18", "Sub-23", "Sub-30"] as const;
export type RunCategory = (typeof RUN_CATEGORIES)[number];
export const SHIRT_SIZES: ReadonlyArray<ShirtSize> = ["PP", "P", "M", "G", "GG", "XGG"];

export const RUN_STAGES: ReadonlyArray<RunStage> = [
  {
    id: "run-etapa-1",
    title: "Etapa 1 — Ibirapuera",
    startsAt: "2026-08-23T07:00:00-03:00",
    location: "Parque Ibirapuera, portão 3",
    kitPickup: "21 e 22/08, loja parceira (endereço enviado no app)",
    fee: 79.9,
    modalities: ["5k", "10k"],
    finished: true,
  },
  {
    id: "run-etapa-2",
    title: "Etapa 2 — USP",
    startsAt: "2026-11-08T06:30:00-03:00",
    location: "Cidade Universitária, raia olímpica",
    kitPickup: "06 e 07/11, 10h às 20h, loja parceira (endereço enviado no app)",
    fee: 89.9,
    modalities: ["5k", "10k", "21k"],
    finished: false,
  },
];

export interface RunResult {
  position: number;
  name: string;
  category: RunCategory;
  modality: RunModality;
  time: string;
}

/** Classificação oficial da Etapa 1 (dados de exemplo até a integração com a cronometragem). */
export const RUN_RESULTS: Record<string, ReadonlyArray<RunResult>> = {
  "run-etapa-1": [
    { position: 1, name: "Bruna Tavares", category: "Sub-23", modality: "10k", time: "36:41" },
    { position: 2, name: "Diego Almeida", category: "Geral", modality: "10k", time: "37:05" },
    { position: 3, name: "Rafaela Costa", category: "Sub-30", modality: "10k", time: "38:22" },
    { position: 4, name: "Enzo Ribeiro", category: "Sub-18", modality: "10k", time: "39:10" },
    { position: 5, name: "Marina Lopes", category: "Sub-23", modality: "10k", time: "40:02" },
    { position: 1, name: "Caio Nunes", category: "Sub-18", modality: "5k", time: "17:48" },
    { position: 2, name: "Lívia Santos", category: "Sub-23", modality: "5k", time: "18:31" },
    { position: 3, name: "Pedro Henrique", category: "Geral", modality: "5k", time: "18:57" },
  ],
};

export interface RunRegistration {
  id: string;
  stageId: string;
  modality: RunModality;
  category: RunCategory;
  shirtSize: ShirtSize;
  termsAcceptedAt: string;
  kitCode: string;
  createdAt: string;
}

/* ------------------------------------------------------------------------ */
/* PRX FOUNDERS                                                             */
/* ------------------------------------------------------------------------ */

export type FoundersStatus = "sent" | "review" | "selected";

export const FOUNDERS_PIPELINE: ReadonlyArray<{ status: FoundersStatus; label: string; detail: string }> = [
  { status: "sent", label: "Enviada", detail: "Recebemos sua startup." },
  { status: "review", label: "Em análise", detail: "O time de Rafael Molina avalia o pitch." },
  { status: "selected", label: "Selecionada", detail: "Convite para o Demo Day e mentoria." },
];

export interface FoundersSubmission {
  id: string;
  startupName: string;
  oneLiner: string;
  stage: "ideia" | "mvp" | "tracao";
  deckFileName: string;
  videoUrl: string;
  status: FoundersStatus;
  submittedAt: string;
}

/* ------------------------------------------------------------------------ */
/* Carteira LIVE (ingressos, inscrições e submissões do usuário)            */
/* ------------------------------------------------------------------------ */

export interface Ticket {
  id: string;
  eventId: string;
  batchId: string;
  holderName: string;
  code: string;
  price: number;
  paymentMethod: "pix" | "card" | "free";
  purchasedAt: string;
  checkedIn: boolean;
}

export interface LiveWallet {
  version: 1;
  tickets: Ticket[];
  runRegistrations: RunRegistration[];
  foundersSubmissions: FoundersSubmission[];
}

export function seedLiveWallet(): LiveWallet {
  return { version: 1, tickets: [], runRegistrations: [], foundersSubmissions: [] };
}

function randomCode(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}

export function issueTicket(
  wallet: LiveWallet,
  input: { event: LiveEvent; batch: TicketBatch; holderName: string; paymentMethod: Ticket["paymentMethod"] }
): { wallet: LiveWallet; ticket: Ticket } {
  if (input.batch.closed) throw new Error("Este lote está encerrado.");
  const ticket: Ticket = {
    id: `tkt_${Date.now().toString(36)}`,
    eventId: input.event.id,
    batchId: input.batch.id,
    holderName: input.holderName,
    code: randomCode("UP"),
    price: input.batch.price,
    paymentMethod: input.batch.price === 0 ? "free" : input.paymentMethod,
    purchasedAt: new Date().toISOString(),
    checkedIn: false,
  };
  return { wallet: { ...wallet, tickets: [ticket, ...wallet.tickets] }, ticket };
}

export function registerForRun(
  wallet: LiveWallet,
  input: Omit<RunRegistration, "id" | "kitCode" | "createdAt" | "termsAcceptedAt">
): LiveWallet {
  if (wallet.runRegistrations.some((r) => r.stageId === input.stageId)) {
    throw new Error("Você já está inscrito nesta etapa.");
  }
  const now = new Date().toISOString();
  const registration: RunRegistration = {
    ...input,
    id: `run_${Date.now().toString(36)}`,
    kitCode: randomCode("KIT"),
    termsAcceptedAt: now,
    createdAt: now,
  };
  return { ...wallet, runRegistrations: [registration, ...wallet.runRegistrations] };
}

export function submitToFounders(
  wallet: LiveWallet,
  input: Omit<FoundersSubmission, "id" | "status" | "submittedAt">
): LiveWallet {
  const submission: FoundersSubmission = {
    ...input,
    id: `fnd_${Date.now().toString(36)}`,
    status: "sent",
    submittedAt: new Date().toISOString(),
  };
  return { ...wallet, foundersSubmissions: [submission, ...wallet.foundersSubmissions] };
}

export function ticketQrPayload(ticket: Ticket): string {
  return `PRX_LIVE::${ticket.code}::${ticket.eventId}`;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function formatEventDate(iso: string): { day: string; month: string; weekday: string; time: string } {
  const date = new Date(iso);
  const [day, month] = dateFormatter.format(date).replace(".", "").split(" de ");
  return {
    day,
    month: (month || "").toUpperCase(),
    weekday: weekdayFormatter.format(date).replace(".", ""),
    time: timeFormatter.format(date),
  };
}
