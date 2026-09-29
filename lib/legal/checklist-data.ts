// Hello World

/*
 * "PRX — Checklist Jurídico e Regulatório" (documento de trabalho para validação
 * jurídica, setembro de 2026), item a item. O texto vem do documento; o painel só
 * guarda por cima o andamento: status, responsável, parecer e quem alterou.
 */

export const LEGAL_PRIORITIES = ["CRITICA", "ALTA", "MEDIA"] as const;
export type LegalPriority = (typeof LEGAL_PRIORITIES)[number];
export const PRIORITY_LABEL: Record<LegalPriority, string> = { CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Média" };

export const LEGAL_STATUSES = ["pending", "in_review", "done", "blocker"] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];
export const STATUS_LABEL: Record<LegalStatus, string> = { pending: "Pendente", in_review: "Em validação", done: "Concluído", blocker: "Bloqueador" };

export const LEGAL_MODULES = ["bank", "invest", "menores", "coins", "lgpd", "pass", "live", "fiscal", "consumidor", "kyc", "tecnologia", "geral"] as const;
export type LegalModule = (typeof LEGAL_MODULES)[number];
export const MODULE_LABEL: Record<LegalModule, string> = {
  bank: "PRX BANK",
  invest: "PRX INVEST",
  menores: "Menores de 18",
  coins: "PRX Coins",
  lgpd: "LGPD / ANPD",
  pass: "PRX PASS / marketplace",
  live: "PRX LIVE",
  fiscal: "Fiscal / societário / PI",
  consumidor: "Consumidor / termos",
  kyc: "KYC / PLD-FTP",
  tecnologia: "Tecnologia",
  geral: "Geral",
};

/** Onde o item aparece no painel: matriz e frentes, os documentos ou o Mapa do Dinheiro. */
export type LegalSection = "checklist" | "documentos" | "dinheiro";

export interface LegalChecklistItem {
  id: string;
  /** Seção do documento, ex.: "2. PRX BANK — Banco Central". */
  category: string;
  section: LegalSection;
  module: LegalModule;
  title: string;
  description: string;
  /** Órgão regulador citado no documento, quando houver. */
  authority: string | null;
  priority: LegalPriority;
  status: LegalStatus;
  responsible: string;
  /** Responsável ideal indicado no documento ("" quando o documento não indica). */
  suggestedResponsible: string;
  /** Parecer jurídico / anotações (no Mapa do Dinheiro, a resposta). */
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

type Seed = Pick<LegalChecklistItem, "id" | "category" | "section" | "module" | "title" | "description" | "authority" | "priority" | "suggestedResponsible"> & { status?: LegalStatus };

const MATRIX = "1. Matriz geral de prioridades";

/** [id, módulo, área/órgão, órgão, prioridade, validação necessária, responsável ideal] */
const MATRIX_ROWS: ReadonlyArray<[string, LegalModule, string, string | null, LegalPriority, string, string]> = [
  ["m-bank", "bank", "Banco Central — PRX BANK", "Banco Central", "CRITICA", "Validar conta pré-paga, saldo, cartão, Pix, emissão de moeda eletrônica e modelo BaaS.", "Preferencialmente parceiro BaaS autorizado pelo BCB"],
  ["m-invest", "invest", "CVM — PRX INVEST", "CVM", "CRITICA", "Definir limites da divulgação, distribuição, intermediação e recomendação de investimentos.", "Corretora/plataforma autorizada, conforme o modelo"],
  ["m-invest-empresas", "invest", "CVM — investimento em empresas", "CVM", "CRITICA", "Verificar enquadramento de equity, crowdfunding, dívida conversível ou outras ofertas.", "Parceiro regulado ou estrutura autorizada aplicável"],
  ["m-lgpd", "lgpd", "ANPD / LGPD", "ANPD", "CRITICA", "Mapear dados, bases legais, compartilhamentos, segurança, retenção, incidentes e direitos dos titulares.", "PRX + fornecedores"],
  ["m-menores", "menores", "Menores de 18 anos", null, "CRITICA", "Definir regras por faixa etária para cadastro, contratos, compras, BANK, INVEST, LIVE e dados.", "PRX + parceiros regulados"],
  ["m-coins", "coins", "PRX Coins", null, "CRITICA", "Definir natureza jurídica dos pontos e evitar características financeiras não pretendidas.", "PRX"],
  ["m-cdc", "consumidor", "CDC / consumidor", null, "CRITICA", "Adequar compra, informação, cancelamento, arrependimento, reembolso, SAC e responsabilidades.", "PRX + parceiros"],
  ["m-kyc", "kyc", "KYC / PLD-FTP", null, "CRITICA", "Definir identificação e controles de prevenção à lavagem de dinheiro nos módulos regulados.", "Principalmente BaaS/corretora"],
  ["m-pass", "pass", "PRX PASS", null, "ALTA", "Contrato de adesão, oferta, quantidade, validade, resgate e responsabilidade do parceiro.", "PRX"],
  ["m-marketplace", "pass", "Marketplace / vendas", null, "ALTA", "Definir se PRX é intermediadora ou vendedora; checkout, split, repasse e fiscal.", "PRX"],
  ["m-live", "live", "PRX LIVE", null, "ALTA", "Ingressos, cancelamento, estorno, produtor responsável, classificação etária e menores.", "PRX + produtor"],
  ["m-fiscal", "fiscal", "Fiscal / societário", null, "ALTA", "CNAEs, objeto social, notas fiscais, comissões, receitas, split e tributação.", "PRX"],
  ["m-marco-civil", "tecnologia", "Marco Civil / tecnologia", null, "ALTA", "Registros, segurança, responsabilidades da aplicação e fornecedores tecnológicos.", "PRX"],
  ["m-contratos-tec", "tecnologia", "Contratos tecnológicos", null, "ALTA", "Código, propriedade intelectual, APIs, cloud, gateways, BaaS e integrações.", "PRX"],
  ["m-inpi", "fiscal", "INPI", "INPI", "MEDIA", "Registro PRX e submarcas nas classes adequadas.", "PRX"],
  ["m-termos", "consumidor", "Termos do aplicativo", null, "MEDIA", "Termos de Uso, Privacidade, Coins, compras, parceiros, ingressos e investimentos.", "PRX"],
  ["m-lojas", "tecnologia", "App Store / Google Play", null, "MEDIA", "Validar políticas aplicáveis a pagamentos e serviços financeiros.", "PRX"],
];

const RESP = Object.fromEntries(MATRIX_ROWS.map(([id, , , , , , resp]) => [id, resp])) as Record<string, string>;

/** [id, seção, módulo, órgão, prioridade, título, texto do documento, responsável ideal] */
const FRONT_ROWS: ReadonlyArray<[string, string, LegalModule, string | null, LegalPriority, string, string, string]> = [
  ["f-bank-enquadramento", "2. PRX BANK — Banco Central", "bank", "Banco Central", "CRITICA", "Autorização própria ou camada tecnológica sobre BaaS autorizado", "Tratar como bloqueador de lançamento. O jurídico deve determinar se a PRX exercerá alguma atividade sujeita a autorização própria ou se atuará como camada tecnológica/comercial conectada a uma instituição BaaS já autorizada.", RESP["m-bank"]],
  ["f-bank-arquitetura", "2. PRX BANK — Banco Central", "bank", "Banco Central", "CRITICA", "Validar a arquitetura Usuário → interface PRX → parceiro BaaS", "Arquitetura a validar: Usuário → interface PRX → parceiro BaaS → conta/saldo/Pix/cartão.", RESP["m-bank"]],
  ["f-bank-contratos", "2. PRX BANK — Banco Central", "bank", "Banco Central", "CRITICA", "Confirmar em contrato quem presta cada serviço financeiro", "Confirmar contratualmente quem abre e mantém a conta, emite cartão, mantém os recursos, executa Pix, realiza KYC/PLD-FTP, atende o cliente e responde perante o Banco Central. A comunicação e as telas do app precisam deixar clara a identidade do efetivo prestador do serviço financeiro.", RESP["m-bank"]],
  ["f-invest-parecer", "3. PRX INVEST — CVM", "invest", "CVM", "CRITICA", "Parecer regulatório com as hipóteses A, B, C e D", "Produzir parecer regulatório específico. O jurídico deve separar quatro hipóteses: (A) simples conexão do usuário com instituição autorizada; (B) distribuição/intermediação; (C) recomendação individualizada; e (D) investimento direto em empresas/startups.", RESP["m-invest"]],
  ["f-invest-ofertas", "3. PRX INVEST — CVM", "invest", "CVM", "CRITICA", "Regime da CVM para equity, crowdfunding e dívida conversível", "Se houver equity, crowdfunding, dívida conversível ou oferta de valores mobiliários, verificar especificamente o regime da CVM aplicável e se a operação deve ocorrer por plataforma registrada/autorizada. Para o lançamento, estudar prioritariamente uma integração com instituição/plataforma regulada, evitando que a PRX exerça inadvertidamente atividade privativa.", RESP["m-invest-empresas"]],
  ["f-menores-matriz", "4. Menores de 18 anos", "menores", null, "CRITICA", "Matriz jurídica por faixa etária (13–15, 16–17 e 18+)", "Criar uma matriz jurídica por faixa etária, sugeridamente 13–15, 16–17 e 18+, definindo o que cada grupo poderá fazer em PRX PASS, BANK, LIVE, INVEST, compras e PRX Coins.", RESP["m-menores"]],
  ["f-menores-capacidade", "4. Menores de 18 anos", "menores", null, "CRITICA", "Capacidade civil, consentimento dos responsáveis e dados de adolescentes", "Validar capacidade civil, necessidade de participação/consentimento de responsáveis em cada operação, regras específicas dos parceiros financeiros e o tratamento de dados de crianças e adolescentes sob a LGPD e o princípio do melhor interesse. Não tratar a questão apenas com um checkbox de idade.", RESP["m-menores"]],
  ["f-coins-natureza", "5. PRX Coins", "coins", null, "CRITICA", "Natureza jurídica e econômica dos PRX Coins", "Definir formalmente a natureza jurídica e econômica dos PRX Coins. O desenho inicial a ser estudado é de pontos promocionais/fidelidade concedidos por comportamentos ou ações elegíveis e trocados por benefícios, descontos ou experiências.", RESP["m-coins"]],
  ["f-coins-parecer", "5. PRX Coins", "coins", null, "CRITICA", "Parecer sobre compra, transferência, conversão, saque e expiração", "O parecer deve analisar especialmente: possibilidade de compra de Coins; transferência entre usuários; conversão em reais; saque; negociação; rendimento/remuneração; expiração; estorno; fraude; uso como meio de pagamento; regras de concessão e retirada. Quanto mais características financeiras existirem, maior a necessidade de reavaliar o enquadramento regulatório.", RESP["m-coins"]],
  ["f-coins-termos", "5. PRX Coins", "coins", null, "CRITICA", "Termos: não é aposta, não depende de sorte, sem promessa de retorno", "Também deixar claro nos termos, se compatível com o modelo final, que os pontos não constituem aposta, não dependem de sorte e não representam promessa de retorno financeiro.", RESP["m-coins"]],
  ["f-lgpd-inventario", "6. LGPD / ANPD", "lgpd", "ANPD", "CRITICA", "Inventário completo dos dados tratados", "Realizar inventário completo dos dados tratados pela PRX: identificação, CPF, nascimento, dados de responsáveis, escola/faculdade quando coletados, comportamento no app, compras, interesses, transações, investimentos, autenticação e eventual localização.", RESP["m-lgpd"]],
  ["f-lgpd-governanca", "6. LGPD / ANPD", "lgpd", "ANPD", "CRITICA", "Bases legais, retenção, compartilhamento, DPA, incidentes e RIPD", "Definir finalidade e base legal de cada tratamento; controlador e operadores; retenção e descarte; compartilhamento; direitos dos titulares; segurança; encarregado quando aplicável; contratos/DPA; transferências internacionais; plano de resposta a incidentes e eventual Relatório de Impacto à Proteção de Dados.", RESP["m-lgpd"]],
  ["f-pass-fluxo", "7. PRX PASS / marketplace", "pass", null, "ALTA", "Quem vende e quem recebe o dinheiro em cada operação", "Definir juridicamente quem vende e quem recebe o dinheiro em cada operação. Mapear ao menos três cenários: voucher com pagamento direto ao parceiro; pagamento à PRX com posterior repasse; ou gateway com split entre parceiro e PRX.", RESP["m-marketplace"]],
  ["f-pass-responsabilidades", "7. PRX PASS / marketplace", "pass", null, "ALTA", "Responsabilidades em cada cenário de venda", "Para cada cenário, definir responsabilidade perante o consumidor, emissão fiscal, comissão, chargeback, estorno, prazo de repasse, indisponibilidade de estoque/benefício, validade, quantidade prometida e responsabilidade por qualidade/entrega.", RESP["m-pass"]],
  ["f-live-termos", "8. PRX LIVE — ingressos", "live", null, "ALTA", "Termos próprios para ingressos e eventos", "Criar termos próprios para ingressos e eventos: cancelamento, arrependimento quando aplicável, reembolso, adiamento, mudança de local/data, chargeback, taxas, meia-entrada quando aplicável, classificação etária, eventos 18+, eventos teen e regras para menores.", RESP["m-live"]],
  ["f-live-produtor", "8. PRX LIVE — ingressos", "live", null, "ALTA", "Responsabilidade da PRX separada da do produtor", "Separar claramente, quando refletir a operação real, a responsabilidade da PRX como plataforma de comercialização/intermediação da responsabilidade do produtor pela realização do evento.", RESP["m-live"]],
  ["f-fiscal-tributos", "9. Fiscal, societário e propriedade intelectual", "fiscal", null, "ALTA", "Objeto social, CNAEs, regime tributário e emissão fiscal", "Revisar objeto social, CNAEs, regime tributário, emissão de documentos fiscais, receitas de comissão, publicidade, ingressos e demais fontes de receita. Alinhar o fluxo tributário ao fluxo financeiro real.", RESP["m-fiscal"]],
  ["f-fiscal-pi", "9. Fiscal, societário e propriedade intelectual", "fiscal", "INPI", "ALTA", "Marcas no INPI e cessão de direitos sobre software e materiais", "Providenciar estratégia de proteção de PRX e submarcas no INPI e assegurar que contratos com desenvolvedores, designers e fornecedores atribuam corretamente à PRX os direitos patrimoniais necessários sobre software, interfaces, materiais e demais ativos criados.", RESP["m-contratos-tec"]],
  ["f-arquitetura", "12. Arquitetura regulatória sugerida", "geral", null, "CRITICA", "Validar a arquitetura regulatória sugerida", "PRX = tecnologia + marca + comunidade + distribuição. PRX BANK = interface PRX + instituição regulada/autorizada pelo Banco Central. PRX INVEST = interface/integração + instituição ou plataforma regulada pela CVM/BCB, conforme o produto. PRX PASS = benefícios/marketplace + parceiros comerciais. PRX LIVE = plataforma de ingressos + produtores responsáveis pelos eventos.", ""],
  ["f-mapa-regulatorio", "13. Pedido objetivo ao advogado", "geral", null, "CRITICA", "Mapa Regulatório da PRX", "Elaborar um Mapa Regulatório da PRX, separado por PRX PASS, PRX BANK, PRX INVEST, PRX LIVE, marketplace e PRX Coins. Para cada atividade, identificar órgão regulador, legislação aplicável, licença/registro/autorização necessária, CNAE, responsabilidade da PRX, responsabilidade do parceiro, regras para menores, LGPD, PLD/KYC, CDC, tributação, contratos necessários e o que obrigatoriamente precisa estar pronto antes do lançamento. A prioridade é estruturar BANK e INVEST por meio de parceiros regulados, verificando até onde a PRX pode operar como interface/white label sem autorização própria.", "Advogado responsável"],
];

/** Os documentos que devem estar prontos/revisados antes do lançamento; prioridade herdada da área na matriz. */
const DOCUMENTS: ReadonlyArray<[string, LegalModule, LegalPriority]> = [
  ["Parecer regulatório PRX BANK", "bank", "CRITICA"],
  ["Parecer regulatório PRX INVEST", "invest", "CRITICA"],
  ["Parecer específico PRX Coins", "coins", "CRITICA"],
  ["Matriz jurídica para usuários menores de 18 anos", "menores", "CRITICA"],
  ["Termos de Uso PRX", "consumidor", "MEDIA"],
  ["Política de Privacidade / LGPD", "lgpd", "CRITICA"],
  ["Política e regulamento PRX Coins", "coins", "CRITICA"],
  ["Contrato PRX PASS – Parceiro", "pass", "ALTA"],
  ["Contrato/Termos PRX LIVE", "live", "ALTA"],
  ["Termos de Compra / Marketplace", "pass", "ALTA"],
  ["Política de cancelamento, estorno e reembolso", "consumidor", "CRITICA"],
  ["Contrato BaaS", "bank", "CRITICA"],
  ["Contrato com corretora/plataforma de investimentos", "invest", "CRITICA"],
  ["DPA / contratos LGPD com fornecedores", "lgpd", "CRITICA"],
  ["Plano de resposta a incidentes de segurança", "lgpd", "CRITICA"],
  ["Contrato com desenvolvedor + propriedade intelectual/cessões necessárias", "tecnologia", "ALTA"],
  ["Política operacional para menores e responsáveis", "menores", "CRITICA"],
  ["Matriz de CNAEs, tributação e emissão fiscal", "fiscal", "ALTA"],
  ["Pedidos/registros de marca PRX e submarcas no INPI", "fiscal", "MEDIA"],
  ["Mapa de responsabilidades PRX × parceiro × consumidor", "consumidor", "ALTA"],
];

/** Mapa do Dinheiro: Usuário paga → quem recebe? → … → quem responde ao consumidor? */
export const MONEY_MAP_QUESTIONS = [
  "Usuário paga",
  "Quem recebe?",
  "Onde fica o dinheiro?",
  "Quem emite NF?",
  "Quanto fica para a PRX?",
  "Quem repassa?",
  "Quem devolve?",
  "Quem sofre chargeback?",
  "Quem faz KYC?",
  "Quem responde ao consumidor?",
] as const;

export const LEGAL_SEEDS: ReadonlyArray<Seed> = [
  ...MATRIX_ROWS.map(([id, module, title, authority, priority, description, suggestedResponsible]): Seed => ({
    id,
    category: MATRIX,
    section: "checklist",
    module,
    title,
    description,
    authority,
    priority,
    suggestedResponsible,
  })),
  ...FRONT_ROWS.map(([id, category, module, authority, priority, title, description, suggestedResponsible]): Seed => ({
    id,
    category,
    section: "checklist",
    module,
    title,
    description,
    authority,
    priority,
    suggestedResponsible,
    // O documento manda tratar o enquadramento do BANK como bloqueador de lançamento.
    ...(id === "f-bank-enquadramento" ? { status: "blocker" as const } : {}),
  })),
  ...DOCUMENTS.map(([title, module, priority], i): Seed => ({
    id: `d-${String(i + 1).padStart(2, "0")}`,
    category: "10. Documentos que devem estar prontos/revisados antes do lançamento",
    section: "documentos",
    module,
    title,
    description: "Documento que deve estar pronto e revisado antes do lançamento.",
    authority: null,
    priority,
    suggestedResponsible: "",
  })),
  ...MONEY_MAP_QUESTIONS.map((title, i): Seed => ({
    id: `q-${String(i + 1).padStart(2, "0")}`,
    category: "11. Mapa do Dinheiro",
    section: "dinheiro",
    module: "geral",
    title,
    description: "Responder para cada operação do aplicativo antes da implementação definitiva.",
    authority: null,
    priority: "CRITICA",
    suggestedResponsible: "",
  })),
];

/** O item como sai do documento, antes de qualquer andamento. */
export function seedItem(seed: Seed): LegalChecklistItem {
  const { status = "pending", ...rest } = seed;
  return { ...rest, status, responsible: seed.suggestedResponsible, notes: "", updatedAt: null, updatedBy: null };
}
