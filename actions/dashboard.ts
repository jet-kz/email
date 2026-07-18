"use server";

import { getDashboardStats } from "@/services/dashboard";

export async function getDashboardStatsAction() {
  try {
    const stats = await getDashboardStats();
    return { success: true, data: stats };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to compile dashboard metrics." };
  }
}
