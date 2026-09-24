import { NextRequest, NextResponse } from "next/server";
import { userStore, verifyAdminRequest } from "@/lib/auth";
import { passStore } from "@/lib/pass-store";
import { errorMessage } from "@/lib/errors";
import type { AuthUserLike } from "@/lib/db-rows";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 1. Try querying Supabase public.profiles for real registered members
    let users: Array<Record<string, unknown>> = [];
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/client");
      if (supabaseAdmin) {
        const { data: dbProfiles, error } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && dbProfiles && dbProfiles.length > 0) {
          // Fetch auth users to also read user_metadata.role
          const authRolesMap = new Map<string, string>();
          try {
            const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers();
            if (authUsersData?.users) {
              authUsersData.users.forEach((u: AuthUserLike) => {
                // Only app_metadata is trusted: user_metadata can be edited by the user.
                const trustedRole = u.app_metadata?.role;
                if (typeof trustedRole === "string") {
                  authRolesMap.set(u.id, trustedRole);
                  if (u.email) authRolesMap.set(u.email.toLowerCase(), trustedRole);
                }
              });
            }
          } catch {}

          users = dbProfiles.map((p) => {
            const userVouchers = passStore.getUserVouchers(p.id);
            const metadataRole = authRolesMap.get(p.id) || (p.email ? authRolesMap.get(p.email.toLowerCase()) : null);
            const effectiveRole = p.role !== "user" ? p.role : (metadataRole || p.role || "user");

            return {
              id: p.id,
              email: p.email,
              name: p.full_name || p.name || p.email.split("@")[0],
              role: effectiveRole,
              prxScore: p.nxt_score ?? 250,
              prxLevel: p.nxt_level ?? 1,
              walletBalance: Number(p.wallet_balance || 0),
              createdAt: p.created_at,
              vouchersCount: userVouchers.length,
              vouchers: userVouchers,
            };
          });
        }
      }
    } catch (e) {
      console.warn("Supabase profiles query error:", e);
    }

    // 2. Fallback to userStore only if Supabase has no records
    if (users.length === 0) {
      const allUsers = userStore.getAllUsers();
      users = allUsers.map((u) => {
        const userVouchers = passStore.getUserVouchers(u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.fullName,
          role: u.role,
          prxScore: u.prxScore,
          prxLevel: u.prxLevel,
          walletBalance: u.walletBalance,
          createdAt: u.createdAt,
          vouchersCount: userVouchers.length,
          vouchers: userVouchers,
        };
      });
    }

    return NextResponse.json({
      success: true,
      currentUserRole: auth.adminUser?.role,
      users,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao consultar usuários." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { id, email, prxLevel, prxScore, role, walletBalance } = body;

    const targetKey = id || email;
    if (!targetKey) {
      return NextResponse.json(
        { error: "Informe o ID ou e-mail do usuário para atualizar." },
        { status: 400 }
      );
    }

    let userFound = false;
    let returnUser: Record<string, unknown> | null = null;

    // 1. Try updating Supabase public.profiles and auth.users
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/client");
      if (supabaseAdmin) {
        // Find user by id or email
        let profileQuery = supabaseAdmin.from("profiles").select("*");
        if (id) {
          profileQuery = profileQuery.eq("id", id);
        } else {
          profileQuery = profileQuery.eq("email", email.toLowerCase());
        }
        const { data: currentProfile } = await profileQuery.maybeSingle();

        const targetUserId = currentProfile?.id || (id ? id : null);

        // A) Update role in auth.users user_metadata if role is specified
        if (targetUserId && role !== undefined) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
              app_metadata: { role },
              user_metadata: { role },
            });
          } catch (metaErr) {
            console.warn("Notice: user_metadata update:", metaErr);
          }
        }

        // B) Update fields in profiles table
        const updatePayload: Record<string, unknown> = {};
        if (prxLevel !== undefined) updatePayload.nxt_level = Number(prxLevel);
        if (prxScore !== undefined) updatePayload.nxt_score = Number(prxScore);
        if (role !== undefined) updatePayload.role = role;
        if (walletBalance !== undefined) updatePayload.wallet_balance = Number(walletBalance);

        if (Object.keys(updatePayload).length > 0) {
          let updateQuery = supabaseAdmin.from("profiles").update(updatePayload);
          if (id) {
            updateQuery = updateQuery.eq("id", id);
          } else {
            updateQuery = updateQuery.eq("email", email.toLowerCase());
          }

          const firstAttempt = await updateQuery.select().maybeSingle();
          const updateError = firstAttempt.error;
          let updatedProfile = firstAttempt.data;

          // If profiles update failed due to check constraint on 'role' (Postgres error 23514)
          if (updateError && updateError.code === "23514" && updatePayload.role) {
            console.warn("Profiles check constraint encountered. Updating profile without 'role' and keeping role in user_metadata.");
            delete updatePayload.role;

            let retryQuery = supabaseAdmin.from("profiles").update(updatePayload);
            if (id) {
              retryQuery = retryQuery.eq("id", id);
            } else {
              retryQuery = retryQuery.eq("email", email.toLowerCase());
            }
            const retryRes = await retryQuery.select().maybeSingle();
            updatedProfile = retryRes.data;
          }

          if (updatedProfile || currentProfile) {
            const p = updatedProfile || currentProfile;
            userFound = true;
            returnUser = {
              id: p.id,
              email: p.email,
              name: p.full_name || p.name || p.email.split("@")[0],
              role: role !== undefined ? role : p.role,
              prxLevel: updatedProfile?.nxt_level ?? p.nxt_level,
              prxScore: updatedProfile?.nxt_score ?? p.nxt_score,
              walletBalance: Number(updatedProfile?.wallet_balance ?? p.wallet_balance ?? 0),
            };
          }
        }
      }
    } catch (e) {
      console.warn("Supabase update process error:", e);
    }

    // 2. Also update in userStore (or fallback)
    const updatedStore = userStore.updateUser(targetKey, {
      prxLevel: prxLevel !== undefined ? Number(prxLevel) : undefined,
      prxScore: prxScore !== undefined ? Number(prxScore) : undefined,
      role: role !== undefined ? role : undefined,
      walletBalance: walletBalance !== undefined ? Number(walletBalance) : undefined,
    });

    if (updatedStore) {
      userFound = true;
      if (!returnUser) {
        returnUser = {
          id: updatedStore.id,
          email: updatedStore.email,
          name: updatedStore.fullName,
          role: updatedStore.role,
          prxLevel: updatedStore.prxLevel,
          prxScore: updatedStore.prxScore,
          walletBalance: updatedStore.walletBalance,
        };
      }
    }

    if (!userFound || !returnUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Dados do membro ${returnUser.name} atualizados com sucesso!`,
      user: returnUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao atualizar dados do membro." },
      { status: 500 }
    );
  }
}
