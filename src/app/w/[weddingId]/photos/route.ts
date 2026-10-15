import { AccessError, requireWeddingAccess } from "@/lib/access";
import { UserError } from "@/server/core";
import { addPhoto } from "@/server/photos";

// Upload one guest-page photo (multipart: file, width, height). A route handler rather than a
// server action, whose request size limit is too small for photos.
export async function POST(req: Request, { params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  try {
    const { user, wedding } = await requireWeddingAccess(weddingId, "editor");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new UserError("Choose a photo to upload.");
    const result = await addPhoto(
      { weddingId, userId: user.id, timezone: wedding.timezone, currency: wedding.currency },
      { data: Buffer.from(await file.arrayBuffer()), width: Number(form.get("width")), height: Number(form.get("height")) },
    );
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof UserError || e instanceof AccessError) return Response.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }
}
