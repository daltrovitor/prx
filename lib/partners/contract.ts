// Hello World
import { formatDocument } from "@/lib/partners/documents";
import {
  REDEMPTION_MODES,
  VISIBILITY_PLANS,
  describeOffer,
  formatMoney,
  mediaBillingText,
} from "@/lib/partners/plans";
import type { CommercialSummary, PartnerSnapshot } from "@/lib/partners/types";

/**
 * Termo de Adesão e Parceria Comercial — PRX PASS.
 *
 * O texto das cláusulas é fixo por versão (TERMS_VERSION). Só a cláusula 3
 * (Resumo Comercial) muda por parceiro/campanha, preenchida pelo formulário do
 * admin. Qualquer mudança de redação exige subir TERMS_VERSION: aceites antigos
 * continuam apontando para a versão e o hash que o representante viu.
 *
 * Módulo isomórfico (sem crypto): o admin usa buildSummaryRows no navegador para
 * pré-visualizar o Resumo; o hash é calculado em contract-hash.ts, no servidor.
 */

export const TERMS_VERSION = "1.0";
export const TERMS_EFFECTIVE_DATE = "2026-09-25";
export const TERMS_ID = `PRX-PASS-TERMO-v${TERMS_VERSION}`;

export const PRX_OPERATOR = {
  legalName: "NXTGEN PARTICIPAÇÕES E SOLUÇÕES DIGITAIS LTDA",
  document: "68025417000142",
  address: "Av. C-206, nº 118, Jardim América, Goiânia/GO",
  forum: "Goiânia/GO",
} as const;

export const ACCEPTANCE_DECLARATION =
  "Declaro que possuo poderes para representar o Parceiro, li o Resumo Comercial, o Termo de Parceria PRX PASS e as políticas vinculadas e concordo com as condições da campanha. Confirmo que as informações da oferta são verdadeiras e que a quantidade indicada estará disponível nos termos contratados.";

/** Brasília não tem horário de verão desde 2019; a PRX opera em Goiânia (UTC−03:00). */
export const PRX_TIME_ZONE = "America/Sao_Paulo";
const BRT_OFFSET = "-03:00";

export type ContractBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; rows: ReadonlyArray<readonly [string, string]> };

export interface ContractSection {
  number: string;
  title: string;
  blocks: ContractBlock[];
}

export interface ContractDocument {
  termsId: string;
  termsVersion: string;
  title: string;
  subtitle: string;
  campaignId: string;
  campaignVersion: number;
  sections: ContractSection[];
}

/* -------------------------------------------------------------------------- */
/* Formatação                                                                  */
/* -------------------------------------------------------------------------- */

/** "2026-10-01" → "01/10/2026" sem passar por Date (evita deslocamento de fuso). */
export function formatDateBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
}

export function formatDateTimeBR(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const text = date.toLocaleString("pt-BR", {
    timeZone: PRX_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${text.replace(", ", " às ")} (horário de Brasília, UTC−03:00)`;
}

/** Janela da campanha: do primeiro ao último segundo dos dias, no horário de Brasília. */
export function campaignWindow(summary: Pick<CommercialSummary, "startDate" | "endDate">): { startsAt: string; endsAt: string } {
  return {
    startsAt: new Date(`${summary.startDate}T00:00:00${BRT_OFFSET}`).toISOString(),
    endsAt: new Date(`${summary.endDate}T23:59:59.999${BRT_OFFSET}`).toISOString(),
  };
}

function pendingValue(value: string, fallback = "A completar pelo parceiro antes do aceite"): string {
  return value.trim() ? value.trim() : fallback;
}

/* -------------------------------------------------------------------------- */
/* Cláusula 3 — Resumo Comercial                                              */
/* -------------------------------------------------------------------------- */

export function buildSummaryRows(partner: PartnerSnapshot, summary: CommercialSummary): Array<readonly [string, string]> {
  const rep = partner.representative;
  const representative = rep.name.trim()
    ? [rep.name.trim(), rep.document ? `CPF ${formatDocument("CPF", rep.document)}` : "", rep.role.trim()].filter(Boolean).join(", ")
    : pendingValue("");
  const plan = VISIBILITY_PLANS[summary.plan];
  const contact = [partner.contact.name, partner.contact.phone, partner.contact.email].map((v) => v.trim()).filter(Boolean).join(" · ");

  return [
    ["Razão social / nome fantasia", `${partner.legalName} / ${partner.tradeName}`],
    ["CNPJ/CPF e representante", `${partner.documentType} ${formatDocument(partner.documentType, partner.document)} · Representante: ${representative}`],
    ["Benefício / vantagem", `${summary.benefitTitle} — ${summary.benefitDescription}`],
    ["Produto / serviço / experiência", summary.eligibleItem],
    ["Preço normal", summary.normalPrice === null ? "Não se aplica" : formatMoney(summary.normalPrice)],
    ["Preço PRX / desconto / brinde", describeOffer(summary)],
    ["Quantidade total garantida", `${summary.quantity.toLocaleString("pt-BR")} ${summary.quantityUnit}`],
    ["Limite por usuário", String(summary.perUserLimit)],
    ["Início da campanha", formatDateBR(summary.startDate)],
    ["Fim da campanha", formatDateBR(summary.endDate)],
    ["Unidades / canais participantes", summary.channels],
    ["Modalidade de uso", summary.redemptionModes.map((mode) => REDEMPTION_MODES[mode].label).join("; ")],
    ["Prazo para uso após aquisição", `${summary.usageDeadlineDays} ${summary.usageDeadlineDays === 1 ? "dia" : "dias"}`],
    [
      "Encerramento antecipado por esgotamento",
      summary.earlyEndOnSellOut
        ? "Autorizado: a campanha pode encerrar quando a quantidade garantida for atingida"
        : "Não autorizado: a quantidade é garantida durante toda a vigência",
    ],
    [
      "Benefício Exclusivo PRX",
      summary.exclusive
        ? `Sim — exclusividade pós-campanha de ${summary.exclusivityMonths} ${summary.exclusivityMonths === 1 ? "mês" : "meses"} (cláusula 7)`
        : "Não",
    ],
    ["Plano de visibilidade", `${plan.label} — ${plan.perks}`],
    [
      "Valor de mídia",
      summary.mediaPrice === 0 ? "R$ 0,00 — sem custo de mídia" : `${formatMoney(summary.mediaPrice)} — ${mediaBillingText(summary.plan, summary.mediaPeriods)}`,
    ],
    ["Repasse / comissão / taxa", summary.commission],
    ["Público elegível no app", summary.minPrxLevel <= 1 ? "Todos os membros elegíveis da PRX" : `Membros a partir do nível ${summary.minPrxLevel}`],
    ["Regras adicionais de uso", summary.rules.length > 0 ? summary.rules.join("; ") : "Nenhuma"],
    ["Contato operacional", pendingValue(contact)],
  ];
}

/* -------------------------------------------------------------------------- */
/* Texto integral                                                              */
/* -------------------------------------------------------------------------- */

const p = (text: string): ContractBlock => ({ kind: "paragraph", text });

function staticSections(): ContractSection[] {
  return [
    {
      number: "4",
      title: "MODALIDADES DE ENTREGA E RESGATE",
      blocks: [
        p("4.1. O Resumo Comercial indicará uma ou mais modalidades:"),
        {
          kind: "list",
          items: [
            "(a) QR Code presencial: a PRX gera código individual, de uso único ou controlado; o usuário apresenta o código no estabelecimento e o PARCEIRO valida na Área do Parceiro antes da entrega;",
            "(b) Voucher/cupom digital: código alfanumérico ou voucher apresentado no caixa ou inserido no e-commerce do PARCEIRO;",
            "(c) Compra no PRX PASS: quando habilitada, o usuário conclui a transação no ambiente PRX e recebe confirmação/QR/voucher, com repasses conforme o Resumo Comercial e o provedor de pagamento;",
            "(d) Link-out: a PRX direciona o usuário para página do PARCEIRO, podendo utilizar identificador de campanha para atribuição de conversão;",
            "(e) Agendamento/reserva: a PRX gera direito à condição e o PARCEIRO confirma data, horário ou disponibilidade;",
            "(f) Lista nominal/check-in: para experiências ou eventos, observadas minimização de dados e necessidade operacional.",
          ],
        },
        p("4.2. A validação eletrônica realizada pelo login do PARCEIRO será considerada evidência operacional do resgate, sem prejuízo de contestação fundamentada."),
        p("4.3. O PARCEIRO não poderá exigir do usuário condição adicional não informada previamente na oferta."),
      ],
    },
    {
      number: "5",
      title: "DISPONIBILIDADE, ESTOQUE E GARANTIA DA OFERTA",
      blocks: [
        p("5.1. O PARCEIRO garante a quantidade de produtos, vagas, serviços ou resgates informada no Resumo Comercial durante a vigência, salvo encerramento antecipado por esgotamento expressamente autorizado na própria oferta."),
        p("5.2. A oferta publicada vincula o PARCEIRO nos limites anunciados. Preço, quantidade, restrições, validade, unidades participantes e demais condições deverão ser verdadeiros, claros e atualizados."),
        p("5.3. Se o PARCEIRO, por fato a ele imputável, deixar de honrar benefício validamente adquirido/reservado dentro da quantidade garantida, deverá, a critério da PRX e sem prejuízo dos direitos do consumidor: (i) cumprir a oferta; (ii) fornecer benefício equivalente ou superior aceito pelo usuário; ou (iii) restituir os valores aplicáveis e ressarcir a PRX por valores que esta comprovadamente tenha desembolsado para solucionar o caso."),
        p("5.4. Além do item 5.3, o descumprimento reiterado ou material da quantidade garantida sujeitará o PARCEIRO a multa contratual de 20% do valor econômico estimado dos benefícios não honrados, limitada ao maior entre R$ 2.000,00 e o valor total da campanha, sem prejuízo de redução judicial se legalmente cabível e de perdas e danos comprovados que excedam a multa quando admitidos em lei."),
        p("5.5. A PRX poderá suspender imediatamente campanha sem estoque, enganosa, irregular, insegura ou com volume relevante de reclamações."),
      ],
    },
    {
      number: "6",
      title: "RESPONSABILIDADE PELO PRODUTO, SERVIÇO E ATENDIMENTO",
      blocks: [
        p("6.1. O PARCEIRO é integralmente responsável pela existência, qualidade, segurança, licitude, fabricação, armazenamento, validade, entrega, execução, garantia, troca, assistência, licenças, autorizações e informações do produto, serviço ou experiência por ele fornecido."),
        p("6.2. Reclamações relativas à qualidade, vício, defeito, entrega, atendimento presencial, execução do serviço ou descumprimento da oferta pelo PARCEIRO deverão ser solucionadas pelo PARCEIRO, sem prejuízo dos direitos que a legislação assegure ao consumidor e de eventual responsabilidade legal da PRX que não possa ser contratualmente afastada."),
        p("6.3. O PARCEIRO manterá canal de atendimento atualizado e responderá às solicitações encaminhadas pela PRX em prazo razoável, priorizando ocorrências urgentes de segurança ou risco ao consumidor."),
        p("6.4. O PARCEIRO indenizará a PRX por condenações, despesas e prejuízos comprovadamente decorrentes de ato ou omissão imputável ao PARCEIRO, assegurado direito de defesa e observada a legislação aplicável."),
      ],
    },
    {
      number: "7",
      title: "EXCLUSIVIDADE DA OFERTA PRX",
      blocks: [
        p("7.1. Não há exclusividade de segmento. A PRX poderá manter parceiros concorrentes da mesma categoria, e o PARCEIRO poderá atuar em outras plataformas."),
        p("7.2. Entretanto, a condição comercial identificada no Resumo Comercial como “Benefício Exclusivo PRX” — considerada em seu conjunto de preço, desconto, brinde ou vantagem material — não poderá ser oferecida pelo PARCEIRO, diretamente ou por plataforma concorrente, ao mesmo público em condições iguais ou materialmente superiores durante a campanha e por até 3 (três) meses após seu encerramento."),
        p("7.3. A restrição do item 7.2 não alcança promoções nacionais do fabricante, liquidações gerais, campanhas obrigatórias de rede/franquia, programas de fidelidade preexistentes ou ofertas públicas de curta duração que não tenham sido estruturadas para reproduzir a vantagem exclusiva PRX, desde que informadas quando previsíveis."),
        p("7.4. O prazo efetivo de exclusividade pós-campanha será exibido no Resumo Comercial e não poderá exceder 3 meses."),
      ],
    },
    {
      number: "8",
      title: "PLANOS DE VISIBILIDADE E MÍDIA",
      blocks: [
        p("8.1. A presença orgânica do BENEFÍCIO poderá ser contratada no plano Básico. O PARCEIRO poderá adquirir destaque adicional na Área do Parceiro."),
        p("8.2. A PRX poderá utilizar modelos de mídia por período, posição, impressão, visita/clique ou campanha, sempre exibindo previamente o preço, orçamento máximo e critério de cobrança."),
        p("8.3. Tabela comercial inicial de referência, sujeita à confirmação no Resumo Comercial:"),
        {
          kind: "list",
          items: [
            "BÁSICO — R$ 0/mês de mídia: presença orgânica no catálogo, página do parceiro e métricas essenciais;",
            "SPOTLIGHT — R$ 299/mês: selo de destaque, prioridade em listas/categorias elegíveis e relatório ampliado;",
            "PRIME — R$ 599/mês: maior destaque em categorias, participação em vitrines/campanhas selecionadas e relatório ampliado;",
            "TAKEOVER — a partir de R$ 1.490 por período de 7 dias: posição premium/banner ou ação temática, conforme inventário disponível.",
          ],
        },
        p("8.4. A contratação de destaque não garante quantidade mínima de vendas, cliques, impressões ou posição fixa, salvo garantia expressa no Resumo Comercial."),
        p("8.5. A lógica foi estruturada como produto de mídia próprio da PRX. Valores, formatos e inventário poderão ser atualizados para novas campanhas, sem alteração retroativa de campanha já contratada."),
        p("8.6. A PRX identificará publicidade paga de maneira compatível com a legislação e suas políticas de transparência."),
      ],
    },
    {
      number: "9",
      title: "PAGAMENTOS, REPASSES E CONCILIAÇÃO",
      blocks: [
        p("9.1. Quando o pagamento ocorrer diretamente no estabelecimento ou site do PARCEIRO, a PRX não receberá o preço da transação, salvo taxa ou comissão expressamente contratada."),
        p("9.2. Quando a compra ocorrer dentro da PRX, o pagamento poderá ser processado por instituição de pagamento/PSP, com split ou repasse ao PARCEIRO, descontadas taxas, comissão, estornos, chargebacks e valores previstos no Resumo Comercial."),
        p("9.3. O calendário de repasses, comissão, taxas de processamento, retenções e documentos fiscais será exibido antes do aceite da campanha."),
        p("9.4. O PARCEIRO é responsável pela emissão dos documentos fiscais relativos aos produtos e serviços por ele fornecidos, salvo estrutura fiscal diversa expressamente formalizada."),
        p("9.5. A PRX poderá reter preventivamente valores estritamente relacionados a transações contestadas, fraude provável, chargeback ou obrigação de reembolso, pelo tempo razoavelmente necessário à apuração."),
      ],
    },
    {
      number: "10",
      title: "ÁREA DO PARCEIRO, LOGIN E SEGURANÇA",
      blocks: [
        p("10.1. O PARCEIRO receberá credenciais para acessar painel com campanhas, resgates, transações, mídia, relatórios e ferramentas operacionais."),
        p("10.2. Login e senha são pessoais e intransferíveis. O PARCEIRO deverá proteger credenciais, limitar perfis administrativos e comunicar imediatamente suspeita de acesso indevido."),
        p("10.3. Ações realizadas por usuários autorizados do PARCEIRO serão registradas e poderão ser utilizadas como evidência operacional."),
        p("10.4. A PRX poderá suspender credenciais em caso de risco de segurança, fraude, desligamento de usuário, violação deste Termo ou determinação legal."),
      ],
    },
    {
      number: "11",
      title: "DADOS, MÉTRICAS E LGPD",
      blocks: [
        p("11.1. A Área do Parceiro poderá exibir métricas como visualizações, cliques, conversões, vendas, resgates, ticket, recorrência, horários, faixas etárias e outros indicadores, desde que em formato permitido pela legislação e pelas políticas de privacidade da PRX."),
        p("11.2. Dados de audiência destinados a marketing e inteligência comercial serão, como regra, agregados, estatísticos ou anonimizados. O PARCEIRO não terá direito automático a nome, telefone, e-mail, CPF, endereço, data de nascimento exata, histórico individual de navegação ou outros dados pessoais de usuários apenas por participar do PRX PASS."),
        p("11.3. Dados individualizados somente serão compartilhados quando necessários à execução da transação, reserva, entrega, suporte ou outra finalidade com base legal válida, limitados ao mínimo necessário e acompanhados das obrigações aplicáveis."),
        p("11.4. O PARCEIRO não poderá vender, enriquecer, combinar, reutilizar ou compartilhar dados recebidos da PRX para finalidade incompatível, nem criar perfis comportamentais de usuários para publicidade não autorizada."),
        p("11.5. É proibido utilizar dados da PRX para treinamento de modelos de inteligência artificial, listas externas de prospecção ou publicidade fora da finalidade autorizada sem base legal e autorização expressa quando necessária."),
        p("11.6. Cada parte cumprirá a LGPD e adotará medidas técnicas e administrativas adequadas. Incidentes que possam afetar dados recebidos da outra parte deverão ser comunicados sem demora injustificada e, quando relevantes, em até 24 horas da ciência."),
        p("11.7. Considerando que a PRX poderá ser acessada por adolescentes, a PRX não disponibilizará ao PARCEIRO ferramentas de perfilamento para direcionamento de publicidade comercial a crianças ou adolescentes. Métricas de idade desse público deverão ser agregadas e utilizadas para mensuração legítima, segurança e inteligência não individualizada, observados o melhor interesse e a legislação aplicável."),
        p("11.8. O PARCEIRO deverá eliminar ou anonimizar dados pessoais recebidos quando encerrada a finalidade, ressalvadas obrigações legais de retenção."),
      ],
    },
    {
      number: "12",
      title: "PUBLICIDADE, PÚBLICO JOVEM E PRODUTOS RESTRITOS",
      blocks: [
        p("12.1. O PARCEIRO declara que sua oferta e comunicação respeitarão o Código de Defesa do Consumidor, regras de publicidade e normas de proteção de crianças e adolescentes."),
        p("12.2. É vedada, em áreas acessíveis a menores, a promoção de produtos ou serviços cuja oferta a esse público seja proibida ou inadequada, inclusive bebidas alcoólicas, tabaco/nicotina, apostas, conteúdo adulto e outros itens legalmente restritos."),
        p("12.3. O PARCEIRO não poderá solicitar à PRX segmentação publicitária de menores baseada em perfil comportamental, interesses inferidos, histórico de navegação ou análise emocional."),
        p("12.4. A PRX poderá recusar, limitar por idade ou retirar campanhas incompatíveis com suas políticas, com a legislação ou com a proteção do público jovem."),
      ],
    },
    {
      number: "13",
      title: "MARCAS, IMAGEM E CONTEÚDO DO PARCEIRO",
      blocks: [
        p("13.1. Durante a vigência da parceria e pelo período necessário à divulgação/arquivo institucional da campanha, o PARCEIRO concede à PRX licença não exclusiva, gratuita, revogável para usos futuros e limitada às finalidades da parceria para utilizar nome empresarial, nome fantasia, marcas, logotipos, imagens de produtos, fotos de estabelecimento e materiais fornecidos pelo PARCEIRO em app, site, redes sociais, apresentações comerciais, materiais de campanha e comunicações da PRX."),
        p("13.2. A PRX poderá redimensionar, recortar e adaptar tecnicamente os materiais sem alterar substancialmente a marca ou atribuir ao PARCEIRO declaração que não tenha feito."),
        p("13.3. O PARCEIRO declara possuir direitos e autorizações sobre os materiais enviados e responderá por reclamações de terceiros decorrentes de conteúdo por ele fornecido."),
        p("13.4. Uso de imagem de pessoas identificáveis fornecida pelo PARCEIRO dependerá das autorizações legalmente necessárias, sob responsabilidade de quem forneceu o material."),
        p("13.5. Encerrada a parceria, a PRX cessará novas campanhas com a marca em prazo razoável, podendo manter registros históricos, relatórios internos, evidências contratuais e publicações pretéritas quando juridicamente permitido."),
      ],
    },
    {
      number: "14",
      title: "PROPRIEDADE INTELECTUAL DA PRX",
      blocks: [
        p("14.1. A adesão não transfere ao PARCEIRO direitos sobre PRX, PRX PASS, software, interfaces, dados, rankings, algoritmos, documentação, layouts ou tecnologia."),
        p("14.2. É proibida engenharia reversa, extração automatizada não autorizada, scraping, cópia de base de dados, tentativa de acesso a informações de outros parceiros ou uso da Área do Parceiro fora das finalidades contratadas."),
      ],
    },
    {
      number: "15",
      title: "AVALIAÇÕES, QUALIDADE E RANKING",
      blocks: [
        p("15.1. A PRX poderá ordenar ofertas segundo critérios como relevância, qualidade, disponibilidade, atratividade da vantagem, desempenho, experiência do usuário, localização quando pertinente e contratação de mídia identificada."),
        p("15.2. Mídia paga não elimina critérios de segurança, qualidade ou elegibilidade."),
        p("15.3. A PRX poderá disponibilizar avaliações e indicadores de qualidade, observadas suas políticas de moderação e a legislação."),
      ],
    },
    {
      number: "16",
      title: "PRAZO, SUSPENSÃO E ENCERRAMENTO",
      blocks: [
        p("16.1. Este Termo vigorará enquanto houver conta ativa ou campanha vigente, podendo campanhas possuir prazos próprios."),
        p("16.2. Qualquer parte poderá encerrar a relação para campanhas futuras mediante aviso eletrônico, sem prejuízo de ofertas já adquiridas, obrigações de repasse, exclusividade pós-campanha expressamente aceita e demais cláusulas que por sua natureza sobrevivam."),
        p("16.3. A PRX poderá suspender imediatamente oferta ou conta em caso de fraude, risco ao consumidor, produto ilícito, violação de dados, uso indevido de marca, descumprimento reiterado de oferta, inadimplência de mídia ou violação grave deste Termo."),
        p("16.4. Sempre que possível e não houver urgência, a PRX notificará o PARCEIRO e concederá prazo razoável para correção."),
      ],
    },
    {
      number: "17",
      title: "ALTERAÇÕES DOS TERMOS",
      blocks: [
        p("17.1. A PRX poderá atualizar este Termo para refletir mudanças legais, tecnológicas ou operacionais."),
        p("17.2. Alterações materiais que afetem obrigações econômicas ou direitos relevantes serão informadas previamente e, quando necessário, submetidas a novo aceite eletrônico."),
        p("17.3. A versão aceita permanecerá disponível na Área do Parceiro, com histórico de versão e data de vigência."),
      ],
    },
    {
      number: "18",
      title: "COMPLIANCE E INTEGRIDADE",
      blocks: [
        p("18.1. O PARCEIRO declara observar legislação anticorrupção, consumerista, tributária, sanitária, trabalhista, ambiental e regulatória aplicável à sua atividade."),
        p("18.2. A PRX poderá solicitar documentos razoáveis para validação cadastral, fiscal, regulatória ou de titularidade bancária."),
        p("18.3. É vedado oferecer benefício fictício, elevar artificialmente preço de referência, manipular métricas, simular resgates ou praticar fraude contra usuários ou a plataforma."),
      ],
    },
    {
      number: "19",
      title: "LIMITAÇÃO E ALOCAÇÃO DE RESPONSABILIDADES",
      blocks: [
        p("19.1. A PRX fornece infraestrutura de intermediação/divulgação e não assume obrigações técnicas próprias do produto ou serviço do PARCEIRO, ressalvadas as responsabilidades que a lei atribua diretamente à PRX."),
        p("19.2. Nenhuma cláusula exclui responsabilidade que não possa ser afastada por lei."),
        p("19.3. Indisponibilidades temporárias decorrentes de manutenção, terceiros, caso fortuito ou força maior serão tratadas com esforços razoáveis de restabelecimento, sem garantia de operação ininterrupta."),
      ],
    },
    {
      number: "20",
      title: "LEI APLICÁVEL E FORO",
      blocks: [
        p("20.1. Aplicam-se as leis brasileiras, incluindo Código Civil, Código de Defesa do Consumidor, LGPD, Marco Civil da Internet, ECA Digital e regulamentação aplicável."),
        p(`20.2. Para controvérsias entre PRX e PARCEIRO, fica eleito o foro da Comarca de ${PRX_OPERATOR.forum}, ressalvada competência legal inderrogável.`),
        p("20.3. Antes de demanda judicial, as partes buscarão solução administrativa de boa-fé por canal eletrônico disponibilizado na Área do Parceiro."),
      ],
    },
  ];
}

export function buildContract(
  partner: PartnerSnapshot,
  campaign: { id: string; version: number; summary: CommercialSummary }
): ContractDocument {
  const operatorDocument = formatDocument("CNPJ", PRX_OPERATOR.document);
  const sections: ContractSection[] = [
    {
      number: "1",
      title: "PARTES E ACEITE ELETRÔNICO",
      blocks: [
        p(
          `1.1. Este Termo regula a relação entre ${PRX_OPERATOR.legalName}, CNPJ nº ${operatorDocument}, com sede à ${PRX_OPERATOR.address}, operadora da plataforma comercialmente denominada PRX e do módulo PRX PASS (“PRX”), e ${partner.legalName}, ${partner.documentType} nº ${formatDocument(partner.documentType, partner.document)}, nome fantasia ${partner.tradeName}, identificado no Resumo Comercial eletrônico (“PARCEIRO”).`
        ),
        p("1.2. Ao selecionar “Li e aceito”, “Aceitar parceria”, “Assinar digitalmente” ou comando equivalente na Área do Parceiro, o representante declara possuir poderes para vincular o PARCEIRO e aceita este Termo, o Resumo Comercial, a Política de Privacidade aplicável e as regras operacionais exibidas antes do aceite."),
        p("1.3. O aceite será registrado com versão do Termo, data e hora, identificador da conta, evidências técnicas de autenticação e demais registros permitidos por lei. A PRX disponibilizará ao PARCEIRO cópia eletrônica do instrumento aceito."),
        p("1.4. Havendo assinatura eletrônica por provedor externo, as partes reconhecem a validade do meio utilizado para comprovação de autoria e integridade, nos termos da legislação brasileira aplicável."),
        p("1.5. O Resumo Comercial eletrônico integra este Termo e prevalece quanto aos dados variáveis de cada campanha: benefício, preço, quantidade, vigência, unidades participantes, modalidade de resgate, mídia contratada, valores e condições específicas."),
      ],
    },
    {
      number: "2",
      title: "OBJETO",
      blocks: [
        p("2.1. O PARCEIRO disponibilizará aos usuários elegíveis da PRX produtos, serviços, vantagens, descontos, brindes, experiências ou condições comerciais exclusivas (“BENEFÍCIO”), nos termos do Resumo Comercial."),
        p("2.2. A PRX disponibilizará infraestrutura digital para divulgação, descoberta, aquisição ou resgate do BENEFÍCIO, emissão/validação de vouchers ou QR Codes, métricas e, quando contratada, mídia de destaque."),
        p("2.3. A parceria não cria franquia, representação comercial, sociedade, vínculo trabalhista, mandato ou exclusividade de segmento entre as partes."),
      ],
    },
    {
      number: "3",
      title: "RESUMO COMERCIAL DA CAMPANHA",
      blocks: [{ kind: "table", rows: buildSummaryRows(partner, campaign.summary) }],
    },
    ...staticSections(),
  ];

  return {
    termsId: TERMS_ID,
    termsVersion: TERMS_VERSION,
    title: "TERMO DE ADESÃO E PARCERIA COMERCIAL — PRX PASS",
    subtitle: "Benefícios, ofertas, experiências, vendas, resgates e mídia dentro do ecossistema PRX",
    campaignId: campaign.id,
    campaignVersion: campaign.version,
    sections,
  };
}

/**
 * Forma canônica do contrato para cálculo de hash: mesma entrada, mesmo texto.
 * Inclui identificadores de versão para que o hash mude junto com eles.
 */
export function contractPlainText(doc: ContractDocument): string {
  const lines: string[] = [
    doc.title,
    doc.subtitle,
    `Termo ${doc.termsId} · Instrumento ${doc.campaignId} · Resumo Comercial v${doc.campaignVersion}`,
    "",
  ];
  for (const section of doc.sections) {
    lines.push(`${section.number}. ${section.title}`);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") lines.push(block.text);
      if (block.kind === "list") block.items.forEach((item) => lines.push(`- ${item}`));
      if (block.kind === "table") block.rows.forEach(([label, value]) => lines.push(`${label}: ${value}`));
    }
    lines.push("");
  }
  return lines.join("\n").normalize("NFC");
}

/** O que falta no cadastro para o representante poder aceitar. */
export function missingForAcceptance(partner: PartnerSnapshot): string[] {
  const missing: string[] = [];
  if (!partner.representative.name.trim()) missing.push("nome do representante");
  if (!partner.representative.document) missing.push("CPF do representante");
  if (!partner.representative.role.trim()) missing.push("cargo do representante");
  if (!partner.contact.name.trim() || !(partner.contact.phone.trim() || partner.contact.email.trim())) missing.push("contato operacional");
  return missing;
}
