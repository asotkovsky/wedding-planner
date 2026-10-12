import { getGuestPage } from "@/server/guest-page";

// "Add to calendar": an iCalendar file with the events this household is invited to.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getGuestPage(token);
  if (!page) return new Response("Not found", { status: 404 });

  const stamp = icsDate(new Date());
  const events = page.events.filter((e) => e.startsAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//I Do Crew//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}@idocrew`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.startsAt!)}`,
      `DTEND:${icsDate(e.endsAt ?? new Date(e.startsAt!.getTime() + 2 * 3600_000))}`,
      fold(`SUMMARY:${escape(`${page.wedding.name}: ${e.name}`)}`),
      ...(e.address || e.locationName
        ? [fold(`LOCATION:${escape([e.locationName, e.address].filter(Boolean).join(", "))}`)]
        : []),
      ...(e.description ? [fold(`DESCRIPTION:${escape(e.description)}`)] : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(page.wedding.name)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds long lines (RFC 5545 §3.1). Counts characters, so non-ASCII lines may fold a little late; calendar apps accept that. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding";
}
