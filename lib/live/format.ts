// Hello World

/** Formatação de datas do PRX LIVE no fuso de São Paulo (segura para cliente e servidor). */
const TZ = "America/Sao_Paulo";
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: TZ });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fullFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });

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

export function formatTime(iso: string | null | undefined): string {
  return iso ? timeFormatter.format(new Date(iso)) : "";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? fullFormatter.format(new Date(iso)) : "";
}

/** Valor de input datetime-local (horário de São Paulo) a partir de um ISO. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** ISO a partir do input datetime-local, interpretado no horário de São Paulo (UTC-3, sem horário de verão desde 2019). */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
