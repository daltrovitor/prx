// Hello World
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { User } from "@/hooks/use-auth";
import { Button, Checkbox, Field, Input, Notice, ProgressBar, RadioCards, Select, Tag } from "@/components/app/ui";
import { DocumentPicker } from "@/components/family/document-picker";
import { postJson } from "@/components/family/family-client";
import { maskCpfInput } from "@/lib/cpf-mask";
import { ageGroup } from "@/lib/family/age";
import { INCOME_LABEL, INCOME_RANGES, type DocumentKind, type DocumentRef, type IncomeRange, type TeenPath } from "@/lib/family/types";
import { UFS, bankKycSchema, type BankKycState, type Uf } from "@/lib/kyc/types";
import { isValidCpf } from "@/lib/prx/pix";

type Step = "dados" | "endereco" | "perfil" | "documentos";
const STEPS: Step[] = ["dados", "endereco", "perfil", "documentos"];
const TITLES: Record<Step, { title: string; body: string }> = {
  dados: { title: "Seus dados", body: "Como estão no seu documento. O CPF abre uma única conta PRX." },
  endereco: { title: "Endereço", body: "É para onde enviamos o seu cartão." },
  perfil: { title: "Perfil financeiro", body: "Perguntas obrigatórias do Banco Central para qualquer conta de pagamento." },
  documentos: { title: "Documento com foto", body: "RG ou CNH, frente e verso, com as informações legíveis." },
};

const maskPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
const maskCep = (raw: string) => raw.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

function groupOf(birthDate: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && new Date(`${birthDate}T12:00:00Z`).getTime() < Date.now() ? ageGroup(birthDate) : null;
}

/**
 * Abertura do PRX BANK (KYC bancário). Só aqui — e na Conta Pai — o PRX pede
 * documentos. Menores de 18 abrem a conta com o responsável vinculado (ou
 * emancipação, a partir dos 16). Tudo é revalidado no servidor.
 */
export function BankKycPanel({ member, kyc, onDone }: { member: User; kyc: BankKycState; onDone: () => Promise<void> | void }) {
  if (kyc.status === "pending") return <KycPending kyc={kyc} />;
  return <KycForm member={member} rejectedNote={kyc.status === "rejected" ? kyc.reviewNote || "Revise os dados e os documentos." : null} onDone={onDone} />;
}

function KycPending({ kyc }: { kyc: BankKycState }) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">PRX BANK</h1>
      <section className="glass space-y-4 rounded-[28px] p-6">
        <Tag>Em análise</Tag>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Recebemos sua abertura de conta</h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          A equipe PRX confere seus dados e documentos em até 2 dias úteis. Você recebe o aviso aqui assim que a conta for liberada.
        </p>
        {kyc.awaitingGuardian && (
          <Notice tone="warning">Como você tem menos de 18 anos, seu responsável precisa aceitar o vínculo na Conta Pai dele. Peça para ele abrir o PRX e aprovar.</Notice>
        )}
        {kyc.awaitingEmancipation && <Notice>Sua certidão de emancipação também está em análise.</Notice>}
      </section>
    </div>
  );
}

function KycForm({ member, rejectedNote, onDone }: { member: User; rejectedNote: string | null; onDone: () => Promise<void> | void }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("dados");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dados, setDados] = useState({ fullName: member.name || "", cpf: "", birthDate: "", motherName: "", phone: "" });
  const [minorPath, setMinorPath] = useState<TeenPath | "">("");
  const [parentEmail, setParentEmail] = useState("");
  const [address, setAddress] = useState({ cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" as Uf | "" });
  const [perfil, setPerfil] = useState<{ occupation: string; incomeRange: IncomeRange | ""; pep: "no" | "yes" | "" }>({ occupation: "", incomeRange: "", pep: "" });
  const [docs, setDocs] = useState<Partial<Record<DocumentKind, DocumentRef>>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  const group = groupOf(dados.birthDate);
  const minor = group === "child" || group === "teen";
  const index = STEPS.indexOf(step);

  function go(next: Step) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextFromDados(event: FormEvent) {
    event.preventDefault();
    const cpf = dados.cpf.replace(/\D/g, "");
    if (dados.fullName.trim().split(/\s+/).length < 2) return setError("Informe o nome completo, com sobrenome.");
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os 11 números.");
    if (!group) return setError("Informe a data de nascimento.");
    if (group === "over") return setError("O PRX BANK é para jovens até 29 anos.");
    if (dados.motherName.trim().split(/\s+/).length < 2) return setError("Informe o nome completo da sua mãe.");
    if (dados.phone.replace(/\D/g, "").length !== 11) return setError("Informe o celular com DDD.");
    if (minor) {
      const path = group === "child" ? "linked" : minorPath;
      if (!path) return setError("Escolha: conta com o seu responsável ou emancipação.");
      if (path === "linked" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) return setError("Informe o e-mail do seu responsável.");
      if (group === "child" && minorPath !== "linked") setMinorPath("linked");
    }
    go("endereco");
  }

  function nextFromEndereco(event: FormEvent) {
    event.preventDefault();
    if (address.cep.replace(/\D/g, "").length !== 8) return setError("CEP inválido.");
    if (!address.street.trim() || !address.number.trim() || !address.district.trim() || !address.city.trim() || !address.state) return setError("Preencha o endereço completo.");
    go("perfil");
  }

  function nextFromPerfil(event: FormEvent) {
    event.preventDefault();
    if (perfil.occupation.trim().length < 2) return setError("Informe a sua ocupação.");
    if (!perfil.incomeRange) return setError("Escolha a faixa de renda.");
    if (!perfil.pep) return setError("Responda se você é pessoa politicamente exposta.");
    go("documentos");
  }

  async function submit() {
    const path: TeenPath | undefined = minor ? (group === "child" ? "linked" : minorPath || undefined) : undefined;
    const payload = {
      ...dados,
      occupation: perfil.occupation,
      incomeRange: perfil.incomeRange,
      pep: perfil.pep === "yes",
      address,
      documents: Object.values(docs).filter((d): d is DocumentRef => Boolean(d)),
      minorPath: path,
      parentEmail: path === "linked" ? parentEmail : "",
      termsAccepted,
    };
    // Mesma validação do servidor, só para mostrar o erro antes de enviar.
    const parsed = bankKycSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados.");
    setBusy(true);
    setError(null);
    const result = await postJson("/api/bank/kyc", payload);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    await onDone();
  }

  const setDoc = (kind: DocumentKind) => (ref: DocumentRef | null) => setDocs((d) => ({ ...d, [kind]: ref ?? undefined }));

  if (!started) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">PRX BANK</h1>
        {rejectedNote && <Notice tone="warning">Sua abertura anterior não foi aprovada: {rejectedNote}</Notice>}
        <section className="prx-holo space-y-4 rounded-[28px] p-6 sm:p-8">
          <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white">Abra sua conta digital</h2>
          <p className="text-[15px] leading-relaxed text-white/85">
            Pix, cartão e PRX Coins em cada compra em parceiro. Leva uns 3 minutos: seus dados, endereço para o cartão e uma foto do documento.
          </p>
          <Button variant="secondary" onClick={() => setStarted(true)}>
            Abrir minha conta
          </Button>
        </section>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Seus documentos ficam em área privada e são usados só para abrir a conta e prevenir fraudes, como exige o Banco Central. O resto do PRX continua liberado sem nada disso.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[13px] font-medium text-muted-foreground">
        Abertura de conta · passo {index + 1} de {STEPS.length}
      </p>
      <div className="mt-2">
        <ProgressBar value={index + 1} max={STEPS.length} label="Progresso da abertura de conta" />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-[36px]">{TITLES[step].title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{TITLES[step].body}</p>

          <div className="glass mt-6 rounded-[28px] p-5 sm:p-7">
            {step === "dados" && (
              <form onSubmit={nextFromDados} className="space-y-4">
                <Field label="Nome completo">{(id) => <Input id={id} autoComplete="name" value={dados.fullName} onChange={(e) => setDados({ ...dados, fullName: e.target.value })} required />}</Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="CPF">{(id) => <Input id={id} inputMode="numeric" placeholder="000.000.000-00" value={dados.cpf} onChange={(e) => setDados({ ...dados, cpf: maskCpfInput(e.target.value) })} required />}</Field>
                  <Field label="Data de nascimento">
                    {(id) => <Input id={id} type="date" autoComplete="bday" value={dados.birthDate} onChange={(e) => setDados({ ...dados, birthDate: e.target.value })} required className="cursor-pointer" />}
                  </Field>
                </div>
                <Field label="Nome completo da mãe">{(id) => <Input id={id} value={dados.motherName} onChange={(e) => setDados({ ...dados, motherName: e.target.value })} required />}</Field>
                <Field label="Celular com DDD">
                  {(id) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98888-7777" value={dados.phone} onChange={(e) => setDados({ ...dados, phone: maskPhone(e.target.value) })} required />}
                </Field>
                {minor && (
                  <div className="space-y-3 rounded-2xl bg-surface p-4">
                    <p className="text-[14px] leading-relaxed text-ink">
                      {group === "child"
                        ? "Com menos de 16 anos, a conta é aberta com o seu responsável: ele aceita o vínculo na Conta Pai."
                        : "Com 16 ou 17 anos, a conta é aberta com o seu responsável ou com a certidão de emancipação."}
                    </p>
                    {group === "teen" && (
                      <RadioCards
                        label="Como você quer abrir a conta?"
                        value={minorPath as TeenPath}
                        onChange={setMinorPath}
                        options={[
                          { value: "linked", title: "Com meu responsável", body: "Ele aprova na Conta Pai e acompanha a conta." },
                          { value: "emancipated", title: "Sou emancipado(a)", body: "Envio a certidão de emancipação." },
                        ]}
                      />
                    )}
                    {(group === "child" || minorPath === "linked") && (
                      <Field label="E-mail do responsável (Conta Pai)" hint="Ainda não tem? Ele abre em prx.app.br/sou-pai.">
                        {(id, hint) => <Input id={id} type="email" aria-describedby={hint} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />}
                      </Field>
                    )}
                  </div>
                )}
                <Actions error={error} submitLabel="Continuar" onBack={() => setStarted(false)} />
              </form>
            )}

            {step === "endereco" && (
              <form onSubmit={nextFromEndereco} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                  <Field label="CEP">{(id) => <Input id={id} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={address.cep} onChange={(e) => setAddress({ ...address, cep: maskCep(e.target.value) })} required />}</Field>
                  <Field label="Rua">{(id) => <Input id={id} autoComplete="address-line1" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />}</Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                  <Field label="Número">{(id) => <Input id={id} value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} required />}</Field>
                  <Field label="Complemento (opcional)">{(id) => <Input id={id} autoComplete="address-line2" value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />}</Field>
                </div>
                <Field label="Bairro">{(id) => <Input id={id} value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} required />}</Field>
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <Field label="Cidade">{(id) => <Input id={id} autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />}</Field>
                  <Field label="UF">
                    {(id) => (
                      <Select id={id} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value as Uf })} required>
                        <option value="">UF</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <Actions error={error} submitLabel="Continuar" onBack={() => go("dados")} />
              </form>
            )}

            {step === "perfil" && (
              <form onSubmit={nextFromPerfil} className="space-y-5">
                <Field label="Ocupação" hint="Ex.: estudante, estagiário, desenvolvedor.">
                  {(id, hint) => <Input id={id} aria-describedby={hint} value={perfil.occupation} onChange={(e) => setPerfil({ ...perfil, occupation: e.target.value })} required />}
                </Field>
                <RadioCards
                  label="Renda mensal"
                  value={perfil.incomeRange as IncomeRange}
                  onChange={(value) => setPerfil({ ...perfil, incomeRange: value })}
                  options={INCOME_RANGES.map((value) => ({ value, title: INCOME_LABEL[value] }))}
                />
                <RadioCards
                  label="Você é pessoa politicamente exposta (PEP)?"
                  value={perfil.pep as "no" | "yes"}
                  onChange={(value) => setPerfil({ ...perfil, pep: value })}
                  options={[
                    { value: "no", title: "Não sou" },
                    { value: "yes", title: "Sou PEP", body: "Exerço ou exerci cargo público relevante nos últimos 5 anos, ou sou parente próximo de quem exerce." },
                  ]}
                />
                <Actions error={error} submitLabel="Continuar" onBack={() => go("endereco")} />
              </form>
            )}

            {step === "documentos" && (
              <div className="space-y-3">
                <DocumentPicker kind="id_front" value={docs.id_front ?? null} onChange={setDoc("id_front")} hint="RG ou CNH, frente" />
                <DocumentPicker kind="id_back" value={docs.id_back ?? null} onChange={setDoc("id_back")} hint="RG ou CNH, verso" />
                {minor && minorPath === "emancipated" && (
                  <DocumentPicker kind="emancipation_certificate" value={docs.emancipation_certificate ?? null} onChange={setDoc("emancipation_certificate")} hint="Certidão de emancipação inteira" />
                )}
                <Checkbox
                  checked={termsAccepted}
                  onChange={setTermsAccepted}
                  label={
                    <>
                      Li e aceito os termos da conta de pagamento e autorizo o uso dos meus dados pela PRX e pelo banco parceiro para abrir a conta e prevenir fraudes (
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
                        Política de Privacidade
                      </a>
                      ).
                    </>
                  }
                />
                <Actions error={error} busy={busy} submitLabel="Enviar para análise" onBack={() => go("perfil")} onSubmit={() => void submit()} />
              </div>
            )}
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function Actions({ error, busy = false, submitLabel, onBack, onSubmit }: { error: string | null; busy?: boolean; submitLabel: string; onBack: () => void; onSubmit?: () => void }): ReactNode {
  return (
    <div className="space-y-3 pt-2">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
          Voltar
        </Button>
        <Button type={onSubmit ? "button" : "submit"} onClick={onSubmit} disabled={busy}>
          {busy ? "Enviando…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
