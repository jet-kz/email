"use server";

import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignStats,
  getCampaignLogs,
  sendTestCampaignEmail,
  startCampaignSending,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedCampaignJobs,
  startPastedCampaign,
} from "@/services/campaigns";
import { Campaign } from "@/types";

export async function getCampaignsAction(search?: string, status?: string) {
  try {
    const list = await getCampaigns(search, status);
    return { success: true, data: list };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch campaigns." };
  }
}

export async function getCampaignAction(id: string) {
  try {
    const campaign = await getCampaign(id);
    return { success: true, data: campaign };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch campaign." };
  }
}

export async function createCampaignAction(campaign: Omit<Partial<Campaign>, "id" | "user_id" | "created_at" | "updated_at">) {
  try {
    const newCamp = await createCampaign(campaign);
    return { success: true, data: newCamp };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create campaign." };
  }
}

export async function updateCampaignAction(id: string, campaign: Partial<Campaign>) {
  try {
    await updateCampaign(id, campaign);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update campaign." };
  }
}

export async function deleteCampaignAction(id: string) {
  try {
    await deleteCampaign(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete campaign." };
  }
}

export async function duplicateCampaignAction(id: string) {
  try {
    const copied = await duplicateCampaign(id);
    return { success: true, data: copied };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to duplicate campaign." };
  }
}

export async function getCampaignStatsAction(id: string) {
  try {
    const stats = await getCampaignStats(id);
    return { success: true, data: stats };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load campaign statistics." };
  }
}

export async function getCampaignLogsAction(id: string) {
  try {
    const logs = await getCampaignLogs(id);
    return { success: true, data: logs };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch activity logs." };
  }
}

export async function sendTestCampaignEmailAction(id: string, testEmail: string) {
  try {
    await sendTestCampaignEmail(id, testEmail);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to dispatch test email." };
  }
}

export async function startCampaignSendingAction(id: string, targetTagId?: string) {
  try {
    await startCampaignSending(id, targetTagId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to launch campaign sending." };
  }
}

export async function pauseCampaignAction(id: string) {
  try {
    await pauseCampaign(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to pause campaign." };
  }
}

export async function resumeCampaignAction(id: string) {
  try {
    await resumeCampaign(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to resume campaign." };
  }
}

export async function cancelCampaignAction(id: string) {
  try {
    await cancelCampaign(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to cancel campaign." };
  }
}

export async function retryFailedCampaignJobsAction(id: string) {
  try {
    await retryFailedCampaignJobs(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to retry failed deliveries." };
  }
}

export async function startPastedCampaignAction(campaignId: string, contactIds: string[]) {
  try {
    await startPastedCampaign(campaignId, contactIds);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to launch pasted campaign." };
  }
}

