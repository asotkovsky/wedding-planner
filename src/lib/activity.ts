import "server-only";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

type Executor = Pick<typeof db, "insert">;

export async function logActivity(
  entry: {
    weddingId: string;
    actorUserId: string;
    action: "create" | "update" | "delete";
    entityType: string;
    entityId?: string;
    summary: string;
    data?: unknown;
    viaAssistant?: boolean;
  },
  tx: Executor = db,
) {
  await tx.insert(activityLog).values(entry);
}
