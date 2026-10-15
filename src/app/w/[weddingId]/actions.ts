"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { weddings } from "@/db/schema";
import { runAction } from "@/server/action";

const stepKey = z.enum(["events", "guests", "budget", "guest-page", "crew"]);

/** Skips (or un-skips) one of the Home "First steps" for everyone planning this wedding. */
export async function setFirstStepSkipped(weddingId: string, step: string, skipped: boolean) {
  return runAction(weddingId, async (ctx) => {
    const key = stepKey.parse(step);
    const [row] = await db
      .select({ skippedSteps: weddings.skippedSteps })
      .from(weddings)
      .where(eq(weddings.id, ctx.weddingId));
    const rest = row.skippedSteps.filter((s) => s !== key);
    await db
      .update(weddings)
      .set({ skippedSteps: skipped ? [...rest, key] : rest })
      .where(eq(weddings.id, ctx.weddingId));
  });
}
