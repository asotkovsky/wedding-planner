import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { households, user, weddingInvites, weddingMembers } from "@/db/schema";
import { canEdit, requireWeddingAccess } from "@/lib/access";
import { listPhotos } from "@/server/photos";
import { ColorsForm } from "./colors-form";
import { GuestPageForm } from "./guest-page-form";
import { PhotosForm } from "./photos-form";
import { InviteForm, InviteList, MemberList, WeddingDetailsForm } from "./forms";

export default async function SettingsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, role, user: me } = await requireWeddingAccess(weddingId);
  const isOwner = role === "owner";

  const [members, invites, photos] = await Promise.all([
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
    listPhotos(weddingId),
  ]);

  const [preview] = await db
    .select({ token: households.inviteToken })
    .from(households)
    .where(eq(households.weddingId, weddingId))
    .orderBy(asc(households.createdAt))
    .limit(1);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader section="settings" />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Wedding details</CardTitle>
        </CardHeader>
        <CardContent>
          <WeddingDetailsForm wedding={wedding} disabled={!canEdit(role)} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl" id="guest-page">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Guest page</CardTitle>
          <CardDescription>
            What every household sees on their personal invitation link, along with their events and RSVP form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuestPageForm
            weddingId={weddingId}
            content={{
              welcomeMessage: wedding.welcomeMessage,
              travelInfo: wedding.travelInfo,
              accommodationInfo: wedding.accommodationInfo,
              dressCode: wedding.dressCode,
              rsvpDeadline: wedding.rsvpDeadline,
              faq: wedding.faq,
              registry: wedding.registry,
            }}
            previewHref={preview ? `/i/${preview.token}` : null}
            disabled={!canEdit(role)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl" id="photos">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Photos</CardTitle>
          <CardDescription>Show guests a little of your story. The first photo is the cover of your guest page.</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotosForm weddingId={weddingId} photos={photos} editable={canEdit(role)} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Wedding colors</CardTitle>
          <CardDescription>Make the app yours. Pick a palette or your exact colors; everyone on your team sees them.</CardDescription>
        </CardHeader>
        <CardContent>
          <ColorsForm
            weddingId={weddingId}
            primary={wedding.themePrimary}
            accent={wedding.themeAccent}
            disabled={!canEdit(role)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Your planning crew</CardTitle>
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
