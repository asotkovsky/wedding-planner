import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { weddingPhotos } from "@/db/schema";
import { log, UserError, type Ctx } from "./core";

export const MAX_PHOTOS = 12;
/** The browser resizes photos to about 1600px before upload, which lands well under this. */
const MAX_BYTES = 3_000_000;

/** The image type from the file's first bytes; the browser's claimed type isn't trusted. */
function sniffImageType(data: Buffer) {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** The wedding's photos, cover first (without the image data). */
export async function listPhotos(weddingId: string) {
  return db
    .select({ id: weddingPhotos.id, width: weddingPhotos.width, height: weddingPhotos.height })
    .from(weddingPhotos)
    .where(eq(weddingPhotos.weddingId, weddingId))
    .orderBy(asc(weddingPhotos.sortOrder), asc(weddingPhotos.createdAt));
}

export async function addPhoto(ctx: Ctx, photo: { data: Buffer; width: number; height: number }) {
  const contentType = sniffImageType(photo.data);
  if (!contentType) throw new UserError("That file isn't a JPEG, PNG or WebP image.");
  if (photo.data.length > MAX_BYTES) throw new UserError("That photo is too large. Try a smaller one.");
  const width = Math.round(photo.width);
  const height = Math.round(photo.height);
  if (!(width > 0 && height > 0 && width <= 10_000 && height <= 10_000))
    throw new UserError("Couldn't read that photo's size.");

  const [{ count, last }] = await db
    .select({ count: sql<number>`count(*)::int`, last: sql<number>`coalesce(max(${weddingPhotos.sortOrder}), 0)::int` })
    .from(weddingPhotos)
    .where(eq(weddingPhotos.weddingId, ctx.weddingId));
  if (count >= MAX_PHOTOS) throw new UserError(`You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`);

  const [row] = await db
    .insert(weddingPhotos)
    .values({ weddingId: ctx.weddingId, contentType, data: photo.data, width, height, sortOrder: last + 1 })
    .returning({ id: weddingPhotos.id });
  await log(ctx, "create", "photo", "Added a photo to the guest page", row.id);
  return { photoId: row.id };
}

export async function deletePhoto(ctx: Ctx, photoId: string) {
  const [row] = await db
    .delete(weddingPhotos)
    .where(and(eq(weddingPhotos.id, photoId), eq(weddingPhotos.weddingId, ctx.weddingId)))
    .returning({ id: weddingPhotos.id });
  if (!row) throw new UserError("Photo not found");
  await log(ctx, "delete", "photo", "Removed a photo from the guest page", photoId);
  return { photoId };
}

/** Saves a new order for the wedding's photos (all of them, cover first). */
export async function reorderPhotos(ctx: Ctx, photoIds: string[]) {
  const current = await listPhotos(ctx.weddingId);
  const same =
    photoIds.length === current.length &&
    new Set(photoIds).size === photoIds.length &&
    current.every((p) => photoIds.includes(p.id));
  if (!same) throw new UserError("The photos changed in the meantime. Reload and try again.");
  await db.transaction(async (tx) => {
    for (const [i, id] of photoIds.entries()) {
      await tx
        .update(weddingPhotos)
        .set({ sortOrder: i })
        .where(and(eq(weddingPhotos.id, id), eq(weddingPhotos.weddingId, ctx.weddingId)));
    }
  });
  return { photoIds };
}

/** One photo's image as an HTTP response, if it belongs to this wedding. */
export async function photoResponse(weddingId: string, photoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return new Response("Not found", { status: 404 });
  const [photo] = await db
    .select({ contentType: weddingPhotos.contentType, data: weddingPhotos.data })
    .from(weddingPhotos)
    .where(and(eq(weddingPhotos.id, photoId), eq(weddingPhotos.weddingId, weddingId)));
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "X-Content-Type-Options": "nosniff",
      // A photo never changes (a new upload gets a new id), so browsers can keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
