import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MemberRole } from "@/db/schema";
import { AccessError, requireWeddingAccess } from "@/lib/access";
import { UserError, type Ctx } from "./core";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a service call for use from a server action: authorizes, builds the Ctx,
 * revalidates the wedding's pages, and turns expected errors into a result.
 */
export async function runAction<T>(
  weddingId: string,
  fn: (ctx: Ctx) => Promise<T>,
  minRole: MemberRole = "editor",
): Promise<ActionResult<T>> {
  try {
    const { user, wedding } = await requireWeddingAccess(weddingId, minRole);
    const data = await fn({ weddingId, userId: user.id, timezone: wedding.timezone, currency: wedding.currency });
    revalidatePath(`/w/${weddingId}`, "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError || e instanceof AccessError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: z.prettifyError(e) };
    throw e;
  }
}

/** Read-only counterpart for pages: authorizes and builds the Ctx. */
export async function getCtx(weddingId: string) {
  const { user, wedding, role } = await requireWeddingAccess(weddingId);
  const ctx: Ctx = { weddingId, userId: user.id, timezone: wedding.timezone, currency: wedding.currency };
  return { ctx, wedding, role, user };
}
