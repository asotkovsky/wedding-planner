import { canEdit } from "@/lib/access";
import { formatDay, formatTime, utcToLocal } from "@/lib/datetime";
import { getCtx } from "@/server/action";
import { listPickers, listTimeline } from "@/server/planning";
import { TimelineView } from "./timeline-view";

export default async function TimelinePage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [items, pickers] = await Promise.all([listTimeline(ctx), listPickers(ctx)]);
  const tz = wedding.timezone;

  return (
    <TimelineView
      weddingId={weddingId}
      editable={canEdit(role)}
      defaultDate={wedding.date}
      timezone={tz}
      events={pickers.events}
      vendors={pickers.vendors}
      items={items.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        location: i.location,
        subEventId: i.subEventId,
        vendorId: i.vendorId,
        guestVisible: i.guestVisible,
        startsAtLocal: utcToLocal(i.startsAt, tz),
        endsAtLocal: i.endsAt ? utcToLocal(i.endsAt, tz) : "",
        day: formatDay(i.startsAt, tz),
        time: `${formatTime(i.startsAt, tz)}${i.endsAt ? ` – ${formatTime(i.endsAt, tz)}` : ""}`,
      }))}
    />
  );
}
