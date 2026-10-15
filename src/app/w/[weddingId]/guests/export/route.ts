import { getCtx } from "@/server/action";
import { listSubEvents } from "@/server/events";
import { guestDisplayName, listHouseholds } from "@/server/guests";

const STATUS_LABEL = { pending: "Waiting", attending: "Coming", declined: "Can't make it" } as const;

/** The whole guest list as a CSV, one row per guest with their reply and meal for each event. */
export async function GET(_req: Request, { params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding } = await getCtx(weddingId);
  const [households, events] = await Promise.all([listHouseholds(ctx), listSubEvents(ctx)]);
  const sideLabel = { partner1: wedding.partner1Name, partner2: wedding.partner2Name, both: "Both" } as const;

  const rows: string[][] = [
    [
      "Household",
      "First name",
      "Last name",
      "Plus-one of",
      "Side",
      "Age group",
      "Email",
      "Phone",
      "Dietary needs",
      ...events.flatMap((e) => [`${e.name} RSVP`, `${e.name} meal`]),
    ],
  ];
  for (const h of households) {
    for (const g of h.guests) {
      const host = g.plusOneOf ? h.guests.find((x) => x.id === g.plusOneOf) : undefined;
      rows.push([
        h.name,
        g.firstName ?? "",
        g.lastName ?? "",
        host ? guestDisplayName(host) : "",
        g.side ? sideLabel[g.side] : "",
        g.ageGroup,
        g.email ?? h.email ?? "",
        g.phone ?? h.phone ?? "",
        g.dietaryRestrictions ?? "",
        ...events.flatMap((e) => {
          const invite = g.invites.find((i) => i.subEventId === e.id);
          return invite ? [STATUS_LABEL[invite.status], invite.mealChoice ?? ""] : ["Not invited", ""];
        }),
      ]);
    }
  }

  // The BOM makes Excel read the file as UTF-8 (names with accents, emoji).
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const filename = `${
    wedding.name
      .replace(/&/g, "and")
      .replace(/[^\w\- ]+/g, "")
      .replace(/\s+/g, " ")
      .trim() || "wedding"
  } guest list.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: string) {
  // Quote when needed, and defuse leading = + - @ so spreadsheets don't treat a name as a formula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
