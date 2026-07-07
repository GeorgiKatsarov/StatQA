import { env } from "../config/env.js";

interface GroqMessage {
  role: "system" | "user";
  content: string;
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
  }

  throw new Error("Groq response did not contain JSON.");
}

export async function callGroqJson(messages: GroqMessage[]): Promise<unknown> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed with ${response.status}: ${body.slice(0, 400)}`);
  }

  const payload = (await response.json()) as GroqChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq response was empty.");
  }

  return extractJson(content);
}
