import "server-only";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { guests, subEventInvites, subEvents } from "@/db/schema";
import { localToUtc } from "@/lib/datetime";
import { log, optLocalDateTime, optText, optUrl, UserError, type Ctx } from "./core";

const subEventFields = {
  name: z.string().trim().min(1).max(200),
  description: optText(),
  startsAt: optLocalDateTime,
  endsAt: optLocalDateTime,
  locationName: optText(200),
  address: optText(500),
  mapUrl: optUrl,
  dressCode: optText(200),
  mealOptions: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  sortOrder: z.number().int().optional(),
};

export const subEventCreateInput = z.object({
  ...subEventFields,
  /** Invite every current guest. */
  inviteAllGuests: z.boolean().default(false),
});
export const subEventUpdateInput = z.object(subEventFields).partial();

export type SubEventCreateInput = z.input<typeof subEventCreateInput>;
export type SubEventUpdateInput = z.input<typeof subEventUpdateInput>;
export type SubEventWithCounts = Awaited<ReturnType<typeof listSubEvents>>[number];

export async function listSubEvents(ctx: Ctx) {
  return db
    .select({
      ...getTableColumns(subEvents),
      invited: sql<number>`count(${subEventInvites.guestId})::int`,
      attending: sql<number>`count(*) filter (where ${subEventInvites.status} = 'attending')::int`,
      declined: sql<number>`count(*) filter (where ${subEventInvites.status} = 'declined')::int`,
    })
    .from(subEvents)
    .leftJoin(subEventInvites, eq(subEventInvites.subEventId, subEvents.id))
    .where(eq(subEvents.weddingId, ctx.weddingId))
    .groupBy(subEvents.id)
    .orderBy(asc(subEvents.sortOrder), asc(subEvents.startsAt));
}


export async function createSubEvent(ctx: Ctx, raw: SubEventCreateInput) {
  const { inviteAllGuests, ...input } = subEventCreateInput.parse(raw);
  const times = toUtc(ctx, input);
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(subEvents)
      .values({ ...input, ...times, weddingId: ctx.weddingId })
      .returning();
    let invited = 0;
    if (inviteAllGuests) invited = await inviteAll(ctx, event.id, tx);
    await log(ctx, "create", "sub_event", `Created event ${event.name}`, event.id, tx);
    return { subEventId: event.id, name: event.name, invited };
  });
}

export async function updateSubEvent(ctx: Ctx, subEventId: string, raw: SubEventUpdateInput) {
  const input = subEventUpdateInput.parse(raw);
  return db.transaction(async (tx) => {
    const [event] = await tx
      .update(subEvents)
      .set({ ...input, ...toUtc(ctx, input) })
      .where(and(eq(subEvents.id, subEventId), eq(subEvents.weddingId, ctx.weddingId)))
      .returning();
    if (!event) throw new UserError("Event not found");
    // Re-check against stored values in case only one end of the range changed (rolls back).
    if (event.startsAt && event.endsAt && event.endsAt < event.startsAt) {
      throw new UserError("End time is before start time");
    }
    await log(ctx, "update", "sub_event", `Updated event ${event.name}`, subEventId, tx);
    return { name: event.name };
  });
}

export async function deleteSubEvent(ctx: Ctx, subEventId: string) {
  const [event] = await db
    .delete(subEvents)
    .where(and(eq(subEvents.id, subEventId), eq(subEvents.weddingId, ctx.weddingId)))
    .returning({ name: subEvents.name });
  if (!event) throw new UserError("Event not found");
  await log(ctx, "delete", "sub_event", `Deleted event ${event.name}`, subEventId);
  return event;
}

export async function inviteAllGuests(ctx: Ctx, subEventId: string) {
  const [event] = await db
    .select({ name: subEvents.name })
    .from(subEvents)
    .where(and(eq(subEvents.id, subEventId), eq(subEvents.weddingId, ctx.weddingId)));
  if (!event) throw new UserError("Event not found");
  const invited = await inviteAll(ctx, subEventId);
  await log(ctx, "update", "invitation", `Invited all guests to ${event.name}`, subEventId);
  return { name: event.name, newlyInvited: invited };
}

async function inviteAll(ctx: Ctx, subEventId: string, tx: Pick<typeof db, "select" | "insert"> = db) {
  const all = await tx.select({ id: guests.id }).from(guests).where(eq(guests.weddingId, ctx.weddingId));
  if (!all.length) return 0;
  const rows = await tx
    .insert(subEventInvites)
    .values(all.map((g) => ({ subEventId, guestId: g.id, weddingId: ctx.weddingId })))
    .onConflictDoNothing()
    .returning({ guestId: subEventInvites.guestId });
  return rows.length;
}

function toUtc(ctx: Ctx, input: { startsAt?: string | null; endsAt?: string | null }) {
  const conv = (v: string | null | undefined) => (v == null ? v : localToUtc(v, ctx.timezone));
  const startsAt = conv(input.startsAt);
  const endsAt = conv(input.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) throw new UserError("End time is before start time");
  return { startsAt, endsAt };
}

/**
 * Per event: meal choices of guests who are attending (plus how many haven't chosen), and the
 * dietary needs of attending guests. What the caterer will ask for.
 */
export async function getMealSummary(ctx: Ctx) {
  const rows = await db
    .select({
      subEventId: subEventInvites.subEventId,
      mealChoice: subEventInvites.mealChoice,
      firstName: guests.firstName,
      lastName: guests.lastName,
      dietary: guests.dietaryRestrictions,
    })
    .from(subEventInvites)
    .innerJoin(guests, eq(guests.id, subEventInvites.guestId))
    .where(and(eq(subEventInvites.weddingId, ctx.weddingId), eq(subEventInvites.status, "attending")));

  const byEvent = new Map<
    string,
    { meals: Map<string, number>; unchosen: number; dietary: { name: string; needs: string }[] }
  >();
  for (const r of rows) {
    const e = byEvent.get(r.subEventId) ?? { meals: new Map<string, number>(), unchosen: 0, dietary: [] as MealSummary["dietary"] };
    if (r.mealChoice) e.meals.set(r.mealChoice, (e.meals.get(r.mealChoice) ?? 0) + 1);
    else e.unchosen++;
    if (r.dietary?.trim()) {
      e.dietary.push({ name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Plus-one", needs: r.dietary.trim() });
    }
    byEvent.set(r.subEventId, e);
  }
  return new Map(
    [...byEvent].map(([id, e]) => [
      id,
      {
        meals: [...e.meals].map(([meal, count]) => ({ meal, count })).sort((a, b) => b.count - a.count),
        unchosen: e.unchosen,
        dietary: e.dietary.sort((a, b) => a.name.localeCompare(b.name)),
      },
    ]),
  );
}

export type MealSummary = { meals: { meal: string; count: number }[]; unchosen: number; dietary: { name: string; needs: string }[] };
