// Deploy: supabase functions deploy delete-account --project-ref eftzzzjksokmzkyntmzn
// Requires the service role only on the Supabase side (never in the desktop app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) {
      return new Response(JSON.stringify({ error: "misconfigured" }), { status: 500, headers: cors });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }

    const userId = userData.user.id;
    const admin = createClient(url, service);

    // Order respects FKs among cloud tables (no hard FKs between app tables, but delete children first).
    for (const table of ["user_game_categories", "goals", "user_games", "categories", "games"]) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) {
        return new Response(JSON.stringify({ error: "delete_failed" }), { status: 500, headers: cors });
      }
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return new Response(JSON.stringify({ error: "delete_user_failed" }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "unexpected" }), { status: 500, headers: cors });
  }
});
