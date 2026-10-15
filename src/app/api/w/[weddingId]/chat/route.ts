import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createIdGenerator,
  isToolUIPart,
  stepCountIs,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable, weddingMembers } from "@/db/schema";
import { canEdit, requireWeddingAccess } from "@/lib/access";
import { aiErrorMessage, anthropic, MODEL } from "@/server/ai";
import { createChat, loadChat, saveMessages, updateChatContext } from "@/server/assistant/chats";
import { buildContext, buildSystemPrompt } from "@/server/assistant/prompt";
import { buildTools, toolApproval } from "@/server/assistant/tools";
import { UserError, type Ctx } from "@/server/core";

export const maxDuration = 300;

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });


const bodySchema = z.object({
  chatId: z.uuid(),
  // Only the newest message is sent; history is loaded from the database.
  message: z.object({ id: z.string().min(1), role: z.enum(["user", "assistant"]) }).loose(),
});

export async function POST(req: Request, { params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { user, wedding, role } = await requireWeddingAccess(weddingId);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { chatId } = parsed.data;
  const incoming = parsed.data.message as unknown as UIMessage;

  const ctx: Ctx = { weddingId, userId: user.id, timezone: wedding.timezone, currency: wedding.currency, viaAssistant: true };
  const canWrite = canEdit(role);
  const tools = buildTools(ctx, { canWrite });

  let stored;
  try {
    stored = await loadChat(ctx, chatId);
  } catch (e) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
  if (!stored && incoming.role !== "user") return Response.json({ error: "Chat not found" }, { status: 404 });
  const history = stored?.messages ?? [];

  // A new user message is appended. An assistant message with the same id as the last
  // stored one carries the user's tool-approval answers and replaces it.
  let messages: UIMessage[];
  if (incoming.role === "user") messages = [...history, incoming];
  else if (history.at(-1)?.id === incoming.id) messages = [...history.slice(0, -1), incoming];
  else return Response.json({ error: "Out-of-date conversation; reload the page" }, { status: 409 });

  // A reply cut off by an error or Stop can leave tool calls that never ran. Claude rejects a
  // call without a result, so leave those out or the chat could never continue.
  messages = messages.map((m) =>
    m.role === "assistant"
      ? { ...m, parts: m.parts.filter((p) => !(isToolUIPart(p) && (p.state === "input-streaming" || p.state === "input-available"))) }
      : m,
  );

  // Index of the first message this turn may change (and so must be saved).
  const changedFrom = incoming.role === "user" ? history.length : history.length - 1;

  // The history replayed to Claude must be append-only (its thinking is bound to the exact
  // prefix), so the system prompt is frozen per chat and context changes are appended.
  const members = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(weddingMembers)
    .innerJoin(userTable, eq(userTable.id, weddingMembers.userId))
    .where(eq(weddingMembers.weddingId, weddingId));
  const context = buildContext({ wedding, user, role, members });
  let systemPrompt = stored?.systemPrompt ?? null;
  const newMessages = incoming.role === "user" ? [incoming] : [];

  if (!stored) {
    systemPrompt = buildSystemPrompt(context);
    const text = incoming.parts?.find((p) => p.type === "text");
    await createChat(ctx, chatId, {
      firstMessage: text && "text" in text ? text.text : "New chat",
      systemPrompt,
      context,
    });
  } else if (!systemPrompt) {
    // Chat started before prompts were frozen: freeze one now.
    systemPrompt = buildSystemPrompt(context);
    await updateChatContext(ctx, chatId, { systemPrompt, context });
  } else if (incoming.role === "user" && stored.contextSnapshot !== context) {
    // Must follow a user message (Anthropic's placement rule for mid-conversation system messages).
    const update: UIMessage = {
      id: generateMessageId(),
      role: "system",
      parts: [{ type: "text", text: `The wedding context has changed. Current context:\n\n${context}` }],
    };
    messages.push(update);
    newMessages.push(update);
    await updateChatContext(ctx, chatId, { context });
  }

  const validated = await validateUIMessages({ messages, tools });
  if (newMessages.length) await saveMessages(ctx, chatId, newMessages);

  let wroteData = false;
  const result = streamText({
    model: anthropic(MODEL),
    instructions: systemPrompt,
    messages: await convertToModelMessages(validated, { tools }),
    allowSystemInMessages: true,
    tools,
    toolApproval,
    // Signs approval requests so a client can't forge an approval for a call the model never made.
    experimental_toolApprovalSecret: process.env.BETTER_AUTH_SECRET,
    stopWhen: stepCountIs(25),
    providerOptions: {
      anthropic: {
        effort: "medium",
        thinking: {
          type: "adaptive",
          display: "summarized",
          // Thinking blocks are bound to the exact system prompt, tools and history that produced them.
          // Changing the tools (e.g. shipping a new tool) invalidates them in older chats, so drop the
          // stale reasoning and carry on; drops are logged below. Set ASSISTANT_STRICT_THINKING=true to
          // fail instead, which is useful when testing that the history replays byte-for-byte.
          blockBinding: {
            prefixMismatchBehavior: process.env.ASSISTANT_STRICT_THINKING === "true" ? "error" : "drop_block",
          },
        },
        // Re-run on a fallback model if a safety classifier declines the request.
        fallbacks: "default",
        cacheControl: { type: "ephemeral" },
        metadata: { userId: user.id },
      } satisfies AnthropicLanguageModelOptions,
    },
    onToolExecutionEnd: ({ toolCall }) => {
      if (!toolCall.toolName.startsWith("list_") && !toolCall.toolName.startsWith("get_")) wroteData = true;
    },
    onStepEnd: ({ providerMetadata }) => {
      const dropped = providerMetadata?.anthropic?.inputTransformations;
      if (Array.isArray(dropped) && dropped.length) {
        console.warn(`Assistant chat ${chatId}: thinking blocks dropped`, JSON.stringify(dropped));
      }
    },
  });

  // Finish (and persist) even if the browser disconnects mid-stream.
  void result.consumeStream();

  return result.toUIMessageStreamResponse({
    originalMessages: validated,
    generateMessageId,
    onFinish: async ({ messages: finalMessages }) => {
      await saveMessages(ctx, chatId, finalMessages.slice(changedFrom));
      if (wroteData) revalidatePath(`/w/${weddingId}`, "layout");
    },
    onError: (error) => {
      console.error("Assistant error", error);
      return aiErrorMessage(error, "Sorry, something went wrong talking to the assistant. Please try again.");
    },
  });
}
