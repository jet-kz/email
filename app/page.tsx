"use client";

import { useState, useRef } from "react";
import { Send, UploadCloud, Info, CheckCircle2 } from "lucide-react";
import { sendBulkEmails } from "@/actions/send";

export default function SinglePageMailer() {
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  
  // Progress Bar State
  const [totalToSend, setTotalToSend] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const sentCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const extractedEmails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
      
      if (extractedEmails) {
        const unique = Array.from(new Set(extractedEmails));
        setEmails((prev) => (prev ? prev + ",\n" + unique.join(",\n") : unique.join(",\n")));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emails || !subject || !body) return;

    const emailList = Array.from(new Set(emails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi) || []));

    if (emailList.length === 0) {
      setStatus("error");
      setMessage("No valid emails found.");
      return;
    }

    if(!confirm(`You are about to queue ${emailList.length} emails. Proceed?`)) return;

    setStatus("sending");
    setMessage(`Queueing ${emailList.length} emails into Upstash...`);
    setTotalToSend(emailList.length);
    setSentCount(0);
    sentCountRef.current = 0;

    const result = await sendBulkEmails(emailList, subject, body, replyTo);

    if (result.success) {
      setStatus("success");
      setMessage(`Successfully queued!`);
      setEmails("");
      setSubject("");
      setBody("");
      
      // Start visual progress bar simulating QStash sending 1 email every 5 seconds
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        sentCountRef.current += 1;
        setSentCount(sentCountRef.current);
        
        if (sentCountRef.current >= emailList.length) {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 5000); // 5 seconds matches the 5s staggered delay in send.ts

    } else {
      setStatus("error");
      setMessage(result.error || "Failed to queue emails.");
    }
  };

  const calculateProgress = () => {
    if (totalToSend === 0) return 0;
    return Math.min(100, (sentCount / totalToSend) * 100);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 flex justify-center text-zinc-900 dark:text-zinc-50">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-600 flex items-center gap-2">
            <Send className="h-8 w-8" /> 
            MailBlast Engine
          </h1>
          <p className="text-zinc-500 mt-2">
            Paste your emails and content below. We queue them and send them individually to protect your spam reputation.
          </p>
        </div>

        {/* PROGRESS BAR UI */}
        {(status === "success" || sentCount > 0) && (
          <div className="mb-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="font-bold text-lg">Campaign Progress</h3>
                <p className="text-sm text-zinc-500">Sending 1 email exactly every 5 seconds...</p>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {sentCount} <span className="text-zinc-400 text-lg">/ {totalToSend}</span>
              </div>
            </div>
            
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden relative">
              <div 
                className="bg-indigo-500 h-4 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
            
            {sentCount >= totalToSend && totalToSend > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5" /> All emails have been dispatched completely.
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              1. Recipients
            </h2>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Paste emails (comma separated, list, etc.)
                </label>
                <label className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full cursor-pointer hover:bg-indigo-100 transition-colors flex items-center gap-1">
                  <UploadCloud className="h-3 w-3" />
                  Extract from Document
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="john@example.com, sara@example.com"
                className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-t pt-6">2. Email Content</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reply-To Email (Optional)</label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="hello@yourdomain.com"
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A special update just for you!"
                required
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-zinc-500 mt-2">
                <strong>Pro-tip:</strong> Use Spintax to bypass spam filters: <code>{`{Hello|Hi|Greetings}`} there!</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email here..."
                required
                className="w-full h-64 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
              />
              <p className="text-xs text-zinc-500 mt-2">
                Every single email dispatched will automatically shuffle any words wrapped like <code>{`{word1|word2|word3}`}</code> to ensure completely unique content.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              {status !== "idle" && status !== "success" && (
                <div className={`p-3 text-sm rounded-lg flex items-start gap-2 ${
                  status === "error" ? "bg-red-50 text-red-700" :
                  "bg-blue-50 text-blue-700"
                }`}>
                  <Info className="h-5 w-5 shrink-0" />
                  <p>{message}</p>
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === "sending" ? (
                <span className="animate-pulse">Queueing...</span>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
