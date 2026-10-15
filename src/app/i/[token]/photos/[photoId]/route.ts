import { eq } from "drizzle-orm";
import { db } from "@/db";
import { households } from "@/db/schema";
import { photoResponse } from "@/server/photos";

// A photo of the wedding this invitation link belongs to.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const [household] = await db
    .select({ weddingId: households.weddingId })
    .from(households)
    .where(eq(households.inviteToken, token));
  if (!household) return new Response("Not found", { status: 404 });
  return photoResponse(household.weddingId, photoId);
}
