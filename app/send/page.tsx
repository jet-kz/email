"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSettingsAction, saveSettingsAction } from "@/actions/settings";
import { 
  createCampaignAction, 
  getCampaignStatsAction, 
  updateCampaignAction,
  startCampaignSendingAction,
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
  startPastedCampaignAction
} from "@/actions/campaigns";
import { getContactsAction, createContactAction } from "@/actions/contacts";
import { 
  Play, 
  Pause, 
  Square, 
  Settings as SettingsIcon, 
  Loader2, 
  ArrowRight,
  Check
} from "lucide-react";

export default function SendEmailPage() {
  const { toast } = useToast();
  
  // App States
  const [loading, setLoading] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Settings Form
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  // Editor Form States
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [batchSize, setBatchSize] = useState(100);

  // Active Sending States
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [stats, setStats] = useState({ queued: 0, sending: 0, sent: 0, failed: 0, bounced: 0, unsubscribed: 0 });
  const [sendingLoading, setSendingLoading] = useState(false);

  // Load Settings
  useEffect(() => {
    async function loadData() {
      try {
        const data = await getSettingsAction();
        setSenderName(data.sender_name || "");
        setSenderEmail(data.sender_email || "");
        setReplyToEmail(data.reply_to_email || "");
        setResendApiKey(data.resend_api_key || "");
      } catch (err) {
        toast("Failed to load settings", "Settings could not be retrieved.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);

  // Active sending status polling loop
  useEffect(() => {
    if (!activeCampaignId || (campaignStatus !== "sending" && campaignStatus !== "paused")) return;

    const timer = setInterval(async () => {
      const [statsRes, campRes] = await Promise.all([
        getCampaignStatsAction(activeCampaignId),
        updateCampaignAction(activeCampaignId, {}).then(() => getCampaignStatsAction(activeCampaignId)) // stub update to retrieve camp details
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      // Check current campaign status to see if it changed
      try {
        const response = await fetch(`/api/queue/cron-scheduler`); // trigger cron check in background or fetch directly
      } catch (_) {}
    }, 3000);

    return () => clearInterval(timer);
  }, [activeCampaignId, campaignStatus]);

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderEmail) {
      toast("Invalid settings", "Sender name and sender email address are required.", "error");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await saveSettingsAction({
        sender_name: senderName,
        sender_email: senderEmail,
        reply_to_email: replyToEmail || null,
        resend_api_key: resendApiKey || null,
        timezone: "UTC"
      });

      if (res.success) {
        toast("Settings saved", "Platforms configurations are updated.", "success");
        setSettingsExpanded(false);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast("Save failed", err.message || "Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Start sending emails queue
  const handleStartSending = async () => {
    if (!subject.trim() || !content.trim()) {
      toast("Template empty", "Please provide both an email Subject and a Message Body.", "error");
      return;
    }

    if (!senderEmail) {
      toast("Settings incomplete", "Please expand Settings and configure your Sender Email address.", "error");
      setSettingsExpanded(true);
      return;
    }

    // Parse recipients
    const emails = recipientsRaw
      .split("\n")
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes("@"));

    if (emails.length === 0) {
      toast("No recipients", "Please paste at least one valid recipient email address (one per line).", "error");
      return;
    }

    setSendingLoading(true);
    try {
      // 1. Create campaign
      const campRes = await createCampaignAction({
        name: `Quick Broadcast - ${new Date().toLocaleTimeString()}`,
        subject: subject,
        content: content,
        emails_per_batch: Number(batchSize),
        delay_between_batches: 60,
        max_retries: 3
      });

      if (!campRes.success || !campRes.data) {
        throw new Error(campRes.error || "Failed to create campaign batch.");
      }

      const campaignId = campRes.data.id;
      setActiveCampaignId(campaignId);
      setCampaignStatus("sending");

      // 2. Insert contacts dynamically (single-source pastings)
      toast("Queueing recipients...", `Processing ${emails.length} email addresses...`, "info");
      
      // Get all existing contacts to avoid duplicate email insertions in contacts table
      const contactsRes = await getContactsAction();
      const existingContacts = contactsRes.success ? contactsRes.data || [] : [];
      const existingEmailsMap = new Map(existingContacts.map(c => [c.email.toLowerCase(), c.id]));

      const targetContactIds: string[] = [];

      for (const email of emails) {
        const cleanEmail = email.toLowerCase().trim();
        if (existingEmailsMap.has(cleanEmail)) {
          targetContactIds.push(existingEmailsMap.get(cleanEmail)!);
        } else {
          // Create contact
          const newContactRes = await createContactAction({
            first_name: "Recipient",
            last_name: "",
            email: cleanEmail,
            company: null,
            phone: null,
            notes: null
          });
          if (newContactRes.success && newContactRes.data) {
            targetContactIds.push(newContactRes.data.id);
            existingEmailsMap.set(cleanEmail, newContactRes.data.id);
          }
        }
      }

      // 3. Trigger queue dispatch
      const launchRes = await startPastedCampaignAction(campaignId, targetContactIds);
      if (launchRes.success) {
        toast("Queue launched", "Email queue is scheduled.", "success");
      } else {
        throw new Error(launchRes.error);
      }
      
    } catch (err: any) {
      toast("Sending initiation failed", err.message || "Failed to start queue.", "error");
    } finally {
      setSendingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings section */}
      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="w-full px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center text-sm font-medium text-zinc-900 hover:bg-zinc-100/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon size={16} className="text-zinc-500" />
            <span>Sender & API Key Settings</span>
          </div>
          <span className="text-xs text-zinc-500">{settingsExpanded ? "Collapse" : "Expand"}</span>
        </button>

        {settingsExpanded && (
          <form onSubmit={handleSaveSettings} className="p-4 bg-white space-y-4 border-t border-zinc-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Sender Name"
                placeholder="e.g. John Doe"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
              <Input
                label="Sender Email"
                placeholder="e.g. john@yourdomain.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
              />
              <Input
                label="Reply-To Email"
                placeholder="e.g. support@yourdomain.com"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Resend API Key"
                type="password"
                placeholder="re_..."
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <Button type="submit" loading={savingSettings} size="sm">
                <span>Save Configuration</span>
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Editor columns */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-zinc-250 bg-white shadow-none">
            <CardHeader className="border-b border-zinc-200">
              <CardTitle className="text-zinc-950 font-semibold">Compose Email</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Input
                label="Email Subject"
                placeholder="Type subject line here..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Message Editor</label>
                  
                  {/* AI controls removed */}
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-3 text-sm border border-zinc-250 rounded-xl text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all font-mono"
                  placeholder="Type email body content here (accepts HTML)..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recipients & Options sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Recipients */}
          <Card className="border-zinc-250 bg-white shadow-none">
            <CardHeader className="border-b border-zinc-200">
              <CardTitle className="text-zinc-950 font-semibold">Recipients</CardTitle>
              <CardDescription>Paste email addresses (one per line).</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <textarea
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 text-xs border border-zinc-250 rounded-xl text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all font-mono resize-y"
                placeholder="recipient1@domain.com&#10;recipient2@domain.com"
              />
            </CardContent>
          </Card>

          {/* Send options */}
          <Card className="border-zinc-250 bg-white shadow-none">
            <CardHeader className="border-b border-zinc-200">
              <CardTitle className="text-zinc-950 font-semibold">Send Options</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block">Emails per batch:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[50, 100, 200, 500].map((size) => (
                    <label
                      key={size}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        batchSize === size 
                          ? "border-zinc-900 bg-zinc-50 font-semibold text-zinc-950" 
                          : "border-zinc-200 hover:bg-zinc-50/50 text-zinc-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="batchSize"
                        checked={batchSize === size}
                        onChange={() => setBatchSize(size)}
                        className="sr-only"
                      />
                      <span>{size} per batch</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Execution controllers */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
                {!activeCampaignId ? (
                  <Button onClick={handleStartSending} loading={sendingLoading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-medium py-2 rounded-xl">
                    <Play size={14} fill="currentColor" />
                    <span>Start Sending</span>
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    {campaignStatus === "sending" && (
                      <Button
                        onClick={async () => {
                          await pauseCampaignAction(activeCampaignId);
                          setCampaignStatus("paused");
                          toast("Paused", "Email dispatch is paused.", "info");
                        }}
                        variant="secondary"
                        className="w-full border-zinc-250 text-zinc-800"
                      >
                        <Pause size={14} fill="currentColor" />
                        <span>Pause Sending</span>
                      </Button>
                    )}
                    {campaignStatus === "paused" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            await resumeCampaignAction(activeCampaignId);
                            setCampaignStatus("sending");
                            toast("Resumed", "Email dispatch has resumed.", "success");
                          }}
                          className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white"
                        >
                          <Play size={14} fill="currentColor" />
                          <span>Resume</span>
                        </Button>
                        <Button
                          onClick={async () => {
                            await cancelCampaignAction(activeCampaignId);
                            setCampaignStatus("cancelled");
                            toast("Stopped", "Email queue is aborted.", "info");
                          }}
                          variant="danger"
                          className="flex-1"
                        >
                          <Square size={14} fill="currentColor" />
                          <span>Stop</span>
                        </Button>
                      </div>
                    )}
                    {(campaignStatus === "completed" || campaignStatus === "cancelled") && (
                      <Button
                        onClick={() => {
                          setActiveCampaignId(null);
                          setCampaignStatus(null);
                          setRecipientsRaw("");
                          setSubject("");
                          setContent("");
                        }}
                        variant="outline"
                        className="w-full border-zinc-200 text-zinc-700"
                      >
                        <span>Send Another Email</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* LIVE PROGRESS CARD */}
      {activeCampaignId && (
        <Card className="border-zinc-250 bg-white shadow-none mt-6 animate-in fade-in duration-200">
          <CardHeader className="border-b border-zinc-200">
            <CardTitle className="text-zinc-950 font-semibold flex items-center gap-2">
              <span>Live Queue Progress</span>
              {campaignStatus === "sending" && <Loader2 className="animate-spin text-zinc-500" size={14} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Numeric metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="block text-xl font-bold text-zinc-950">{stats.queued}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Queued</span>
              </div>
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="block text-xl font-bold text-emerald-600">{stats.sent}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Sent</span>
              </div>
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="block text-xl font-bold text-red-600">{stats.failed + stats.bounced}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Failed</span>
              </div>
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="block text-xl font-bold text-zinc-500">
                  {stats.queued + stats.sending}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Remaining</span>
              </div>
            </div>

            {/* Progress metrics bars */}
            <div className="space-y-3">
              {/* ASCII Progress representation */}
              {(() => {
                const total = stats.queued + stats.sending + stats.sent + stats.failed + stats.bounced + stats.unsubscribed;
                const completed = stats.sent + stats.failed + stats.bounced;
                const ratio = total > 0 ? (completed / total) : 0;
                
                // Build 15-block ASCII bar
                const barSize = 15;
                const filled = Math.round(ratio * barSize);
                const empty = barSize - filled;
                const asciiProgress = "█".repeat(filled) + "░".repeat(empty);

                return (
                  <div className="flex flex-col gap-2">
                    {/* Linear Tailwind Bar */}
                    <div className="w-full bg-zinc-100 rounded-full h-2 border border-zinc-200 overflow-hidden">
                      <div 
                        className="bg-zinc-950 h-full rounded-full transition-all duration-350" 
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    {/* ASCII printout */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-zinc-600">
                      <span>Progress Bar:</span>
                      <span className="text-zinc-900 tracking-widest">{asciiProgress}</span>
                      <span className="font-bold text-zinc-900">{(ratio * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
