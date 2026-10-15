import { requireWeddingAccess } from "@/lib/access";
import { photoResponse } from "@/server/photos";

// A guest-page photo, for the planning crew.
export async function GET(_req: Request, { params }: { params: Promise<{ weddingId: string; photoId: string }> }) {
  const { weddingId, photoId } = await params;
  await requireWeddingAccess(weddingId);
  return photoResponse(weddingId, photoId);
}
