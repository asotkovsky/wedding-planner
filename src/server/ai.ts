import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";

export const MODEL = "claude-opus-5-5";

// API keys that aren't scoped to a workspace must name one on every request.
export const anthropic = createAnthropic({
  headers: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : undefined,
});

/** A message people can act on for the AI errors that aren't worth a retry, or a fallback. */
export function aiErrorMessage(error: unknown, fallback: string) {
  // The provider's reason can sit on the error itself, its body, or a wrapped retry/cause error.
  type ErrorLike = { message?: string; responseBody?: string; lastError?: ErrorLike; cause?: ErrorLike };
  const e = error as ErrorLike | undefined;
  const text = [e, e?.lastError, e?.cause].map((x) => `${x?.message ?? ""} ${x?.responseBody ?? ""}`).join(" ");
  if (/credit balance is too low/i.test(text)) {
    return "The AI service has run out of credits. Add credits in the Anthropic Console (Plans & Billing), then try again.";
  }
  if (/rate.?limit|overloaded/i.test(text)) return "The AI service is busy right now. Please try again in a minute.";
  return fallback;
}
