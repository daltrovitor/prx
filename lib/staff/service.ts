// Hello World
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth";
import { PartnerError } from "@/lib/partners/errors";
import { createPartnerAccount, linkExistingAccount, revokePartnerAccess, type PartnerAccount } from "@/lib/partners/access";
import { getStaffRepository, type StaffMember } from "@/lib/staff/repository";

/**
 * Equipe PRX: o admin cria (ou vincula) o login com papel "staff" e define o
 * que cada funcionário pode validar. Desativar revoga o papel na hora.
 */

export const staffCreateSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    name: z.string().trim().min(2, "Informe o nome do funcionário.").max(120),
    email: z.email("E-mail inválido.").trim().toLowerCase(),
    canValidateTickets: z.boolean().default(true),
    canValidateBenefits: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal("link"),
    name: z.string().trim().min(2, "Informe o nome do funcionário.").max(120),
    email: z.email("E-mail inválido.").trim().toLowerCase(),
    canValidateTickets: z.boolean().default(true),
    canValidateBenefits: z.boolean().default(true),
  }),
]);
export type StaffCreateInput = z.output<typeof staffCreateSchema>;

export const staffUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    canValidateTickets: z.boolean().optional(),
    canValidateBenefits: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.");
export type StaffUpdateInput = z.output<typeof staffUpdateSchema>;

export async function listStaff(): Promise<StaffMember[]> {
  return getStaffRepository().list();
}

export async function createStaff(input: StaffCreateInput): Promise<{ staff: StaffMember; account: PartnerAccount }> {
  const repo = getStaffRepository();
  const existing = (await repo.list()).find((s) => s.email === input.email);
  if (existing) throw new PartnerError("Este e-mail já faz parte da equipe. Reative o cadastro existente.", 409);

  const account = input.mode === "create" ? await createPartnerAccount(input.email, input.name, "staff") : await linkExistingAccount(input.email, "staff");
  const staff = await repo.insert({
    userId: account.userId,
    email: account.email,
    name: input.name,
    canValidateTickets: input.canValidateTickets,
    canValidateBenefits: input.canValidateBenefits,
    active: true,
  });
  return { staff, account };
}

export async function updateStaff(id: string, patch: StaffUpdateInput): Promise<StaffMember> {
  const repo = getStaffRepository();
  const current = await repo.get(id);
  if (!current) throw new PartnerError("Funcionário não encontrado.", 404);

  if (patch.active === false && current.active) await revokePartnerAccess(current.userId, current.email);
  if (patch.active === true && !current.active) await linkExistingAccount(current.email, "staff");
  return repo.update(id, patch);
}

/* -------------------------------------------------------------------------- */
/* Quem está validando                                                         */
/* -------------------------------------------------------------------------- */

export interface StaffActor {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  canValidateTickets: boolean;
  canValidateBenefits: boolean;
}

/**
 * Resolve o funcionário da sessão. Admin entra com todas as permissões;
 * funcionário precisa de cadastro ativo na equipe.
 */
export async function requireStaffActor(user: SessionPayload & { role: "staff" | "admin" }): Promise<StaffActor> {
  const email = (user.email || "").toLowerCase();
  if (user.role === "admin") {
    return { userId: user.sub, email, name: user.name || "Admin PRX", isAdmin: true, canValidateTickets: true, canValidateBenefits: true };
  }
  const member = await getStaffRepository().getByUser(user.sub, email);
  if (!member || !member.active) throw new PartnerError("Seu acesso à Equipe PRX está desativado. Fale com o administrador.", 403);
  return {
    userId: member.userId,
    email: member.email,
    name: member.name,
    isAdmin: false,
    canValidateTickets: member.canValidateTickets,
    canValidateBenefits: member.canValidateBenefits,
  };
}
