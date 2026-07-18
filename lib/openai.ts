import OpenAI from "openai";
import { getSettings } from "@/services/settings";

export async function getOpenAIClient(): Promise<OpenAI> {
  const settings = await getSettings();
  const apiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Please add it in the Settings panel.");
  }
  return new OpenAI({ apiKey });
}

export async function rewriteEmailText(content: string, tone: "professional" | "friendly" | "urgent" | "grammar"): Promise<string> {
  const openai = await getOpenAIClient();

  const prompts = {
    professional: "Rewrite the following email to make it sound highly professional, polite, and executive. Maintain the core message and links, but elevate the vocabulary and structure.",
    friendly: "Rewrite the following email to make it sound friendly, warm, casual, and conversational. Maintain the core message and links, but make it feel human and approachable.",
    urgent: "Rewrite the following email to add a subtle sense of urgency or call-to-action prompt. Make it clear and compelling without sounding spammy.",
    grammar: "Proofread the following email. Fix all spelling, grammatical errors, punctuation, and structural flow while keeping the tone exactly the same."
  };

  const prompt = prompts[tone] || prompts.grammar;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert copywriter for professional B2B/B2C email marketing campaigns." },
      { role: "user", content: `${prompt}\n\nEmail Content:\n${content}` }
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || content;
}

export async function generateSubjectSuggestions(description: string): Promise<{ subject: string; preview: string }[]> {
  const openai = await getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert copywriter. Output JSON format only." },
      {
        role: "user",
        content: `Based on this campaign description: "${description}", suggest 5 pairs of compelling email Subject Lines and accompanying Preview Texts.
        Return the result strictly as a JSON array of objects with the structure: [{"subject": "...", "preview": "..."}]`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const rawJson = response.choices[0]?.message?.content || "{}";
  try {
    const data = JSON.parse(rawJson);
    const list = Array.isArray(data) ? data : data.suggestions || data.data || [];
    return list.slice(0, 5);
  } catch (err) {
    console.error("Failed to parse OpenAI JSON response:", rawJson);
    return [];
  }
}

export async function generateCTASuggestions(description: string): Promise<string[]> {
  const openai = await getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert copywriter. Output JSON format only." },
      {
        role: "user",
        content: `Based on this campaign description: "${description}", suggest 5 short, high-conversion Call-To-Action (CTA) button texts.
        Return the result strictly as a JSON array of strings: ["Sign Up Now", "Get 50% Off", ...]`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const rawJson = response.choices[0]?.message?.content || "{}";
  try {
    const data = JSON.parse(rawJson);
    const list = Array.isArray(data) ? data : data.suggestions || data.ctas || data.data || [];
    return list.slice(0, 5);
  } catch (err) {
    console.error("Failed to parse OpenAI CTA JSON response:", rawJson);
    return [];
  }
}
