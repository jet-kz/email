import { supabaseAdmin } from "@/lib/supabase";
import { Template } from "@/types";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getActiveUserId(): Promise<string> {
  const { data: { user } } = await supabaseAdmin.auth.getUser().catch(() => ({ data: { user: null } }));
  return user?.id || DEFAULT_USER_ID;
}

export async function getTemplates(): Promise<Template[]> {
  try {
    const userId = await getActiveUserId();
    const { data, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error fetching templates:", err);
    return [];
  }
}

export async function getTemplate(templateId: string): Promise<Template | null> {
  const { data, error } = await supabaseAdmin
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTemplate(template: Omit<Partial<Template>, "id" | "user_id" | "created_at" | "updated_at">): Promise<Template> {
  const userId = await getActiveUserId();
  const { data, error } = await supabaseAdmin
    .from("templates")
    .insert({
      user_id: userId,
      name: template.name || "New Template",
      subject: template.subject || "",
      content: template.content || "",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplate(templateId: string, template: Partial<Template>): Promise<void> {
  const { error } = await supabaseAdmin
    .from("templates")
    .update({
      ...template,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) throw error;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("templates").delete().eq("id", templateId);
  if (error) throw error;
}
