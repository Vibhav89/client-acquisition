export interface AiChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface AiProvider {
  complete(messages: readonly AiChatMessage[]): Promise<string>;
}

export function readAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig | undefined {
  const apiKey = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();
  if (!apiKey || !model) return undefined;
  const baseUrl = (env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("AI_BASE_URL must be a valid URL"); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("AI_BASE_URL must use HTTPS outside localhost");
  }
  return { apiKey, baseUrl, model, timeoutMs: 25_000 };
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly config: AiProviderConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  async complete(messages: readonly AiChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 25_000);
    try {
      const response = await this.request(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.35,
          max_tokens: 900,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // Never return provider response bodies: they can contain request details or secrets.
        throw new Error(`AI provider request failed (HTTP ${response.status})`);
      }
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("AI provider returned an empty response");
      }
      return content.trim();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("AI provider request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
