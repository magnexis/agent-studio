import OpenAI from "openai";
import { getModel, getProviderConfig, getTemperature, normalizeBaseUrl } from "./provider";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletion {
  content: string;
  raw: unknown;
}

export interface CompleteChatOptions {
  onTextDelta?: (delta: string) => void | Promise<void>;
}

interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

export async function completeChat(messages: ChatMessage[], apiKey: string, options: CompleteChatOptions = {}): Promise<ChatCompletion> {
  const provider = getProviderConfig();
  const model = getModel();
  const baseUrl = normalizeBaseUrl(provider.baseUrl);

  if (!baseUrl) {
    throw new Error("Set magnexis.customBaseUrl before using the custom provider.");
  }

  if (provider.id === "openai") {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl
    });
    if (options.onTextDelta) {
      const stream = client.responses.stream({
        model,
        instructions: extractInstructions(messages),
        input: buildResponsesInput(messages)
      });
      let streamedText = "";
      stream.on("response.output_text.delta", (event) => {
        const delta = event.delta ?? "";
        if (!delta) {
          return;
        }
        streamedText += delta;
        void options.onTextDelta?.(delta);
      });
      const response = await stream.finalResponse();
      const content = response.output_text?.trim() || streamedText.trim();
      if (!content) {
        throw new Error("The provider returned an empty response.");
      }
      return { content, raw: response };
    }

    const response = await client.responses.create({
      model,
      instructions: extractInstructions(messages),
      input: buildResponsesInput(messages)
    });
    const content = response.output_text?.trim();
    if (!content) {
      throw new Error("The provider returned an empty response.");
    }
    return { content, raw: response };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: getTemperature(),
      stream: false
    })
  });

  const raw = await response.json().catch(() => ({})) as CompletionResponse;
  if (!response.ok) {
    const message = raw.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`${provider.label} request failed: ${message}`);
  }

  const content = raw.choices?.[0]?.message?.content ?? raw.choices?.[0]?.text ?? "";
  if (!content.trim()) {
    throw new Error("The provider returned an empty response.");
  }

  return { content, raw };
}

function extractInstructions(messages: ChatMessage[]): string | undefined {
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content.trim()).filter(Boolean);
  return systemMessages.length ? systemMessages.join("\n\n") : undefined;
}

function buildResponsesInput(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: Array<{ type: "input_text"; text: string }> }> {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [
        {
          type: "input_text" as const,
          text: message.content
        }
      ]
    }));
}
