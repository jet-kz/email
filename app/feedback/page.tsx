"use client";

import { useEffect, useState } from "react";
import { getFeedbackMetricsAction } from "@/actions/feedback";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

interface FeedbackData {
  successfulDeliveries: {
    id: string;
    email: string;
    campaignName: string;
    sentAt: string;
  }[];
  failedDeliveries: {
    id: string;
    email: string;
    campaignName: string;
    errorMessage: string;
    failedAt: string;
  }[];
  bounceEvents: {
    id: string;
    email: string;
    campaignName: string;
    bouncedAt: string;
    reason?: string;
  }[];
  systemErrors: {
    id: string;
    campaignName: string;
    message: string;
    occurredAt: string;
  }[];
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FeedbackData>({
    successfulDeliveries: [],
    failedDeliveries: [],
    bounceEvents: [],
    systemErrors: [],
  });

  const loadFeedback = async (showToast = false) => {
    setLoading(true);
    try {
      const res = await getFeedbackMetricsAction();
      if (res.success && res.data) {
        setData(res.data);
        if (showToast) {
          toast("Refreshed", "Delivery feedback is up to date.", "success");
        }
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast("Refresh failed", err.message || "Failed to load logs.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header section with Refresh */}
      <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950">Email Delivery Feedback</h1>
          <p className="text-xs text-zinc-500">Real-time status updates and diagnostic logs from your provider.</p>
        </div>
        <Button
          onClick={() => loadFeedback(true)}
          disabled={loading}
          variant="outline"
          size="sm"
          className="border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 1. SUCCESSFUL DELIVERIES */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
            <CheckCircle2 size={16} className="text-zinc-900" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Successful Deliveries</h2>
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {data.successfulDeliveries.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No successful deliveries registered yet.</div>
            ) : (
              <ul className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                {data.successfulDeliveries.map((item) => (
                  <li key={item.id} className="p-3 flex justify-between items-center text-xs">
                    <div className="font-medium text-zinc-900 font-mono">{item.email}</div>
                    <div className="text-[10px] text-zinc-400">
                      {new Date(item.sentAt).toLocaleTimeString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 2. BOUNCED EVENTS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
            <AlertTriangle size={16} className="text-zinc-900" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Bounces</h2>
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {data.bounceEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No bounces reported. Good domain reputation!</div>
            ) : (
              <ul className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                {data.bounceEvents.map((item) => (
                  <li key={item.id} className="p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-red-600 font-mono">{item.email}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(item.bouncedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium">{item.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 3. FAILED DELIVERIES */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
            <XCircle size={16} className="text-zinc-900" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Failed Deliveries</h2>
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {data.failedDeliveries.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No failed delivery records.</div>
            ) : (
              <ul className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                {data.failedDeliveries.map((item) => (
                  <li key={item.id} className="p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-900 font-mono">{item.email}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(item.failedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-red-500 font-medium">{item.errorMessage}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 4. RECENT SENDING ERRORS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
            <Info size={16} className="text-zinc-900" />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Recent Sending Errors</h2>
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {data.systemErrors.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No background/queue system errors recorded.</div>
            ) : (
              <ul className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                {data.systemErrors.map((item) => (
                  <li key={item.id} className="p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-800">{item.campaignName}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(item.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-red-600 font-mono font-medium">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
