"use server";

import type { UIMessage } from "ai";
import { getCtx, runAction } from "@/server/action";
import { deleteChat as deleteChatService, listChats, loadChat } from "@/server/assistant/chats";
import { UserError } from "@/server/core";

export async function listChatsAction(weddingId: string) {
  const { ctx } = await getCtx(weddingId);
  return (await listChats(ctx)).map((c) => ({ id: c.id, title: c.title }));
}

/** The chat's visible messages, or null if it doesn't exist (yet). */
export async function loadChatMessages(weddingId: string, chatId: string): Promise<UIMessage[] | null> {
  const { ctx } = await getCtx(weddingId);
  try {
    const chat = await loadChat(ctx, chatId);
    // Context updates appended for the model aren't shown to users.
    return chat ? chat.messages.filter((m) => m.role !== "system") : null;
  } catch (e) {
    if (e instanceof UserError) return null;
    throw e;
  }
}

export async function deleteChat(weddingId: string, chatId: string) {
  return runAction(weddingId, (ctx) => deleteChatService(ctx, chatId));
}
