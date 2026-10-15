import { formatDay } from "@/lib/datetime";
import { daysUntil } from "@/lib/format";
import type { getGuestPage } from "@/server/guest-page";

type GuestPageData = NonNullable<Awaited<ReturnType<typeof getGuestPage>>>;

/** What both guest page styles render: the page data plus the bits derived from it. */
export function buildGuestView(page: GuestPageData, token: string) {
  const { wedding, household, timeline, photos } = page;
  const [cover, ...gallery] = photos;
  const firstNames = page.guests.map((g) => g.firstName).filter(Boolean) as string[];
  const tz = wedding.timezone;
  return {
    ...page,
    token,
    tz,
    cover,
    gallery,
    photoSrc: (id: string) => `/i/${token}/photos/${id}`,
    days: wedding.date ? daysUntil(wedding.date) : null,
    greeting: firstNames.length ? listNames(firstNames) : household.name,
    scheduleDays: Map.groupBy(timeline, (t) => formatDay(t.startsAt, tz)),
    sections: [
      page.events.length && { id: "events", label: "Events" },
      timeline.length && { id: "schedule", label: "Schedule" },
      gallery.length && { id: "photos", label: "Photos" },
      (wedding.travelInfo || wedding.accommodationInfo) && { id: "travel", label: "Travel & stay" },
      wedding.registry.length && { id: "registry", label: "Registry" },
      wedding.faq.length && { id: "faq", label: "FAQ" },
      { id: "rsvp", label: "RSVP" },
    ].filter(Boolean) as { id: string; label: string }[],
    googleCalendarUrl: (e: GuestPageData["events"][number]) => googleCalendarUrl(wedding.name, e, tz),
    mapUrl: (e: GuestPageData["events"][number]) =>
      e.mapUrl ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.locationName, e.address].filter(Boolean).join(", "))}`,
  };
}

export type GuestView = ReturnType<typeof buildGuestView>;

/** A "create event" link for Google Calendar, prefilled with the event's time and place. */
function googleCalendarUrl(
  weddingName: string,
  e: {
    name: string;
    startsAt: Date | null;
    endsAt: Date | null;
    locationName: string | null;
    address: string | null;
    description: string | null;
  },
  timezone: string,
) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = e.startsAt!;
  const end = e.endsAt ?? new Date(start.getTime() + 2 * 3600_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${weddingName}: ${e.name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    ctz: timezone,
    location: [e.locationName, e.address].filter(Boolean).join(", "),
    details: e.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function listNames(names: string[]) {
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
