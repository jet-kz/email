"use server";

import { getFeedbackMetrics } from "@/services/feedback";

export async function getFeedbackMetricsAction() {
  try {
    const data = await getFeedbackMetrics();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load feedback logs." };
  }
}
