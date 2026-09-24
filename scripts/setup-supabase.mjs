import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const envVars = {};
envText.split("\n").forEach(line => {
  const [k, ...v] = line.trim().split("=");
  if (k && v.length) envVars[k] = v.join("=");
});

const supabaseAdmin = createClient(envVars.URL, envVars.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testCreateUser() {
  const demoEmail = "rafael.molina@prx.app";
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === demoEmail);

  if (!found) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: "Prx2026!",
      email_confirm: true, // No email confirmation required!
      user_metadata: {
        full_name: "Rafael Molina",
        nxt_score: 2150,
        nxt_level: 3,
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80",
        wallet_balance: 124.50
      }
    });
    console.log("Created demo user in Supabase:", { data, error });
  } else {
    console.log("Demo user already exists in Supabase Auth:", found.id, found.email);
  }

  // Test sign in with password via Supabase Client (Anon Key)
  const client = createClient(envVars.URL, envVars.ANON_KEY);
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email: demoEmail,
    password: "Prx2026!"
  });
  console.log("Sign in test:", {
    success: !!signInData.session,
    userId: signInData.user?.id,
    metadata: signInData.user?.user_metadata,
    error: signInErr?.message
  });
}

testCreateUser();
