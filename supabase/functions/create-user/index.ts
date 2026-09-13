// supabase/functions/create-user/index.ts
// Runs with service-role key so it can call auth.admin.createUser()
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the calling user (must be ADMIN) ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the anon key client to verify the caller's JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is ADMIN
    const { data: roleRow } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "ADMIN")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: ADMIN role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse request body ─────────────────────────────────────────────────
    const { full_name, email, password, phone, role } = await req.json() as {
      full_name: string;
      email: string;
      password: string;
      phone?: string;
      role?: string;
    };

    if (!full_name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "full_name, email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Create the auth user with service-role key ─────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUserData, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so the user can log in immediately
      user_metadata: { full_name, phone: phone ?? null },
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUser = newUserData.user!;

    // ── 4. Update profile with full_name & phone (trigger already created it) ─
    await adminClient
      .from("profiles")
      .update({ full_name, phone: phone ?? null })
      .eq("user_id", newUser.id);

    // ── 5. Optionally override the default SURVEILLANT role ───────────────────
    const targetRole = (role && ["ADMIN", "SURVEILLANT", "TECHNICIEN"].includes(role))
      ? role
      : "SURVEILLANT";

    if (targetRole !== "SURVEILLANT") {
      // Remove default and insert requested role
      await adminClient.from("user_roles").delete().eq("user_id", newUser.id);
      await adminClient.from("user_roles").insert({ user_id: newUser.id, role: targetRole });
    }

    // ── 6. Log activity ───────────────────────────────────────────────────────
    await adminClient.from("activity_logs").insert({
      user_id: caller.id,
      action: "Créé utilisateur",
      entity: "profiles",
      entity_id: newUser.id,
      metadata: { email, full_name, role: targetRole },
    });

    return new Response(
      JSON.stringify({ user_id: newUser.id, email: newUser.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
