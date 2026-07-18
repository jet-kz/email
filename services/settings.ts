import { supabaseAdmin } from "@/lib/supabase";
import { Settings } from "@/types";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getActiveUserId(): Promise<string> {
  // Try to fetch active session user
  const { data: { user } } = await supabaseAdmin.auth.getUser().catch(() => ({ data: { user: null } }));
  return user?.id || DEFAULT_USER_ID;
}

export async function getSettings(): Promise<Partial<Settings>> {
  try {
    const userId = await getActiveUserId();
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Return defaults, fallback to env variables if set
      return {
        user_id: userId,
        sender_name: process.env.NEXT_PUBLIC_DEFAULT_SENDER_NAME || "",
        sender_email: process.env.NEXT_PUBLIC_DEFAULT_SENDER_EMAIL || "",
        reply_to_email: process.env.NEXT_PUBLIC_DEFAULT_REPLY_TO_EMAIL || "",
        openai_api_key: process.env.OPENAI_API_KEY || "",
        resend_api_key: process.env.RESEND_API_KEY || "",
        timezone: "UTC",
      };
    }

    return data;
  } catch (error) {
    console.error("Error fetching settings:", error);
    return {
      sender_name: "",
      sender_email: "",
      reply_to_email: "",
      openai_api_key: "",
      resend_api_key: "",
      timezone: "UTC",
    };
  }
}

export async function saveSettings(settings: Omit<Partial<Settings>, "id" | "user_id" | "created_at" | "updated_at">): Promise<void> {
  const userId = await getActiveUserId();
  
  // Upsert settings in database
  const { error } = await supabaseAdmin.from("settings").upsert(
    {
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Error saving settings to Supabase:", error);
    throw new Error(error.message);
  }
}
