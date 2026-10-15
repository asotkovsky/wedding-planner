"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { budgetCategories, weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { DEFAULT_BUDGET_CATEGORIES } from "@/lib/defaults";
import { normalizeHex } from "@/lib/theme";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || null);

const hex = z
  .string()
  .optional()
  .transform((v) => normalizeHex(v));

const createWeddingSchema = z.object({
  partner1Name: z.string().trim().min(1, "Required").max(100),
  partner2Name: z.string().trim().min(1, "Required").max(100),
  date: z.union([z.iso.date(), z.literal("").transform(() => null)]).optional(),
  venueName: optionalText,
  currency: z.string().length(3).default("USD"),
  timezone: z.string().min(1).default("America/New_York"),
  themePrimary: hex,
  themeAccent: hex,
});

export type CreateWeddingInput = z.input<typeof createWeddingSchema>;
export type CreateWeddingResult = { errors: Record<string, string[] | undefined> } | undefined;

export async function createWedding(raw: CreateWeddingInput): Promise<CreateWeddingResult> {
  const user = await requireUser();
  const parsed = createWeddingSchema.safeParse(raw);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const input = parsed.data;
  const weddingId = await db.transaction(async (tx) => {
    const [wedding] = await tx
      .insert(weddings)
      .values({
        ...input,
        date: input.date ?? null,
        name: `${input.partner1Name} & ${input.partner2Name}`,
        createdBy: user.id,
      })
      .returning({ id: weddings.id, name: weddings.name });
    await tx.insert(weddingMembers).values({ weddingId: wedding.id, userId: user.id, role: "owner" });
    await tx
      .insert(budgetCategories)
      .values(DEFAULT_BUDGET_CATEGORIES.map((name, i) => ({ weddingId: wedding.id, name, sortOrder: i })));
    await logActivity(
      {
        weddingId: wedding.id,
        actorUserId: user.id,
        action: "create",
        entityType: "wedding",
        entityId: wedding.id,
        summary: `Created ${wedding.name}`,
      },
      tx,
    );
    return wedding.id;
  });

  // ?welcome=1 makes Home celebrate once.
  redirect(`/w/${weddingId}?welcome=1`);
}
