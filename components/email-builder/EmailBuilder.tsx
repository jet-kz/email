"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { rewriteEmailAction, suggestSubjectsAction, suggestCTAsAction } from "@/actions/openai";
import { interpolate } from "@/utils/personalization";
import { 
  Sparkles, 
  Smartphone, 
  Monitor, 
  Eye, 
  Code, 
  Signature, 
  Table, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Plus, 
  RotateCcw,
  Check,
  ChevronDown
} from "lucide-react";

interface EmailBuilderProps {
  content: string;
  onChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  previewText: string;
  onPreviewTextChange: (value: string) => void;
}

const MOCK_RECIPIENT = {
  first_name: "Sarah",
  last_name: "Connor",
  company: "Cyberdyne Systems",
  email: "sarah.connor@cyberdyne.com",
};

export default function EmailBuilder({
  content,
  onChange,
  subject,
  onSubjectChange,
  previewText,
  onPreviewTextChange,
}: EmailBuilderProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // View states
  const [tab, setTab] = useState<"editor" | "desktop" | "mobile">("editor");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubjects, setAiSubjects] = useState<{ subject: string; preview: string }[]>([]);
  const [aiCTAs, setAiCTAs] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<"professional" | "friendly" | "urgent" | "grammar">("professional");

  // Insert content at textarea cursor position
  const insertTextAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const scrollPos = textarea.scrollTop;

    const newValue = content.substring(0, startPos) + text + content.substring(endPos, content.length);
    onChange(newValue);

    // Reset cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = startPos + text.length;
      textarea.selectionEnd = startPos + text.length;
      textarea.scrollTop = scrollPos;
    }, 50);
  };

  // Block Insertion Templates
  const insertBlock = (type: "button" | "image" | "table" | "signature" | "link") => {
    switch (type) {
      case "button":
        insertTextAtCursor(
          `\n<a href="https://example.com" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0; font-family: sans-serif;">Click Here To Act</a>\n`
        );
        toast("Button block inserted", "HTML button added at cursor position.", "info");
        break;
      case "image":
        insertTextAtCursor(
          `\n<img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809" alt="Marketing Banner" style="width: 100%; max-width: 600px; height: auto; border-radius: 12px; margin: 16px 0;" />\n`
        );
        toast("Image block inserted", "Banner template added.", "info");
        break;
      case "table":
        insertTextAtCursor(
          `\n<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: sans-serif; font-size: 14px;">
  <thead>
    <tr style="border-bottom: 2px solid #27272a; color: #a1a1aa;">
      <th style="padding: 8px; text-align: left;">Product</th>
      <th style="padding: 8px; text-align: right;">Price</th>
    </tr>
  </thead>
  <tbody style="color: #e4e4e7;">
    <tr style="border-bottom: 1px solid #27272a;">
      <td style="padding: 8px;">Premium Plan (Annual)</td>
      <td style="padding: 8px; text-align: right;">$29.00 / mo</td>
    </tr>
  </tbody>
</table>\n`
        );
        toast("Table block inserted", "Pricing grid template added.", "info");
        break;
      case "signature":
        insertTextAtCursor(
          `\n<p style="margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px; color: #a1a1aa; font-size: 14px; font-family: sans-serif;">
  Best regards,<br/>
  <strong>Antigravity Admin Team</strong><br/>
  <span style="color: #6366f1;">Antigravity AI Platform</span>
</p>\n`
        );
        toast("Signature block inserted", "Signature template added.", "info");
        break;
      case "link":
        insertTextAtCursor(`<a href="https://example.com" style="color: #6366f1; text-decoration: underline;">your link text</a>`);
        toast("Hyperlink inserted", "Anchor tag template added.", "info");
        break;
    }
  };

  // AI Actions
  const handleAiRewrite = async () => {
    if (!content.trim()) {
      toast("No content to rewrite", "Please type some copy in the editor first.", "error");
      return;
    }
    setAiLoading(true);
    try {
      const res = await rewriteEmailAction(content, selectedTone);
      if (res.success && res.data) {
        onChange(res.data);
        toast("AI Rewrite complete", `Copy adjusted to a ${selectedTone} tone.`, "success");
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast("AI rewrite failed", err.message || "Failed to call OpenAI.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSuggestions = async () => {
    if (!aiPrompt.trim()) {
      toast("Input required", "Please describe your campaign (e.g. Black Friday sale for premium tools).", "error");
      return;
    }
    setAiLoading(true);
    try {
      const [subjRes, ctaRes] = await Promise.all([
        suggestSubjectsAction(aiPrompt),
        suggestCTAsAction(aiPrompt),
      ]);

      if (subjRes.success && subjRes.data) {
        setAiSubjects(subjRes.data);
      }
      if (ctaRes.success && ctaRes.data) {
        setAiCTAs(ctaRes.data);
      }
      toast("AI suggestions updated", "Open the tabs below to choose suggestions.", "success");
    } catch (err: any) {
      toast("AI query failed", err.message || "Failed to fetch suggestions.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // Render HTML preview using mock data
  const renderMockPreview = () => {
    const interpolatedBody = interpolate(content, MOCK_RECIPIENT);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #f4f4f5; background-color: #09090b; padding: 24px; margin: 0; }
            a { color: #6366f1; }
            img { max-width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <div style="max-width: 600px; margin: 0 auto; background-color: #09090b; padding: 20px; border-radius: 8px;">
            ${interpolatedBody || "<p style='color:#71717a;'>Email content is empty. Type in the editor tab to see content.</p>"}
          </div>
        </body>
      </html>
    `;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Editor & Blocks Pane */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="border-zinc-900 bg-zinc-950/20">
          <CardHeader className="border-b border-zinc-900">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Email Content</CardTitle>
                <CardDescription>Compose email with HTML elements and personalization tokens.</CardDescription>
              </div>
              
              {/* Preview Mode Toggler */}
              <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTab("editor")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === "editor" ? "bg-zinc-950 text-white shadow" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Code size={12} />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("desktop")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === "desktop" ? "bg-zinc-950 text-white shadow" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Monitor size={12} />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("mobile")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === "mobile" ? "bg-zinc-950 text-white shadow" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Smartphone size={12} />
                  <span>Mobile</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {tab === "editor" ? (
              <>
                {/* Subject & Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Subject Line"
                    placeholder="e.g. Hey {{first_name}}, check out our new update!"
                    value={subject}
                    onChange={(e) => onSubjectChange(e.target.value)}
                  />
                  <Input
                    label="Preview Text"
                    placeholder="e.g. Something special is waiting for you inside..."
                    value={previewText}
                    onChange={(e) => onPreviewTextChange(e.target.value)}
                  />
                </div>

                {/* Insertion Utilities bar */}
                <div className="flex flex-wrap gap-2 items-center p-2.5 bg-zinc-900/60 border border-zinc-900 rounded-xl">
                  {/* Merge Tags */}
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mr-1">Insert Fields:</span>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor("{{first_name}}")}
                    className="px-2.5 py-1 text-xs bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg font-mono transition-all"
                  >
                    first_name
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor("{{last_name}}")}
                    className="px-2.5 py-1 text-xs bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg font-mono transition-all"
                  >
                    last_name
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor("{{company}}")}
                    className="px-2.5 py-1 text-xs bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg font-mono transition-all"
                  >
                    company
                  </button>

                  <div className="w-px h-5 bg-zinc-800 mx-2" />

                  {/* HTML Blocks */}
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mr-1">Blocks:</span>
                  <button
                    type="button"
                    onClick={() => insertBlock("button")}
                    className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg flex items-center gap-1 text-xs px-2.5 py-1"
                    title="Insert CTA Button"
                  >
                    <Plus size={12} />
                    <span>Button</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertBlock("image")}
                    className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg flex items-center gap-1 text-xs px-2.5 py-1"
                    title="Insert Marketing Image"
                  >
                    <ImageIcon size={12} />
                    <span>Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertBlock("table")}
                    className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg flex items-center gap-1 text-xs px-2.5 py-1"
                    title="Insert HTML Pricing Table"
                  >
                    <Table size={12} />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertBlock("signature")}
                    className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg flex items-center gap-1 text-xs px-2.5 py-1"
                    title="Insert Signature Block"
                  >
                    <Signature size={12} />
                    <span>Signature</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertBlock("link")}
                    className="p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg flex items-center gap-1 text-xs px-2.5 py-1"
                    title="Insert Hyperlink"
                  >
                    <LinkIcon size={12} />
                    <span>Link</span>
                  </button>
                </div>

                {/* Editor Textarea */}
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    rows={16}
                    className="w-full px-4 py-3 text-sm bg-zinc-950 border border-zinc-900 rounded-2xl text-zinc-200 placeholder-zinc-700 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y min-h-[300px]"
                    placeholder="Type raw HTML or rich copy here. Use personalization merge tags..."
                  />
                </div>
              </>
            ) : (
              /* LIVE PREVIEWS */
              <div className="space-y-4">
                {/* Mock Info Bar */}
                <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/40 text-xs text-zinc-500 flex flex-wrap justify-between items-center gap-2">
                  <span>
                    Mocking Recipient: <strong className="text-zinc-300">{MOCK_RECIPIENT.first_name} {MOCK_RECIPIENT.last_name}</strong> ({MOCK_RECIPIENT.company})
                  </span>
                  <span>
                    Interpolated Subject: <strong className="text-zinc-300">"{interpolate(subject, MOCK_RECIPIENT)}"</strong>
                  </span>
                </div>

                {tab === "desktop" ? (
                  /* DESKTOP FRAME */
                  <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950">
                    {/* Header line */}
                    <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-950 flex items-center gap-2 text-xs text-zinc-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-750" />
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-750" />
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-750" />
                      <span className="ml-2 font-mono">{MOCK_RECIPIENT.email}</span>
                    </div>
                    {/* Mock Browser Body */}
                    <iframe
                      srcDoc={renderMockPreview()}
                      title="Desktop Render Preview"
                      className="w-full h-[450px] border-0 bg-[#09090b]"
                    />
                  </div>
                ) : (
                  /* MOBILE FRAME */
                  <div className="flex justify-center bg-zinc-950/10 py-6 border border-zinc-900 rounded-2xl">
                    <div className="w-[360px] border-8 border-zinc-850 rounded-[32px] overflow-hidden bg-zinc-950 shadow-2xl relative">
                      <div className="h-5 bg-zinc-850 w-full flex justify-center items-center">
                        <div className="w-16 h-3.5 bg-zinc-900 rounded-full" />
                      </div>
                      <iframe
                        srcDoc={renderMockPreview()}
                        title="Mobile Render Preview"
                        className="w-full h-[480px] border-0 bg-[#09090b]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Writer Sidebar Panel */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-zinc-900 bg-zinc-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-violet-400 animate-pulse" size={18} />
              <span>AI Writing Assistant</span>
            </CardTitle>
            <CardDescription>Leverage OpenAI to improve copy or generate ideas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tone Rewriter */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Tone Rewriter</span>
              <div className="flex gap-2">
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value as any)}
                  className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="urgent">Urgent Call to Action</option>
                  <option value="grammar">Fix Grammar Only</option>
                </select>
                <Button
                  onClick={handleAiRewrite}
                  loading={aiLoading}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <span>Rewrite</span>
                </Button>
              </div>
            </div>

            {/* Suggestions Generator */}
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Generate Subject & CTAs</span>
              <Textarea
                rows={3}
                placeholder="Describe your email objective (e.g. Launching a 20% discount on new tech analytics course starting next Monday)..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="text-xs"
              />
              <Button
                onClick={handleAiSuggestions}
                loading={aiLoading}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                <Sparkles size={12} />
                <span>Get Suggestions</span>
              </Button>
            </div>

            {/* Suggestions Display Lists */}
            {aiSubjects.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Suggested Subjects</span>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {aiSubjects.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        onSubjectChange(s.subject);
                        onPreviewTextChange(s.preview);
                        toast("Subject applied", "Applied suggested subject line and preview text.", "success");
                      }}
                      className="p-2.5 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-850 hover:border-zinc-800 cursor-pointer text-left text-xs transition-all flex flex-col gap-1"
                    >
                      <span className="font-semibold text-zinc-200">"{s.subject}"</span>
                      <span className="text-zinc-500 font-mono text-[10px]">Preview: {s.preview}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiCTAs.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Suggested CTA Buttons</span>
                <div className="flex flex-wrap gap-1.5">
                  {aiCTAs.map((cta, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        insertTextAtCursor(
                          `\n<a href="https://example.com" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0; font-family: sans-serif;">${cta}</a>\n`
                        );
                        toast("Applied CTA", `Inserted button with label: "${cta}"`, "success");
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white transition-all text-left"
                    >
                      {cta}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
