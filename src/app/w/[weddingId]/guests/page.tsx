import { headers } from "next/headers";
import { canEdit } from "@/lib/access";
import { getCtx } from "@/server/action";
import { listSubEvents } from "@/server/events";
import { listHouseholds } from "@/server/guests";
import { GuestsView } from "./guests-view";

// Reading a long guest list with AI (an import) can take a minute or two.
export const maxDuration = 300;

export default async function GuestsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [households, events] = await Promise.all([listHouseholds(ctx), listSubEvents(ctx)]);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <GuestsView
      weddingId={weddingId}
      households={households}
      events={events.map((e) => ({ id: e.id, name: e.name, mealOptions: e.mealOptions }))}
      partnerNames={[wedding.partner1Name, wedding.partner2Name]}
      guestPageBase={`${origin}/i/`}
      editable={canEdit(role)}
    />
  );
}
