import { canEdit } from "@/lib/access";
import { formatDateTime, formatTime, utcToLocal } from "@/lib/datetime";
import { getCtx } from "@/server/action";
import { getMealSummary, listSubEvents } from "@/server/events";
import { EventsView } from "./events-view";

export default async function EventsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [events, meals] = await Promise.all([listSubEvents(ctx), getMealSummary(ctx)]);
  const tz = wedding.timezone;

  return (
    <EventsView
      weddingId={weddingId}
      editable={canEdit(role)}
      defaultDate={wedding.date}
      events={events.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        locationName: e.locationName,
        address: e.address,
        mapUrl: e.mapUrl,
        dressCode: e.dressCode,
        mealOptions: e.mealOptions,
        startsAtLocal: e.startsAt ? utcToLocal(e.startsAt, tz) : "",
        endsAtLocal: e.endsAt ? utcToLocal(e.endsAt, tz) : "",
        when: e.startsAt
          ? `${formatDateTime(e.startsAt, tz)}${e.endsAt ? ` – ${formatTime(e.endsAt, tz)}` : ""}`
          : "Time not set",
        invited: e.invited,
        attending: e.attending,
        declined: e.declined,
        meals: meals.get(e.id) ?? { meals: [], unchosen: 0, dietary: [] },
      }))}
    />
  );
}
