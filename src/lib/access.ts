import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { weddingMembers, weddings, type MemberRole } from "@/db/schema";
import { auth } from "@/lib/auth";

const roleRank: Record<MemberRole, number> = { viewer: 0, editor: 1, owner: 2 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export class AccessError extends Error {}

/**
 * The tenancy gate. Every page, server action and AI tool that touches wedding data
 * must go through this. A non-member gets a 404 so wedding ids can't be probed.
 */
export const requireWeddingAccess = cache(async (weddingId: string, minRole: MemberRole = "viewer") => {
  const user = await requireUser();
  if (!UUID_RE.test(weddingId)) notFound();
  const [row] = await db
    .select({ wedding: weddings, role: weddingMembers.role })
    .from(weddingMembers)
    .innerJoin(weddings, eq(weddings.id, weddingMembers.weddingId))
    .where(and(eq(weddingMembers.weddingId, weddingId), eq(weddingMembers.userId, user.id)));

  if (!row) notFound();
  if (roleRank[row.role] < roleRank[minRole]) {
    throw new AccessError(`This action requires the ${minRole} role.`);
  }
  return { user, wedding: row.wedding, role: row.role };
});

export function canEdit(role: MemberRole) {
  return roleRank[role] >= roleRank.editor;
}
