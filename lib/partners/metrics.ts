// Hello World
import { PRX_TIME_ZONE } from "@/lib/partners/contract";

/**
 * Inteligência comercial agregada para o parceiro (cláusulas 11.1, 11.2 e 11.7).
 *
 * O parceiro recebe contagens e proporções, nunca identidade. Grupos com menos
 * de MIN_GROUP_SIZE pessoas são suprimidos, e quando só uma faixa etária cairia
 * na supressão, a menor faixa seguinte também é ocultada: sem isso, o total
 * menos as faixas visíveis revelaria a faixa escondida.
 */

export const MIN_GROUP_SIZE = 5;

export type AgeBand = "ate_15" | "16_17" | "18_24" | "25_29" | "30_mais" | "nao_informado";

export const AGE_BANDS: ReadonlyArray<{ id: AgeBand; label: string }> = [
  { id: "ate_15", label: "Até 15 anos" },
  { id: "16_17", label: "16–17 anos" },
  { id: "18_24", label: "18–24 anos" },
  { id: "25_29", label: "25–29 anos" },
  { id: "30_mais", label: "30 anos ou mais" },
  { id: "nao_informado", label: "Não informado" },
];

/** Idade em anos completos na data `now`, a partir de AAAA-MM-DD. */
export function ageFromBirthDate(birthDate: string | null | undefined, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate || "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = now.getUTCFullYear() - year;
  const beforeBirthday = now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function ageBandFromBirthDate(birthDate: string | null | undefined, now = new Date()): AgeBand {
  const age = ageFromBirthDate(birthDate, now);
  if (age === null) return "nao_informado";
  if (age <= 15) return "ate_15";
  if (age <= 17) return "16_17";
  if (age <= 24) return "18_24";
  if (age <= 29) return "25_29";
  return "30_mais";
}

export function isAgeBand(value: unknown): value is AgeBand {
  return AGE_BANDS.some((band) => band.id === value);
}

/* -------------------------------------------------------------------------- */
/* Entradas                                                                    */
/* -------------------------------------------------------------------------- */

export interface MetricEvent {
  benefitId: string;
  kind: "impression" | "click";
  ageBand: AgeBand;
  createdAt: string;
}

export interface MetricVoucher {
  benefitId: string;
  /** Chave opaca do membro, usada só para contar recorrência. Nunca sai daqui. */
  memberKey: string;
  ageBand: AgeBand;
  status: string;
  createdAt: string;
  validatedAt: string | null;
}

export interface MetricOffer {
  benefitId: string;
  /** Preço pago pelo membro, quando conhecido (base de vendas estimadas). */
  price: number | null;
}

/* -------------------------------------------------------------------------- */
/* Saída                                                                       */
/* -------------------------------------------------------------------------- */

export interface AgeBandShare {
  band: AgeBand;
  label: string;
  /** Proporção 0–1 ou null quando suprimida. */
  share: number | null;
  suppressed: boolean;
}

export interface PartnerMetrics {
  impressions: number;
  clicks: number;
  redemptions: number;
  validations: number;
  /** cliques / exibições */
  ctr: number | null;
  /** resgates / cliques */
  conversion: number | null;
  /** validações / resgates */
  usageRate: number | null;
  /** soma do preço PRX das validações com preço conhecido */
  estimatedSales: number | null;
  averageTicket: number | null;
  /** membros com 2+ resgates / membros distintos (suprimido abaixo do mínimo) */
  recurrence: number | null;
  /** validações por hora do dia (0–23), horário de Brasília */
  validationsByHour: number[];
  /** resgates por dia da semana (0 = domingo) */
  redemptionsByWeekday: number[];
  clicksByAge: AgeBandShare[];
  redemptionsByAge: AgeBandShare[];
  minGroupSize: number;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: PRX_TIME_ZONE, hour: "numeric", hourCycle: "h23" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: PRX_TIME_ZONE, weekday: "short" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localHour(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hour = Number(hourFormat.formatToParts(date).find((part) => part.type === "hour")?.value);
  return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
}

function localWeekday(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const index = WEEKDAYS.indexOf(weekdayFormat.format(date));
  return index >= 0 ? index : null;
}

/** Distribuição por faixa etária com supressão primária e secundária. */
export function ageDistribution(bands: AgeBand[], minGroup = MIN_GROUP_SIZE): AgeBandShare[] {
  const total = bands.length;
  const counts = new Map<AgeBand, number>(AGE_BANDS.map((b) => [b.id, 0]));
  bands.forEach((band) => counts.set(band, (counts.get(band) ?? 0) + 1));

  const suppressed = new Set<AgeBand>();
  if (total < minGroup) {
    AGE_BANDS.forEach((b) => suppressed.add(b.id));
  } else {
    AGE_BANDS.forEach((b) => {
      const count = counts.get(b.id) ?? 0;
      if (count > 0 && count < minGroup) suppressed.add(b.id);
    });
    if (suppressed.size === 1) {
      const next = AGE_BANDS.map((b) => b.id)
        .filter((id) => !suppressed.has(id) && (counts.get(id) ?? 0) > 0)
        .sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0];
      if (next) suppressed.add(next);
    }
  }

  return AGE_BANDS.map((b) => {
    const hidden = suppressed.has(b.id);
    return {
      band: b.id,
      label: b.label,
      share: hidden || total === 0 ? null : (counts.get(b.id) ?? 0) / total,
      suppressed: hidden,
    };
  });
}

export function computePartnerMetrics(
  input: { events: MetricEvent[]; vouchers: MetricVoucher[]; offers: MetricOffer[] },
  minGroup = MIN_GROUP_SIZE
): PartnerMetrics {
  const impressions = input.events.filter((e) => e.kind === "impression").length;
  const clickEvents = input.events.filter((e) => e.kind === "click");
  const redemptions = input.vouchers.filter((v) => v.status !== "cancelled");
  const validated = redemptions.filter((v) => v.status === "used");

  const priceByBenefit = new Map(input.offers.map((o) => [o.benefitId, o.price]));
  const priced = validated
    .map((v) => priceByBenefit.get(v.benefitId))
    .filter((price): price is number => typeof price === "number");
  const estimatedSales = priced.length > 0 ? priced.reduce((sum, price) => sum + price, 0) : null;

  const perMember = new Map<string, number>();
  redemptions.forEach((v) => perMember.set(v.memberKey, (perMember.get(v.memberKey) ?? 0) + 1));
  const distinctMembers = perMember.size;
  const returning = Array.from(perMember.values()).filter((count) => count >= 2).length;

  const validationsByHour = Array.from({ length: 24 }, () => 0);
  validated.forEach((v) => {
    const hour = localHour(v.validatedAt || v.createdAt);
    if (hour !== null) validationsByHour[hour] += 1;
  });

  const redemptionsByWeekday = Array.from({ length: 7 }, () => 0);
  redemptions.forEach((v) => {
    const day = localWeekday(v.createdAt);
    if (day !== null) redemptionsByWeekday[day] += 1;
  });

  return {
    impressions,
    clicks: clickEvents.length,
    redemptions: redemptions.length,
    validations: validated.length,
    ctr: ratio(clickEvents.length, impressions),
    conversion: ratio(redemptions.length, clickEvents.length),
    usageRate: ratio(validated.length, redemptions.length),
    estimatedSales,
    averageTicket: estimatedSales !== null ? estimatedSales / priced.length : null,
    recurrence: distinctMembers >= minGroup ? returning / distinctMembers : null,
    validationsByHour,
    redemptionsByWeekday,
    clicksByAge: ageDistribution(clickEvents.map((e) => e.ageBand), minGroup),
    redemptionsByAge: ageDistribution(redemptions.map((v) => v.ageBand), minGroup),
    minGroupSize: minGroup,
  };
}
