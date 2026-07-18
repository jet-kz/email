"use server";

import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/services/templates";
import { Template } from "@/types";

export async function getTemplatesAction() {
  try {
    const list = await getTemplates();
    return { success: true, data: list };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch templates." };
  }
}

export async function getTemplateAction(id: string) {
  try {
    const template = await getTemplate(id);
    return { success: true, data: template };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch template." };
  }
}

export async function createTemplateAction(template: Omit<Partial<Template>, "id" | "user_id" | "created_at" | "updated_at">) {
  try {
    const data = await createTemplate(template);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create template." };
  }
}

export async function updateTemplateAction(id: string, template: Partial<Template>) {
  try {
    await updateTemplate(id, template);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update template." };
  }
}

export async function deleteTemplateAction(id: string) {
  try {
    await deleteTemplate(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete template." };
  }
}
