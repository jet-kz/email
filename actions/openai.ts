"use server";

import { rewriteEmailText, generateSubjectSuggestions, generateCTASuggestions } from "@/lib/openai";

export async function rewriteEmailAction(content: string, tone: "professional" | "friendly" | "urgent" | "grammar") {
  try {
    const rewritten = await rewriteEmailText(content, tone);
    return { success: true, data: rewritten };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to rewrite copy." };
  }
}

export async function suggestSubjectsAction(description: string) {
  try {
    const suggestions = await generateSubjectSuggestions(description);
    return { success: true, data: suggestions };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to generate subject suggestions." };
  }
}

export async function suggestCTAsAction(description: string) {
  try {
    const suggestions = await generateCTASuggestions(description);
    return { success: true, data: suggestions };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to generate CTA suggestions." };
  }
}
