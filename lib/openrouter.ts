// ── OpenRouter client ────────────────────────────────────────
// Thin wrapper over the OpenRouter chat-completions API. Used by the
// parse-round (vision), analyze-swing (vision), and coach API routes.

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Verified live slugs (OpenRouter, June 2026):
//   google/gemini-2.5-flash      — robust, cheap vision for scorecard OCR + swing frames
//                                   (anthropic/claude-3.5-haiku is Bedrock-only on OR and
//                                    rejects image input, so it can't be used for vision)
//   anthropic/claude-sonnet-4.5  — stronger reasoning for coach pattern synthesis (text)
export const MODELS = {
  vision: "google/gemini-2.5-flash",
  reasoning: "anthropic/claude-sonnet-4.5",
} as const;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export interface CallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the model to return strict JSON. */
  json?: boolean;
  /** OpenRouter provider routing (e.g. pin a specific provider). */
  provider?: Record<string, unknown>;
}

export async function callClaude(
  messages: ChatMessage[],
  opts: CallOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? MODELS.reasoning,
    messages,
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.provider) body.provider = opts.provider;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://caddiebook.vercel.app",
      "X-Title": "Caddie Book",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter returned no message content");
  }
  return content;
}

/** Best-effort JSON extraction from a model response (handles ```json fences). */
export function parseJsonLoose<T = unknown>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse JSON from model response");
  }
}

/** Build a vision message: text prompt + one or more base64 data URLs. */
export function visionMessage(text: string, images: string[]): ChatMessage {
  return {
    role: "user",
    content: [
      { type: "text", text },
      ...images.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ],
  };
}
