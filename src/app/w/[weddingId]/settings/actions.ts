"use server";

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { weddingInvites, weddingMembers, weddings } from "@/db/schema";
import { requireWeddingAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { normalizeHex } from "@/lib/theme";
import { runAction } from "@/server/action";
import { updateGuestPageContent, type GuestPageContentInput } from "@/server/guest-page";

export type FormState = { ok?: boolean; error?: string; errors?: Record<string, string[] | undefined> } | undefined;

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

const weddingDetailsSchema = z.object({
  partner1Name: z.string().trim().min(1, "Required"),
  partner2Name: z.string().trim().min(1, "Required"),
  name: z.string().trim().min(1, "Required"),
  date: z.union([z.iso.date(), z.literal("").transform(() => null)]),
  timezone: z.string().trim().min(1),
  currency: z.string().trim().length(3),
  totalBudget: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().nonnegative().transform((n) => Math.round(n * 100)),
  ]),
  venueName: optionalText,
  venueAddress: optionalText,
});

export async function updateWeddingDetails(weddingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireWeddingAccess(weddingId, "editor");
  const parsed = weddingDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const { totalBudget, ...rest } = parsed.data;
  await db
    .update(weddings)
    .set({ ...rest, totalBudgetCents: totalBudget })
    .where(eq(weddings.id, weddingId));
  await logActivity({
    weddingId,
    actorUserId: user.id,
    action: "update",
    entityType: "wedding",
    entityId: weddingId,
    summary: "Updated wedding details",
  });
  revalidatePath(`/w/${weddingId}`, "layout");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["owner", "editor", "viewer"]),
});

export async function createInvite(weddingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireWeddingAccess(weddingId, "owner");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  await db.insert(weddingInvites).values({
    weddingId,
    ...parsed.data,
    token: nanoid(32),
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + 14 * 86_400_000),
  });
  await logActivity({
    weddingId,
    actorUserId: user.id,
    action: "create",
    entityType: "invite",
    summary: `Invited ${parsed.data.email} as ${parsed.data.role}`,
  });
  revalidatePath(`/w/${weddingId}/settings`);
  return { ok: true };
}

export async function revokeInvite(weddingId: string, inviteId: string) {
  await requireWeddingAccess(weddingId, "owner");
  await db
    .delete(weddingInvites)
    .where(
      and(eq(weddingInvites.id, inviteId), eq(weddingInvites.weddingId, weddingId), isNull(weddingInvites.acceptedAt)),
    );
  revalidatePath(`/w/${weddingId}/settings`);
}

export async function changeMemberRole(weddingId: string, userId: string, role: "owner" | "editor" | "viewer") {
  const { user } = await requireWeddingAccess(weddingId, "owner");
  await assertNotLastOwner(weddingId, userId, role);
  await db
    .update(weddingMembers)
    .set({ role })
    .where(and(eq(weddingMembers.weddingId, weddingId), eq(weddingMembers.userId, userId)));
  await logActivity({
    weddingId,
    actorUserId: user.id,
    action: "update",
    entityType: "member",
    entityId: userId,
    summary: `Changed a member's role to ${role}`,
  });
  revalidatePath(`/w/${weddingId}/settings`);
}

export async function removeMember(weddingId: string, userId: string) {
  const { user } = await requireWeddingAccess(weddingId, "owner");
  await assertNotLastOwner(weddingId, userId, null);
  await db
    .delete(weddingMembers)
    .where(and(eq(weddingMembers.weddingId, weddingId), eq(weddingMembers.userId, userId)));
  await logActivity({
    weddingId,
    actorUserId: user.id,
    action: "delete",
    entityType: "member",
    entityId: userId,
    summary: "Removed a member",
  });
  revalidatePath(`/w/${weddingId}/settings`);
}

async function assertNotLastOwner(weddingId: string, userId: string, newRole: string | null) {
  if (newRole === "owner") return;
  const owners = await db
    .select({ userId: weddingMembers.userId })
    .from(weddingMembers)
    .where(and(eq(weddingMembers.weddingId, weddingId), eq(weddingMembers.role, "owner")));
  if (owners.length === 1 && owners[0].userId === userId) {
    throw new Error("A wedding must keep at least one owner.");
  }
}

export async function updateWeddingColors(
  weddingId: string,
  colors: { primary: string | null; accent: string | null },
): Promise<FormState> {
  const { user } = await requireWeddingAccess(weddingId, "editor");
  const primary = colors.primary === null ? null : normalizeHex(colors.primary);
  const accent = colors.accent === null ? null : normalizeHex(colors.accent);
  if ((colors.primary !== null && !primary) || (colors.accent !== null && !accent)) {
    return { error: "Colors must be hex values like #FF6B5B" };
  }
  await db.update(weddings).set({ themePrimary: primary, themeAccent: accent }).where(eq(weddings.id, weddingId));
  await logActivity({
    weddingId,
    actorUserId: user.id,
    action: "update",
    entityType: "wedding",
    entityId: weddingId,
    summary: "Updated the wedding colors",
  });
  revalidatePath(`/w/${weddingId}`, "layout");
  return { ok: true };
}

export async function updateGuestPage(weddingId: string, input: GuestPageContentInput) {
  return runAction(weddingId, (ctx) => updateGuestPageContent(ctx, input));
}
