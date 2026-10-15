import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import { IconChip, Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { weddingInvites, weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { themeVars } from "@/lib/theme";

async function findInvite(token: string) {
  const [row] = await db
    .select({
      invite: weddingInvites,
      weddingName: weddings.name,
      themePrimary: weddings.themePrimary,
      themeAccent: weddings.themeAccent,
    })
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
    redirect(`/w/${invite.weddingId}?welcome=joined`);
  }

  return (
    <main
      style={themeVars(row.themePrimary, row.themeAccent)}
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-soft p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />
      <Link href="/weddings" className="relative">
        <Logo />
      </Link>
      <div className="relative w-full max-w-md space-y-5 rounded-3xl bg-background p-8 text-center sticker">
        <IconChip icon={UsersRound} tone="brand" size="lg" sticker className="mx-auto -rotate-6" />
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">You&apos;re invited</p>
          <h1 className="text-3xl font-extrabold">Join {row.weddingName}&apos;s planning crew</h1>
          <p className="text-muted-foreground">
            {row.invite.role === "viewer"
              ? "You'll be able to see the guest list, vendors, budget and timeline."
              : "You'll be able to help with the guest list, vendors, budget and timeline."}
          </p>
        </div>
        <form action={accept}>
          <Button type="submit" className="h-11 w-full text-base">
            Join the crew 🥂
          </Button>
        </form>
      </div>
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
