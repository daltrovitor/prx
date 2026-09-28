// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { SitePage } from "@/components/marketing/site-chrome";
import { ScrollMotion } from "@/components/marketing/scroll-motion";
import { PRX_CATEGORIES } from "@/lib/pass-data";

export const metadata: Metadata = {
  title: "PRX · O futuro paga mais",
  description:
    "PRX é o ecossistema das gerações Z e Alpha: benefícios reais no PRX PASS, conta digital com PRX Map no PRX BANK, eventos no PRX LIVE e descobertas nos Reels. Build. Don't Bet.",
  alternates: { canonical: "/institucional" },
  openGraph: {
    title: "PRX · O futuro paga mais",
    description: "Benefícios, conta digital, eventos e cultura para as gerações Z e Alpha.",
    locale: "pt_BR",
    type: "website",
  },
};

const VERTICALS = PRX_CATEGORIES.filter((c) => c.id !== "all");

/* -------------------------------------------------------------------------- */
/* Maquetes (HTML/CSS puro, sem imagens: leves e nítidas em qualquer tela)     */
/* -------------------------------------------------------------------------- */

function BankCardMock({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex aspect-[1.586/1] w-full flex-col justify-between overflow-hidden rounded-2xl bg-[#6c0cf0] p-5 text-white shadow-[0_24px_48px_-24px_rgba(76,9,168,0.55)] ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">PRX Bank</span>
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">Virtual</span>
      </div>
      <p className="font-mono text-[15px] tracking-[0.14em] sm:text-lg">•••• •••• •••• 2026</p>
      <div className="flex items-end justify-between">
        <div>
          <span className="block text-[11px] font-medium text-white">Titular</span>
          <span className="block text-[12px] font-semibold uppercase">Geração Z</span>
        </div>
        <PrxLogo variant="symbol" title="" className="h-7 w-auto text-white" />
      </div>
    </div>
  );
}

function VoucherMock({ offer, partner, className = "" }: { offer: string; partner: string; className?: string }) {
  return (
    <div className={`w-full rounded-2xl border border-line bg-card p-4 shadow-[0_20px_40px_-28px_rgba(11,11,16,0.35)] ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{partner}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-none tracking-[-0.03em] text-[#6c0cf0]">{offer}</p>
        </div>
        <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-ink">Voucher</span>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-dashed border-line pt-4">
        <QrGlyph />
        <div className="min-w-0 text-[12px] leading-snug text-muted-foreground">
          Mostre no balcão
          <span className="block font-mono text-ink">PRX-4827-1930</span>
        </div>
      </div>
    </div>
  );
}

function QrGlyph() {
  // Padrão fixo (decorativo): 7×7 módulos.
  const cells = "1111101100010110111011010111010101110110110000011111011".split("");
  return (
    <span aria-hidden className="grid h-14 w-14 shrink-0 grid-cols-7 gap-[2px] rounded-md bg-surface p-1.5">
      {cells.slice(0, 49).map((c, i) => (
        <span key={i} className={c === "1" ? "bg-ink" : "bg-transparent"} />
      ))}
    </span>
  );
}

function CoinsChip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-[0_16px_32px_-24px_rgba(11,11,16,0.35)] ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">PRX Coins</span>
      <span className="text-xl font-light tracking-[-0.03em] text-ink">+50</span>
      <span className="rounded-md bg-[#6c0cf0]/10 px-2 py-0.5 text-[12px] font-semibold text-[#6c0cf0]">+100 XP</span>
    </div>
  );
}

function MapMock() {
  const slices = [
    { name: "Gastronomia", code: "BITE", pct: 38, color: "#2e0673" },
    { name: "Moda & Sneaker", code: "STYLE", pct: 27, color: "#4b09a8" },
    { name: "Eventos", code: "PLAY", pct: 19, color: "#6c0cf0" },
    { name: "Tecnologia", code: "GEAR", pct: 16, color: "#9153f4" },
  ];
  const r = 44;
  const c = 2 * Math.PI * r;
  const offsets = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.pct / 100) * c, 0));
  return (
    <div className="w-full rounded-2xl border border-line bg-card p-5 shadow-[0_24px_48px_-32px_rgba(11,11,16,0.4)]">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-ink">PRX Map</p>
        <p className="text-[12px] text-muted-foreground">Mensal · exemplo</p>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <svg viewBox="0 0 112 112" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden>
          {slices.map((s, i) => {
            const len = (s.pct / 100) * c;
            return <circle key={s.code} cx="56" cy="56" r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len - 2} ${c - len + 2}`} strokeDashoffset={-offsets[i]} />;
          })}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((s) => (
            <li key={s.code} className="flex items-center gap-2 text-[12px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
              <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TicketMock() {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-[#0b0b10] text-white shadow-[0_24px_48px_-28px_rgba(11,11,16,0.6)]">
      <div className="p-5">
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">PRX UP</span>
        <p className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.03em]">Session Noturna</p>
        <p className="mt-1 text-[13px] text-white/70">Sábado · 22h · São Paulo</p>
      </div>
      <div className="flex items-center justify-between border-t border-dashed border-white/20 px-5 py-4">
        <span className="text-[12px] text-white/70">Ingresso pessoal</span>
        <span className="font-mono text-[13px]">LIVE-7731</span>
      </div>
    </div>
  );
}

function ReelsMock() {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-[#1d1033] shadow-[0_32px_64px_-32px_rgba(11,11,16,0.6)]">
      <div className="absolute inset-x-0 top-0 h-2/3 bg-[#2e0673]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#0b0b10]/60" />
      <span className="absolute left-3 top-3 rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">Drops Exclusivos</span>
      <div className="absolute inset-x-3 bottom-3 space-y-2">
        <p className="text-[15px] font-semibold leading-snug text-white">Coleção nova, direto do ateliê</p>
        <div className="flex items-center gap-2 rounded-xl bg-white/95 p-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-[11px] font-semibold text-ink">SH</span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">Sneaker Hub</span>
          <span className="rounded-lg bg-[#6c0cf0] px-2.5 py-1.5 text-[11px] font-semibold text-white">Aproveitar</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Pillar({ id, name, title, body, points, mock, flip = false }: { id: string; name: string; title: string; body: string; points: string[]; mock: ReactNode; flip?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 overflow-hidden">
      <div className={`mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:gap-16 lg:px-10 lg:py-28 ${flip ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div data-reveal className="space-y-6">
          <p className="text-[15px] font-semibold text-[#6c0cf0]">{name}</p>
          <h2 id={`${id}-title`} className="text-[36px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-5xl lg:text-[56px]">
            {title}
          </h2>
          <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">{body}</p>
          <ul className="space-y-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] text-ink">
                <span aria-hidden className="mt-2 h-1.5 w-4 shrink-0 rounded-sm bg-[#6c0cf0]" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">{mock}</div>
      </div>
    </section>
  );
}

export default function InstitutionalPage() {
  return (
    <SitePage>
      <ScrollMotion>
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] lg:px-10 lg:pb-28 lg:pt-24">
            <div className="space-y-8">
              <h1 id="hero-title" className="text-[46px] font-semibold leading-[0.95] tracking-[-0.055em] text-ink min-[380px]:text-6xl sm:text-7xl lg:text-[96px]">
                O futuro
                <br />
                paga mais.
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Benefícios reais, conta digital com mapa dos seus gastos, eventos e as marcas da sua geração. Um app, um nível que não para de subir.
              </p>
              <div className="flex flex-col gap-3 min-[420px]:flex-row">
                <Link href="/" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-[#6c0cf0] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#5708c9]">
                  Abrir o app
                </Link>
                <Link href="/em-breve" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-surface px-6 text-[16px] font-semibold text-ink transition-colors hover:bg-line">
                  Entrar na Lista VIP
                </Link>
              </div>
            </div>

            <div aria-hidden className="relative mx-auto h-[380px] w-full max-w-[440px] sm:h-[440px]">
              <div data-parallax="0.18" className="absolute left-0 top-6 w-[78%] rotate-[-6deg]">
                <BankCardMock />
              </div>
              <div data-parallax="0.32" className="absolute bottom-8 right-0 w-[70%] rotate-[4deg]">
                <VoucherMock offer="25% OFF" partner="Café Aurora" />
              </div>
              <div data-parallax="0.5" className="absolute bottom-0 left-2 sm:left-6">
                <CoinsChip />
              </div>
            </div>
          </div>
        </section>

        {/* Faixa de verticais */}
        <section aria-label="Verticais de benefícios" className="border-y border-line bg-surface/60">
          <ul className="mx-auto flex max-w-[1200px] flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-6 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground sm:px-6 lg:px-10">
            {VERTICALS.map((v) => (
              <li key={v.id}>{v.verticalCode}</li>
            ))}
          </ul>
        </section>

        <Pillar
          id="pass"
          name="PRX PASS"
          title="Benefícios que valem de verdade."
          body="Descontos e experiências em marcas credenciadas, resgatados com PRX Coins e validados por QR Code no balcão em segundos."
          points={["Coins por bons hábitos e compras em parceiros", "Voucher com QR na hora, sem cupom esquecido", "Onze verticais: comida, moda, tecnologia, bem-estar e mais"]}
          mock={
            <div className="relative mx-auto max-w-[400px] space-y-4">
              <div data-parallax="0.12">
                <VoucherMock offer="2 por 1" partner="Burger Lab" />
              </div>
              <div data-parallax="0.24" className="ml-10">
                <VoucherMock offer="Grátis" partner="Mindspace" />
              </div>
            </div>
          }
        />

        <Pillar
          id="bank"
          flip
          name="PRX BANK"
          title="Seu dinheiro, com mapa."
          body="Conta digital com Pix e cartão, feita para quem está começando. O PRX Map mostra para onde vai cada real, por nicho, no mês, no trimestre e no ano."
          points={["Pix para parceiro vira coins e XP automaticamente", "PRX Map por categoria: BITE, STYLE, GEAR, MINDSPACE, PLAY", "Rentabilidade automática do saldo em homologação regulatória"]}
          mock={
            <div className="relative mx-auto max-w-[400px] space-y-4">
              <div data-parallax="0.14">
                <MapMock />
              </div>
              <div data-parallax="0.28" className="ml-auto w-[80%]">
                <BankCardMock />
              </div>
            </div>
          }
        />

        <Pillar
          id="live"
          name="PRX LIVE"
          title="Onde a sua geração se encontra."
          body="Sessions, talks, founders e corridas PRX RUN. Ingresso pessoal no app, check-in por QR na portaria e XP por aparecer."
          points={["Ingressos PRX UP e inscrições PRX RUN", "Eventos com nível mínimo para quem constrói", "Check-in presencial conta pontos"]}
          mock={
            <div data-parallax="0.18" className="mx-auto max-w-[360px]">
              <TicketMock />
            </div>
          }
        />

        <Pillar
          id="reels"
          flip
          name="PRX REELS"
          title="Descubra no seu ritmo."
          body="Um feed vertical com drops, bastidores e lançamentos das marcas parceiras. Viu, gostou, aproveitou: o benefício está a um toque."
          points={["Vídeos 9:16 curados pela PRX", "Curta e salve para ver depois", "Botão direto para o benefício ou a loja"]}
          mock={
            <div data-parallax="0.16">
              <ReelsMock />
            </div>
          }
        />

        {/* Impacto */}
        <section id="impacto" aria-labelledby="impact-title" className="scroll-mt-20 bg-[#0b0b10] text-white">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
            <div data-reveal className="max-w-3xl space-y-5">
              <h2 id="impact-title" className="text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                The Future Pays More.
              </h2>
              <p className="text-lg leading-relaxed text-white/70">Feito para as gerações Z e Alpha: quem constrói hábitos hoje colhe mais amanhã. Build. Don&apos;t Bet.</p>
            </div>
            <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
              <Counter value={VERTICALS.length} label="verticais de benefícios" />
              <Counter value={100} suffix="%" label="do CDI no saldo (em breve)" />
              <Counter value={29} label="anos: idade máxima da comunidade" />
              <Counter value={0} label="apostas. Build. Don't Bet." />
            </dl>
          </div>
        </section>

        {/* Chamada final */}
        <section aria-labelledby="cta-title" className="mx-auto max-w-[1200px] px-4 py-24 text-center sm:px-6 lg:px-10 lg:py-32">
          <div data-reveal className="mx-auto max-w-2xl space-y-8">
            <h2 id="cta-title" className="text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-6xl">
              Seu próximo nível começa agora.
            </h2>
            <div className="flex flex-col justify-center gap-3 min-[420px]:flex-row">
              <Link href="/" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-[#6c0cf0] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#5708c9]">
                Criar minha conta
              </Link>
              <Link href="/em-breve" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-surface px-6 text-[16px] font-semibold text-ink transition-colors hover:bg-line">
                Lista VIP
              </Link>
            </div>
          </div>
        </section>
      </ScrollMotion>
    </SitePage>
  );
}

function Counter({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  return (
    <div data-reveal>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span data-count={value} data-suffix={suffix} className="block text-[56px] font-light leading-none tracking-[-0.05em] tabular-nums sm:text-7xl">
          {value.toLocaleString("pt-BR")}
          {suffix}
        </span>
        <span aria-hidden className="mt-3 block max-w-[14rem] text-[15px] leading-snug text-white/70">
          {label}
        </span>
      </dd>
    </div>
  );
}
