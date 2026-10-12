import "server-only";
import type { UIMessage } from "ai";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chats } from "@/db/schema";
import { UserError, type Ctx } from "../core";

export async function listChats(ctx: Ctx) {
  return db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(eq(chats.weddingId, ctx.weddingId))
    .orderBy(desc(chats.updatedAt))
    .limit(50);
}

export type StoredChat = {
  title: string;
  systemPrompt: string | null;
  contextSnapshot: string | null;
  messages: UIMessage[];
};

/** Returns the chat's messages, or null if the chat doesn't exist yet. Throws if it belongs to another wedding. */
export async function loadChat(ctx: Ctx, chatId: string): Promise<StoredChat | null> {
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat) return null;
  if (chat.weddingId !== ctx.weddingId) throw new UserError("Chat not found");
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
  return {
    title: chat.title,
    systemPrompt: chat.systemPrompt,
    contextSnapshot: chat.contextSnapshot,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role as UIMessage["role"],
      parts: r.parts as UIMessage["parts"],
      ...(r.metadata ? { metadata: r.metadata } : {}),
    })),
  };
}

export async function createChat(
  ctx: Ctx,
  chatId: string,
  { firstMessage, systemPrompt, context }: { firstMessage: string; systemPrompt: string; context: string },
) {
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 80) || "New chat";
  await db
    .insert(chats)
    .values({ id: chatId, weddingId: ctx.weddingId, title, systemPrompt, contextSnapshot: context, createdBy: ctx.userId })
    .onConflictDoNothing();
}

/** Records the context the model has now seen. The system prompt itself is never changed once set. */
export async function updateChatContext(
  ctx: Ctx,
  chatId: string,
  { systemPrompt, context }: { systemPrompt?: string; context: string },
) {
  await db
    .update(chats)
    .set({ contextSnapshot: context, ...(systemPrompt ? { systemPrompt } : {}) })
    .where(and(eq(chats.id, chatId), eq(chats.weddingId, ctx.weddingId)));
}

/**
 * Upserts messages. History is append-only apart from the last assistant message,
 * which is replaced when the user answers a tool approval.
 */
export async function saveMessages(ctx: Ctx, chatId: string, messages: UIMessage[]) {
  if (!messages.length) return;
  await db.transaction(async (tx) => {
    // Preserve ordering for messages inserted in the same transaction.
    const base = Date.now();
    for (const [i, m] of messages.entries()) {
      await tx
        .insert(chatMessages)
        .values({
          id: m.id,
          chatId,
          role: m.role,
          parts: m.parts,
          metadata: m.metadata ?? null,
          userId: m.role === "user" ? ctx.userId : null,
          createdAt: new Date(base + i),
        })
        .onConflictDoUpdate({
          target: chatMessages.id,
          set: { parts: m.parts, metadata: m.metadata ?? null },
          setWhere: eq(chatMessages.chatId, chatId),
        });
    }
    await tx
      .update(chats)
      .set({ updatedAt: sql`now()` })
      .where(and(eq(chats.id, chatId), eq(chats.weddingId, ctx.weddingId)));
  });
}

export async function deleteChat(ctx: Ctx, chatId: string) {
  const [row] = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.weddingId, ctx.weddingId)))
    .returning({ id: chats.id });
  if (!row) throw new UserError("Chat not found");
}
