import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webPush from "npm:web-push@3.6.7";

// Configure web-push with VAPID keys
// These should be set in Supabase Secrets
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    "mailto:admin@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

serve(async (req) => {
  try {
    // Check for VAPID configuration
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys are missing.");
      return new Response(JSON.stringify({ error: "Missing VAPID keys" }), { status: 500 });
    }

    // Get the webhook payload
    const payload = await req.json();
    const record = payload.record; // The inserted message

    if (!record || !record.conversation_id || !record.sender_id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    // Initialize Supabase Client to fetch data
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get the conversation members to find the recipients
    const { data: members, error: membersError } = await supabaseClient
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", record.conversation_id);

    if (membersError || !members) {
      console.error("Error fetching members:", membersError);
      return new Response(JSON.stringify({ error: "Failed to fetch members" }), { status: 500 });
    }

    const recipients = members
      .map((m) => m.user_id)
      .filter((id) => id !== record.sender_id);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients to notify" }), { status: 200 });
    }

    // 2. Fetch sender profile to show their name
    const { data: senderProfiles } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", record.sender_id)
      .limit(1);

    const senderName = senderProfiles?.[0]?.full_name || "Nouveau message";

    // 3. Fetch push subscriptions for the recipients
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from("push_subscriptions")
      .select("subscription")
      .in("user_id", recipients);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No push subscriptions found" }), { status: 200 });
    }

    // 4. Send the push notifications
    const notificationPayload = JSON.stringify({
      title: senderName,
      body: record.content ? record.content.substring(0, 100) : "📷 Image",
      url: `/messagerie`,
      conversation_id: record.conversation_id,
      tag: `chat-${record.conversation_id}`
    });

    const pushPromises = subscriptions.map((sub) => {
      const pushSub = sub.subscription;
      return webPush.sendNotification(pushSub, notificationPayload).catch((error) => {
        console.error("Error sending push to a subscription:", error);
        // Optionally, if error.statusCode === 410 (Gone), delete the subscription from DB
      });
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ message: "Push notifications sent successfully" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
