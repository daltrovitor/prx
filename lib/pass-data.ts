export interface Category {
  id: string;
  name: string;
  verticalCode: string;
}

export interface Benefit {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerLogo: string;
  partnerBanner: string;
  partnerLocation: string;
  categoryId: string;
  title: string;
  description: string;
  discountLabel: string;
  minPrxLevel: number;
  terms: string[];
  originalPrice?: number;
  promotionalPrice?: number;
}

export interface UserVoucher {
  id: string;
  code: string;
  benefitId: string;
  benefitTitle: string;
  partnerId: string;
  partnerName: string;
  discountLabel: string;
  status: "valid" | "used";
  qrPayload: string;
  redeemedAt: string;
  terms: string;
}

export type MissionVerificationType =
  | "benefit_redeem"
  | "referral"
  | "founders_pitch"
  | "run_signup"
  | "bank_pix"
  | "circle_connect"
  | "mentor_session"
  | "mindspace_care"
  | "event_checkin"
  | "manual";

export interface MissionVerificationDefinition {
  type: MissionVerificationType;
  label: string;
  shortLabel: string;
  category: string;
  description: string;
  howToComplete: string;
  actionText: string;
  defaultXp: number;
  defaultTotal: number;
  badgeColor: string;
  iconName: string;
}

export const MISSION_VERIFICATION_DEFINITIONS: Record<MissionVerificationType, MissionVerificationDefinition> = {
  benefit_redeem: {
    type: "benefit_redeem",
    label: "Resgate de Voucher (PRX PASS)",
    shortLabel: "Voucher no PASS",
    category: "PRX PASS",
    description: "Incentiva o jovem a explorar e resgatar vantagens no marketplace.",
    howToComplete: "O sistema valida se o usuário gerou ou utilizou vouchers ativos no marketplace.",
    actionText: "Verificar Resgate de Voucher",
    defaultXp: 200,
    defaultTotal: 1,
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    iconName: "Ticket",
  },
  referral: {
    type: "referral",
    label: "Indicação de Amigos (Member Get Member)",
    shortLabel: "Indicação de Amigos",
    category: "Comunidade",
    description: "Crescimento da comunidade: o usuário convida amigos com seu código de membro.",
    howToComplete: "Validada automaticamente quando os amigos inserem o código do usuário no dashboard.",
    actionText: "Convidar Amigos & Validar",
    defaultXp: 250,
    defaultTotal: 1,
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    iconName: "Users",
  },
  founders_pitch: {
    type: "founders_pitch",
    label: "Pitch Zero to One (PRX FOUNDERS)",
    shortLabel: "Pitch de Startup",
    category: "PRX FOUNDERS",
    description: "Empreendedorismo jovem: envio de projeto ou pitch em vídeo de 60 segundos.",
    howToComplete: "O usuário envia o nome da startup e a proposta/link do pitch para análise de Rafael Molina.",
    actionText: "Enviar Pitch de 60s",
    defaultXp: 500,
    defaultTotal: 1,
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    iconName: "Rocket",
  },
  run_signup: {
    type: "run_signup",
    label: "Inscrição de Corrida (PRX RUN)",
    shortLabel: "Corrida de Rua",
    category: "PRX LIVE",
    description: "Performance e esporte: inscrição no circuito de corridas de rua PRX RUN.",
    howToComplete: "O usuário seleciona distância (5k, 10k, 21k) e tamanho da camiseta para retirar o kit atleta.",
    actionText: "Garantir Vaga no PRX RUN",
    defaultXp: 300,
    defaultTotal: 1,
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    iconName: "Flame",
  },
  bank_pix: {
    type: "bank_pix",
    label: "Ativação Pix & Finanças (PRX BANK)",
    shortLabel: "Fintech & Hábitos",
    category: "PRX BANK",
    description: "Hábitos financeiros inteligentes (Build. Don't Bet): conta digital e sem gastos com apostas.",
    howToComplete: "O usuário confirma cadastro de chave Pix e adere ao compromisso financeiro inteligente.",
    actionText: "Ativar Chave & Hábito Saudável",
    defaultXp: 350,
    defaultTotal: 1,
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    iconName: "CreditCard",
  },
  circle_connect: {
    type: "circle_connect",
    label: "Conexão Unplug (PRX CIRCLE)",
    shortLabel: "Conexão de Propósito",
    category: "PRX CIRCLE",
    description: "Rede social por valores e ideias reais, sem fotos superficiais.",
    howToComplete: "O usuário escolhe uma frase de propósito real no Unplug para conectar com novas pessoas.",
    actionText: "Escolher Frase de Propósito",
    defaultXp: 200,
    defaultTotal: 1,
    badgeColor: "text-pink-400 bg-pink-500/10 border-pink-500/30",
    iconName: "MessageCircle",
  },
  mentor_session: {
    type: "mentor_session",
    label: "Mentoria & Aceleração (PRX LEVEL)",
    shortLabel: "Mentoria Rafael Molina",
    category: "PRX LEVEL",
    description: "Aceleração de carreira, ideias e negócios com mentoria especializada.",
    howToComplete: "O usuário seleciona o tema de aceleração para agendar ou validar sessão com mentores.",
    actionText: "Solicitar Mentoria de Ambição",
    defaultXp: 400,
    defaultTotal: 1,
    badgeColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    iconName: "Award",
  },
  mindspace_care: {
    type: "mindspace_care",
    label: "Cuidado Emocional (PRÓXIMO EU)",
    shortLabel: "Saúde Mental",
    category: "PRÓXIMO EU",
    description: "Cuidar da cabeça também é subir de nível: saúde emocional e bem-estar para a Gen Z.",
    howToComplete: "O usuário realiza check-in de bem-estar emocional e conecta com profissional credenciado.",
    actionText: "Fazer Check-in Emocional",
    defaultXp: 250,
    defaultTotal: 1,
    badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    iconName: "Heart",
  },
  event_checkin: {
    type: "event_checkin",
    label: "Check-in em Evento (PRX LIVE)",
    shortLabel: "Experiências ao Vivo",
    category: "PRX LIVE",
    description: "Eventos, encontros presenciais, palestras e experiências exclusivas PRX.",
    howToComplete: "O usuário valida seu ingresso digital ou insere o código de check-in do evento.",
    actionText: "Validar Check-in no Evento",
    defaultXp: 300,
    defaultTotal: 1,
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    iconName: "Calendar",
  },
  manual: {
    type: "manual",
    label: "Desafio Especial (Conclusão Direta)",
    shortLabel: "Desafio Geral",
    category: "Geral",
    description: "Missões e desafios pontuais concluídos pelo usuário com 1 clique.",
    howToComplete: "O usuário lê o desafio e clica diretamente no botão para declarar realização e reivindicar XP.",
    actionText: "Concluir Desafio & Resgatar XP",
    defaultXp: 150,
    defaultTotal: 1,
    badgeColor: "text-zinc-300 bg-zinc-500/10 border-zinc-500/30",
    iconName: "Zap",
  },
};

export interface PassMission {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  progress: number;
  total: number;
  isCompleted: boolean;
  verificationType?: MissionVerificationType;
  category?: string;
  isAccepted?: boolean;
  acceptedAt?: string;
  completedAt?: string;
  targetAction?: string;
}

export interface ReferralInfo {
  userId: string;
  referralCode: string;
  inviteUrl?: string;
  friendsInvitedCount: number;
  referredBy?: {
    id: string;
    name: string;
  } | null;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerName: string;
  referredUserId: string;
  referredUserName: string;
  createdAt: string;
}

// Modelos Oficiais de Missões extraídos dos PDFs (Escopo do app.pdf & Proposta PRX.pdf)
export const PDF_MISSION_TEMPLATES: Omit<PassMission, "id">[] = [
  {
    title: "Convidar 1 Amigo para o PRX",
    description:
      "Convide 1 amigo para a comunidade. Peça para ele colocar o seu ID de usuário no dashboard dele para validar a missão e ambos ganharem XP!",
    xpReward: 250,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "referral",
    category: "Comunidade",
    targetAction: "Convidar 1 Amigo & Validar",
  },
  {
    title: "Embaixador PRX: Convide 3 Amigos",
    description:
      "Traga 3 novos membros para o ecossistema Alpha e Z. Cada amigo que inserir o seu ID no dashboard dele avança o seu progresso rumo ao próximo nível!",
    xpReward: 600,
    total: 3,
    progress: 0,
    isCompleted: false,
    verificationType: "referral",
    category: "Comunidade",
    targetAction: "Indicar 3 amigos que ingressem no PRX",
  },
  {
    title: "Resgatar Primeiro Voucher no PRX PASS",
    description:
      "Explore o marketplace de benefícios exclusivos e resgate seu primeiro voucher para uso no balcão de um parceiro conveniado.",
    xpReward: 200,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "benefit_redeem",
    category: "PRX PASS",
    targetAction: "Verificar Resgate de Voucher",
  },
  {
    title: "Pitch Zero to One com Rafael Molina",
    description:
      "Apresente sua startup ou ideia de negócio no funil 'Zero to One' para avaliação do time de aceleração de Rafael Molina.",
    xpReward: 500,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "founders_pitch",
    category: "PRX FOUNDERS",
    targetAction: "Enviar Pitch de 60s",
  },
  {
    title: "Inscrever-se na Etapa do PRX RUN",
    description:
      "Confirme sua inscrição na próxima etapa do circuito de corrida de rua PRX RUN e prepare a retirada do seu kit atleta.",
    xpReward: 300,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "run_signup",
    category: "PRX LIVE",
    targetAction: "Garantir Vaga no PRX RUN",
  },
  {
    title: "Ativar Chave Pix no PRX BANK",
    description:
      "Ative sua conta digital e registre sua chave Pix para movimentações instantâneas e recompensas por hábitos financeiros saudáveis (Build. Don't Bet).",
    xpReward: 350,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "bank_pix",
    category: "PRX BANK",
    targetAction: "Ativar Chave & Hábito Saudável",
  },
  {
    title: "Conexão de Propósito no PRX CIRCLE",
    description:
      "Participe da rede Unplug: selecione sua frase de propósito para conectar-se por afinidade intelectual e valores, sem fotos superficiais.",
    xpReward: 200,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "circle_connect",
    category: "PRX CIRCLE",
    targetAction: "Escolher Frase de Propósito",
  },
  {
    title: "Mentoria de Ambição no PRX LEVEL",
    description:
      "Suba de nível com aceleração de carreira e negócios. Solicite sua mentoria individual ou de grupo com Rafael Molina e convidados.",
    xpReward: 400,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "mentor_session",
    category: "PRX LEVEL",
    targetAction: "Solicitar Mentoria de Ambição",
  },
  {
    title: "Cuidar da Cabeça: Check-in no PRÓXIMO EU",
    description:
      "Cuidar da cabeça também é subir de nível. Faça um check-in de saúde emocional e descubra profissionais credenciados com valores acessíveis.",
    xpReward: 250,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "mindspace_care",
    category: "PRÓXIMO EU",
    targetAction: "Fazer Check-in Emocional",
  },
  {
    title: "Check-in em Evento Presencial PRX LIVE",
    description:
      "Participe de uma experiência ao vivo: faça check-in com seu ingresso digital no próximo encontro presencial do ecossistema.",
    xpReward: 300,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "event_checkin",
    category: "PRX LIVE",
    targetAction: "Validar Check-in no Evento",
  },
  {
    title: "Desafio 'Build. Don't Bet': Semana Sem Apostas",
    description:
      "Recompensa especial para jovens que priorizam construção de patrimônio em vez de cassinos ou apostas online. Reivindique seus pontos de incentivo.",
    xpReward: 400,
    total: 1,
    progress: 0,
    isCompleted: false,
    verificationType: "manual",
    category: "PRX BANK",
    targetAction: "Confirmar Construção Saudável",
  },
];

// Catálogo Oficial de Categorias (11 Verticais)
export const PRX_CATEGORIES: Category[] = [
  { id: "all", name: "Todos", verticalCode: "ALL" },
  { id: "gastronomia", name: "Gastronomia", verticalCode: "BITE" },
  { id: "moda", name: "Moda & Sneaker", verticalCode: "STYLE" },
  { id: "tecnologia", name: "Tecnologia", verticalCode: "GEAR" },
  { id: "viagens", name: "Viagens & Hostels", verticalCode: "ROAM" },
  { id: "educacao", name: "Educação", verticalCode: "CREATE" },
  { id: "esportes", name: "Esportes", verticalCode: "MOVE" },
  { id: "entretenimento", name: "Eventos & Shows", verticalCode: "PLAY" },
  { id: "beleza", name: "Beleza", verticalCode: "GLOW" },
  { id: "saude-mental", name: "Saúde Mental", verticalCode: "MINDSPACE" },
  { id: "automoveis", name: "Mobilidade", verticalCode: "DRIVE" },
  { id: "imoveis", name: "Co-living", verticalCode: "NEST" },
];

// Iniciar com dados vazios para carregar apenas os reais criados pelo administrador
export const INITIAL_BENEFITS: Benefit[] = [];
export const INITIAL_VOUCHERS: UserVoucher[] = [];
export const PASS_MISSIONS: PassMission[] = [];

/**
 * Serializa metadados da missão (tipo de verificação, vertical e ação) dentro da descrição
 * para persistência segura no Supabase sem depender de alterações no schema da tabela.
 */
export function encodeMissionDescription(
  rawDescription: string,
  meta: {
    verificationType?: MissionVerificationType;
    category?: string;
    targetAction?: string;
  }
): string {
  const cleanDesc = (rawDescription || "").replace(/\n?<!--(?:nxt|prx)-meta:[\s\S]*?-->$/, "").trim();
  const metaObj: Record<string, string> = {};
  if (meta.verificationType) metaObj.verificationType = meta.verificationType;
  if (meta.category) metaObj.category = meta.category;
  if (meta.targetAction) metaObj.targetAction = meta.targetAction;

  if (Object.keys(metaObj).length === 0) return cleanDesc;
  return `${cleanDesc}\n<!--prx-meta:${JSON.stringify(metaObj)}-->`;
}

/**
 * Faz o parse da descrição com metadados opcionais. Retorna a descrição limpa
 * e os metadados extraídos.
 */
export function parseMissionDescription(descWithMeta?: string): {
  cleanDescription: string;
  verificationType?: MissionVerificationType;
  category?: string;
  targetAction?: string;
} {
  if (!descWithMeta) return { cleanDescription: "" };
  const match = descWithMeta.match(/<!--(?:nxt|prx)-meta:(.*?)-->/);
  if (!match) {
    return { cleanDescription: descWithMeta.trim() };
  }
  // "nxt-meta" is the legacy marker still stored in rows created before the PRX rebrand.
  const cleanDescription = descWithMeta.replace(/\n?<!--(?:nxt|prx)-meta:.*?-->/g, "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    return {
      cleanDescription,
      verificationType: parsed.verificationType,
      category: parsed.category,
      targetAction: parsed.targetAction,
    };
  } catch {
    return { cleanDescription };
  }
}


/** Régua do PRX SCORE: XP mínimo de cada nível (índice 0 = nível 1). */
export const PRX_LEVEL_THRESHOLDS: ReadonlyArray<number> = [0, 500, 1000, 2000, 3500, 5500, 8000];

export function calculatePrxLevel(score: number): number {
  let level = 1;
  PRX_LEVEL_THRESHOLDS.forEach((min, index) => {
    if (score >= min) level = index + 1;
  });
  return level;
}

/** Progresso dentro do nível atual, para a barra de XP. */
export function levelProgress(score: number): { level: number; floor: number; next: number | null; pct: number; remaining: number } {
  const level = calculatePrxLevel(score);
  const floor = PRX_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = PRX_LEVEL_THRESHOLDS[level] ?? null;
  if (next === null) return { level, floor, next, pct: 100, remaining: 0 };
  const pct = Math.round(((score - floor) / (next - floor)) * 100);
  return { level, floor, next, pct: Math.max(0, Math.min(100, pct)), remaining: Math.max(0, next - score) };
}
