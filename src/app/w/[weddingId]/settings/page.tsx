import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { user, weddingInvites, weddingMembers } from "@/db/schema";
import { canEdit, requireWeddingAccess } from "@/lib/access";
import { InviteForm, InviteList, MemberList, WeddingDetailsForm } from "./forms";

export default async function SettingsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, role, user: me } = await requireWeddingAccess(weddingId);
  const isOwner = role === "owner";

  const [members, invites] = await Promise.all([
    db
      .select({ userId: user.id, name: user.name, email: user.email, role: weddingMembers.role })
      .from(weddingMembers)
      .innerJoin(user, eq(user.id, weddingMembers.userId))
      .where(eq(weddingMembers.weddingId, weddingId))
      .orderBy(asc(weddingMembers.createdAt)),
    isOwner
      ? db
          .select()
          .from(weddingInvites)
          .where(
            and(
              eq(weddingInvites.weddingId, weddingId),
              isNull(weddingInvites.acceptedAt),
              gt(weddingInvites.expiresAt, new Date()),
            ),
          )
      : Promise.resolve([]),
  ]);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Wedding details</CardTitle>
        </CardHeader>
        <CardContent>
          <WeddingDetailsForm wedding={wedding} disabled={!canEdit(role)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collaborators</CardTitle>
          <CardDescription>
            Owners manage collaborators. Editors can change anything else. Viewers have read-only access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <MemberList weddingId={weddingId} members={members} meId={me.id} isOwner={isOwner} />
          {isOwner && (
            <>
              <InviteForm weddingId={weddingId} />
              <InviteList
                weddingId={weddingId}
                invites={invites.map((i) => ({
                  id: i.id,
                  email: i.email,
                  role: i.role,
                  link: `${origin}/invite/${i.token}`,
                }))}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
