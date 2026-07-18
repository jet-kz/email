"use server";
import { getSettings, saveSettings } from "@/services/settings";
import { Settings } from "@/types";

export async function getSettingsAction() {
  return await getSettings();
}

export async function saveSettingsAction(data: Omit<Partial<Settings>, "id" | "user_id" | "created_at" | "updated_at">) {
  try {
    await saveSettings(data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to save settings." };
  }
}
