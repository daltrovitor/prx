// Hello World
"use client";

import { Checkbox, Field, Select } from "@/components/app/ui";
import { GUARDIANSHIPS, GUARDIANSHIP_LABEL, PARENTAL_CONSENT_TEXT, PARENTAL_CONSENT_VERSION, type Guardianship } from "@/lib/family/types";

export interface GuardianConsentValue {
  relationship: Guardianship | "";
  guardianshipDeclared: boolean;
  consentAccepted: boolean;
}

export const EMPTY_CONSENT: GuardianConsentValue = { relationship: "", guardianshipDeclared: false, consentAccepted: false };

export function consentProblem(value: GuardianConsentValue): string | null {
  if (!value.relationship) return "Informe o parentesco ou a tutela legal.";
  if (!value.guardianshipDeclared) return "Confirme que você é o responsável legal pelo menor.";
  if (!value.consentAccepted) return "Aceite o termo de consentimento parental (LGPD, Art. 14).";
  return null;
}

/**
 * Parentesco, declaração de tutela e o termo de consentimento parental em
 * destaque (LGPD, Art. 14, §1º). O servidor revalida e grava versão, data e IP.
 */
export function GuardianConsentFields({ value, onChange }: { value: GuardianConsentValue; onChange: (next: GuardianConsentValue) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Parentesco ou tutela">
        {(id) => (
          <Select id={id} value={value.relationship} onChange={(e) => onChange({ ...value, relationship: e.target.value as Guardianship | "" })} required>
            <option value="">Escolha</option>
            {GUARDIANSHIPS.map((g) => (
              <option key={g} value={g}>
                {GUARDIANSHIP_LABEL[g]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Checkbox
        checked={value.guardianshipDeclared}
        onChange={(checked) => onChange({ ...value, guardianshipDeclared: checked })}
        label="Declaro, sob as penas da lei, que sou mãe, pai ou responsável legal por este menor."
      />
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">Consentimento parental · LGPD, Art. 14</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{PARENTAL_CONSENT_TEXT}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Versão {PARENTAL_CONSENT_VERSION}. Guardamos a data, a versão e o IP deste aceite.</p>
        <Checkbox className="mt-2" checked={value.consentAccepted} onChange={(checked) => onChange({ ...value, consentAccepted: checked })} label="Li e dou meu consentimento." />
      </div>
    </div>
  );
}
