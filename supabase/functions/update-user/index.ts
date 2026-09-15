// supabase/functions/update-user/index.ts
// Runs with service-role key so it can call auth.admin.updateUserById()
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
    // -- 1. Authenticate the calling user (must be ADMIN) ----------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // -- 2. Parse request body -------------------------------------------------
    const { user_id, full_name, email, phone, password } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password && password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -- 3. Update auth user (email / password) via service-role key -----------
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authUpdates: Record<string, string> = {};
    if (email) authUpdates.email = email.trim().toLowerCase();
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(
        user_id,
        authUpdates
      );
      if (updateAuthErr) {
        return new Response(JSON.stringify({ error: updateAuthErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // -- 4. Update profile row -------------------------------------------------
    const profileUpdates: Record<string, string | null> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name.trim();
    if (phone !== undefined) profileUpdates.phone = phone?.trim() || null;
    if (email !== undefined) profileUpdates.email = email.trim().toLowerCase();

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", user_id);

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // -- 5. Log activity -------------------------------------------------------
    await adminClient.from("activity_logs").insert({
      user_id: caller.id,
      action: "Modifié utilisateur",
      entity: "profiles",
      entity_id: user_id,
      metadata: { updated_fields: Object.keys({ ...authUpdates, ...profileUpdates }) },
    });

    return new Response(
      JSON.stringify({ success: true }),
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
