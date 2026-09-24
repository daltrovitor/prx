// Hello World

/**
 * Formato das linhas lidas do Supabase (schema public). O client não é gerado
 * com tipos, então estas interfaces documentam as colunas usadas pelas rotas.
 * As colunas nxt_* mantêm o nome original do banco (anterior ao rebrand PRX).
 */
export interface BenefitRow {
  id: string;
  partner_id?: string | null;
  partner_name: string;
  partner_logo?: string | null;
  partner_banner?: string | null;
  partner_location?: string | null;
  category_id: string;
  title: string;
  description?: string | null;
  discount_label: string;
  min_nxt_level?: number | null;
  terms?: string[] | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export interface MissionRow {
  id: string;
  title: string;
  description?: string | null;
  xp_reward: number;
  total: number;
  progress?: number | null;
  is_completed?: boolean | null;
  verification_type?: string | null;
  category?: string | null;
  created_at?: string | null;
}

export interface VoucherRow {
  id: string;
  code: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  benefit_id?: string | null;
  benefit_title?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  discount_label?: string | null;
  status: "valid" | "used";
  qr_payload?: string | null;
  terms?: string | null;
  redeemed_at?: string | null;
  validated_at?: string | null;
  created_at?: string | null;
}

export interface ProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
  role?: "user" | "partner" | "staff" | "admin" | null;
  nxt_score?: number | null;
  nxt_level?: number | null;
  wallet_balance?: number | string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export interface AuthUserLike {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export type MemberRole = "user" | "partner" | "staff" | "admin";

export function asMemberRole(value: unknown): MemberRole {
  return value === "admin" || value === "partner" || value === "staff" ? value : "user";
}

/** Opções do cookie de sessão (compatível com NextResponse.cookies.set). */
export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure?: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
}
