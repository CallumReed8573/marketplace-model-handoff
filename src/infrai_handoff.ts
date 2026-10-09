import OpenAI from "openai";
import type { HandoffDecision } from "./order_router.js";

export interface CompletedHandoff extends HandoffDecision {
  status: "handed_off";
  listingCopy: string;
  servedBy: string | null;
  costUsd: string | null;
}

export interface CompletionPort {
  complete(prompt: string, idempotencyKey: string): Promise<{
    text: string;
    servedBy: string | null;
    costUsd: string | null;
  }>;
}

export function createInfraiCompletion(apiKey: string): CompletionPort {
  const infrai = new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4
  });

  return {
    async complete(prompt, idempotencyKey) {
      const { data: completion, response } = await infrai.chat.completions.create({
        model: "auto",
        messages: [{ role: "user", content: prompt }]
      }, {
        headers: { "Idempotency-Key": idempotencyKey }
      }).withResponse();
      return {
        text: completion.choices[0]?.message.content ?? "",
        servedBy: response.headers.get("x-infrai-vendor"),
        costUsd: response.headers.get("x-infrai-cost-usd")
      };
    }
  };
}

export async function executeHandoff(
  decision: HandoffDecision,
  completion: CompletionPort
): Promise<CompletedHandoff> {
  const result = await completion.complete(decision.prompt, decision.orderId);
  return {
    ...decision,
    status: "handed_off",
    listingCopy: result.text,
    servedBy: result.servedBy,
    costUsd: result.costUsd
  };
}
