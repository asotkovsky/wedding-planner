import { boolean, index, json, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { weddings } from "./weddings";

// Assistant conversations, shared by all members of a wedding.
export const chats = pgTable(
  "chats",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    // Frozen when the chat starts: Claude ties its reasoning to the exact system prompt,
    // so it must not change for the life of the chat.
    systemPrompt: text("system_prompt"),
    // The wedding context the model last saw; changes are appended as system messages.
    contextSnapshot: text("context_snapshot"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("chats_wedding_idx").on(t.weddingId)],
);

// One row per AI SDK UIMessage. `json` (not `jsonb`) keeps the exact text, including key
// order: replayed history must be byte-identical for Claude's thinking blocks to stay valid.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: json("parts").$type<unknown[]>().notNull(),
    metadata: json("metadata"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_chat_idx").on(t.chatId, t.createdAt)],
);

// Audit trail of changes, including those made by the assistant.
export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    viaAssistant: boolean("via_assistant").notNull().default(false),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_log_wedding_idx").on(t.weddingId, t.createdAt)],
);
