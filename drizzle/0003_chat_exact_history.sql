ALTER TABLE "chat_messages" ALTER COLUMN "parts" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "system_prompt" text;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "context_snapshot" text;