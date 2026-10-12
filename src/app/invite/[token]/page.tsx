import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { weddingInvites, weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { logActivity } from "@/lib/activity";

async function findInvite(token: string) {
  const [row] = await db
    .select({ invite: weddingInvites, weddingName: weddings.name })
    .from(weddingInvites)
    .innerJoin(weddings, eq(weddings.id, weddingInvites.weddingId))
    .where(
      and(eq(weddingInvites.token, token), isNull(weddingInvites.acceptedAt), gt(weddingInvites.expiresAt, new Date())),
    );
  return row;
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser();
  const row = await findInvite(token);

  if (!row) {
    return <Message title="Invite not found" body="This invite link is invalid, expired, or already used." />;
  }
  if (row.invite.email !== user.email.toLowerCase()) {
    return (
      <Message
        title="Wrong account"
        body={`This invite was sent to ${row.invite.email}, but you're signed in as ${user.email}.`}
      />
    );
  }

  async function accept() {
    "use server";
    const user = await requireUser();
    const row = await findInvite(token);
    if (!row || row.invite.email !== user.email.toLowerCase()) redirect(`/invite/${token}`);
    const { invite } = row;
    await db.transaction(async (tx) => {
      await tx
        .insert(weddingMembers)
        .values({ weddingId: invite.weddingId, userId: user.id, role: invite.role })
        .onConflictDoNothing();
      await tx.update(weddingInvites).set({ acceptedAt: new Date() }).where(eq(weddingInvites.id, invite.id));
      await logActivity(
        {
          weddingId: invite.weddingId,
          actorUserId: user.id,
          action: "create",
          entityType: "member",
          entityId: user.id,
          summary: `${user.name} joined as ${invite.role}`,
        },
        tx,
      );
    });
    redirect(`/w/${invite.weddingId}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join {row.weddingName}</CardTitle>
          <CardDescription>You&apos;ve been invited as {row.invite.role === "viewer" ? "a viewer" : `an ${row.invite.role}`}.</CardDescription>
        </CardHeader>
        <CardFooter>
          <form action={accept}>
            <Button type="submit">Accept invite</Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
