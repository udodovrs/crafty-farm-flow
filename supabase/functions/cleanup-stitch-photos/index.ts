import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { taskId } = await req.json();
    if (!taskId) throw new Error("taskId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: task } = await supabase
      .from("stitch_tasks")
      .select("user_id, id, status, photo_before_url, photo_after_url")
      .eq("id", taskId)
      .single();

    if (!task || !["approved", "rejected"].includes(task.status)) {
      return new Response(JSON.stringify({ ok: true, message: "No cleanup needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paths = [
      `${task.user_id}/${task.id}/before.jpg`,
      `${task.user_id}/${task.id}/after.jpg`,
    ];

    await supabase.storage.from("stitch-photos").remove(paths);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
