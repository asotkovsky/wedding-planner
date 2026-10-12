import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { ageGroup, guestSide, guests, households, rsvpStatus, subEventInvites, subEvents } from "@/db/schema";
import { assertOwned, log, optEmail, optText, UserError, type Ctx } from "./core";

// ---------- Schemas ----------

const guestFields = {
  firstName: optText(100),
  lastName: optText(100),
  email: optEmail,
  phone: optText(50),
  side: z
    .union([z.literal(""), z.enum(guestSide.enumValues)])
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  ageGroup: z.enum(ageGroup.enumValues).optional(),
  dietaryRestrictions: optText(500),
  notes: optText(),
};

/** Whether this guest brings an unnamed +1, who's added as their own guest row and named at RSVP time. */
const bringsPlusOne = z.boolean().optional();

export const guestInput = z.object({ ...guestFields, bringsPlusOne });
export const guestUpdateInput = z.object({ ...guestFields, bringsPlusOne }).partial();

const householdFields = {
  name: optText(200),
  email: optEmail,
  phone: optText(50),
  addressLine1: optText(200),
  addressLine2: optText(200),
  city: optText(100),
  region: optText(100),
  postalCode: optText(20),
  country: optText(100),
  notes: optText(),
};

export const householdCreateInput = z.object({
  ...householdFields,
  guests: z.array(guestInput).min(1, "A household needs at least one guest"),
  /** Sub-events every guest in the household is invited to. */
  subEventIds: z.array(z.uuid()).default([]),
});
export const householdUpdateInput = z.object(householdFields).partial();

export const addGuestInput = guestInput.extend({
  householdId: z.uuid(),
  /** Defaults to the events the rest of the household is invited to. */
  subEventIds: z.array(z.uuid()).optional(),
});

export const invitationInput = z.object({
  subEventId: z.uuid(),
  guestIds: z.array(z.uuid()).min(1),
  invited: z.boolean(),
});

export const rsvpInput = z.object({
  guestId: z.uuid(),
  subEventId: z.uuid(),
  status: z.enum(rsvpStatus.enumValues),
  mealChoice: optText(100),
});

export type HouseholdCreateInput = z.input<typeof householdCreateInput>;
export type HouseholdUpdateInput = z.input<typeof householdUpdateInput>;
export type GuestInput = z.input<typeof guestInput>;
export type GuestUpdateInput = z.input<typeof guestUpdateInput>;
export type AddGuestInput = z.input<typeof addGuestInput>;
export type InvitationInput = z.input<typeof invitationInput>;
export type RsvpInput = z.input<typeof rsvpInput>;

// ---------- Queries ----------

export type HouseholdWithGuests = Awaited<ReturnType<typeof listHouseholds>>[number];

export async function listHouseholds(ctx: Ctx) {
  const [hh, gs, inv] = await Promise.all([
    db.select().from(households).where(eq(households.weddingId, ctx.weddingId)).orderBy(asc(households.name)),
    db
      .select()
      .from(guests)
      .where(eq(guests.weddingId, ctx.weddingId))
      .orderBy(asc(guests.sortOrder), asc(guests.createdAt)),
    db.select().from(subEventInvites).where(eq(subEventInvites.weddingId, ctx.weddingId)),
  ]);

  const invitesByGuest = Map.groupBy(inv, (i) => i.guestId);
  const guestsByHousehold = Map.groupBy(
    gs.map((g) => ({ ...g, invites: invitesByGuest.get(g.id) ?? [] })),
    (g) => g.householdId,
  );
  return hh.map((h) => ({ ...h, guests: withPlusOnesAfterHosts(guestsByHousehold.get(h.id) ?? []) }));
}

/** Orders guests so each plus-one comes right after the guest bringing them. */
export function withPlusOnesAfterHosts<T extends { id: string; plusOneOf: string | null }>(list: T[]): T[] {
  const plusOnes = new Map(list.filter((g) => g.plusOneOf).map((g) => [g.plusOneOf!, g]));
  const ordered: T[] = [];
  for (const g of list) {
    if (g.plusOneOf && list.some((h) => h.id === g.plusOneOf)) continue;
    ordered.push(g);
    const p = plusOnes.get(g.id);
    if (p) ordered.push(p);
  }
  return ordered;
}

export function guestDisplayName(g: { firstName: string | null; lastName: string | null; isPlusOne: boolean }) {
  const name = [g.firstName, g.lastName].filter(Boolean).join(" ");
  return name || (g.isPlusOne ? "Plus-one" : "Unnamed guest");
}

// ---------- Mutations ----------

export async function createHousehold(ctx: Ctx, raw: HouseholdCreateInput) {
  const { guests: guestList, subEventIds, ...fields } = householdCreateInput.parse(raw);
  for (const g of guestList) requireName(g);
  await assertSubEvents(ctx, subEventIds);

  const name = fields.name ?? deriveHouseholdName(guestList);
  return db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ ...fields, name, weddingId: ctx.weddingId, inviteToken: nanoid(16) })
      .returning();
    const inserted = await tx
      .insert(guests)
      .values(
        guestList.map((g, i) => ({
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          phone: g.phone,
          side: g.side,
          dietaryRestrictions: g.dietaryRestrictions,
          notes: g.notes,
          ageGroup: g.ageGroup ?? "adult",
          weddingId: ctx.weddingId,
          householdId: household.id,
          sortOrder: i,
        })),
      )
      .returning({ id: guests.id, side: guests.side });
    const plusOnes = guestList.some((g) => g.bringsPlusOne)
      ? await tx
          .insert(guests)
          .values(
            inserted
              .filter((_, i) => guestList[i].bringsPlusOne)
              .map((host) => ({
                weddingId: ctx.weddingId,
                householdId: household.id,
                isPlusOne: true,
                plusOneOf: host.id,
                side: host.side,
                sortOrder: 100,
              })),
          )
          .returning({ id: guests.id })
      : [];
    const allIds = [...inserted, ...plusOnes].map((g) => g.id);
    if (subEventIds.length) {
      await tx
        .insert(subEventInvites)
        .values(allIds.flatMap((guestId) => subEventIds.map((subEventId) => ({ subEventId, guestId, weddingId: ctx.weddingId }))));
    }
    const count = `${guestList.length} guest${guestList.length === 1 ? "" : "s"}${plusOnes.length ? ` + ${plusOnes.length} unnamed +1` : ""}`;
    await log(ctx, "create", "household", `Added household ${name} (${count})`, household.id, tx);
    return { householdId: household.id, name, guestIds: inserted.map((g) => g.id), plusOneIds: plusOnes.map((g) => g.id) };
  });
}

export async function updateHousehold(ctx: Ctx, householdId: string, raw: HouseholdUpdateInput) {
  const input = householdUpdateInput.parse(raw);
  if (input.name === null) throw new UserError("Household name can't be empty");
  const [row] = await db
    .update(households)
    .set({ ...input, name: input.name ?? undefined })
    .where(and(eq(households.id, householdId), eq(households.weddingId, ctx.weddingId)))
    .returning({ name: households.name });
  if (!row) throw new UserError("Household not found");
  await log(ctx, "update", "household", `Updated household ${row.name}`, householdId);
  return row;
}

export async function deleteHousehold(ctx: Ctx, householdId: string) {
  const [row] = await db
    .delete(households)
    .where(and(eq(households.id, householdId), eq(households.weddingId, ctx.weddingId)))
    .returning({ name: households.name });
  if (!row) throw new UserError("Household not found");
  await log(ctx, "delete", "household", `Deleted household ${row.name}`, householdId);
  return row;
}

/** Issues a new guest-page link, invalidating the old one. */
export async function regenerateInviteToken(ctx: Ctx, householdId: string) {
  const [row] = await db
    .update(households)
    .set({ inviteToken: nanoid(16) })
    .where(and(eq(households.id, householdId), eq(households.weddingId, ctx.weddingId)))
    .returning({ name: households.name });
  if (!row) throw new UserError("Household not found");
  await log(ctx, "update", "household", `Reset guest page link for ${row.name}`, householdId);
}

export async function addGuest(ctx: Ctx, raw: AddGuestInput) {
  const { householdId, subEventIds, bringsPlusOne: withPlusOne, ...fields } = addGuestInput.parse(raw);
  requireName(fields);
  await assertOwned(ctx, households, householdId, "Household");
  if (subEventIds) await assertSubEvents(ctx, subEventIds);

  return db.transaction(async (tx) => {
    const eventIds =
      subEventIds ??
      (
        await tx
          .selectDistinct({ id: subEventInvites.subEventId })
          .from(subEventInvites)
          .innerJoin(guests, eq(guests.id, subEventInvites.guestId))
          .where(eq(guests.householdId, householdId))
      ).map((r) => r.id);
    const [guest] = await tx
      .insert(guests)
      .values({
        ...fields,
        ageGroup: fields.ageGroup ?? "adult",
        weddingId: ctx.weddingId,
        householdId,
        sortOrder: 100,
      })
      .returning();
    if (eventIds.length) {
      await tx
        .insert(subEventInvites)
        .values(eventIds.map((subEventId) => ({ subEventId, guestId: guest.id, weddingId: ctx.weddingId })));
    }
    if (withPlusOne) await setPlusOneTx(ctx, guest.id, true, tx);
    await log(ctx, "create", "guest", `Added guest ${guestDisplayName(guest)}${withPlusOne ? " with a +1" : ""}`, guest.id, tx);
    return { guestId: guest.id, name: guestDisplayName(guest), invitedTo: eventIds };
  });
}

/**
 * Gives a guest an unnamed +1 (a separate guest they name when they RSVP), or removes it.
 * The +1 is invited to the same events as the guest bringing them.
 */
export async function setPlusOne(ctx: Ctx, guestId: string, on: boolean) {
  return db.transaction(async (tx) => {
    const result = await setPlusOneTx(ctx, guestId, on, tx);
    await log(ctx, on ? "create" : "delete", "guest", `${on ? "Added" : "Removed"} a +1 for ${result.host}`, guestId, tx);
    return result;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function setPlusOneTx(ctx: Ctx, hostId: string, on: boolean, tx: Tx) {
  const [host] = await tx
    .select()
    .from(guests)
    .where(and(eq(guests.id, hostId), eq(guests.weddingId, ctx.weddingId)));
  if (!host) throw new UserError("Guest not found");
  if (host.isPlusOne) throw new UserError("A plus-one can't bring their own plus-one");
  const [existing] = await tx.select({ id: guests.id }).from(guests).where(eq(guests.plusOneOf, hostId));
  const hostName = guestDisplayName(host);

  if (!on) {
    if (existing) await tx.delete(guests).where(eq(guests.id, existing.id));
    return { host: hostName, plusOneId: null };
  }
  if (existing) return { host: hostName, plusOneId: existing.id };

  const [plusOne] = await tx
    .insert(guests)
    .values({
      weddingId: ctx.weddingId,
      householdId: host.householdId,
      isPlusOne: true,
      plusOneOf: host.id,
      side: host.side,
      sortOrder: host.sortOrder,
    })
    .returning({ id: guests.id });
  const hostInvites = await tx
    .select({ subEventId: subEventInvites.subEventId })
    .from(subEventInvites)
    .where(eq(subEventInvites.guestId, host.id));
  if (hostInvites.length) {
    await tx
      .insert(subEventInvites)
      .values(hostInvites.map((i) => ({ subEventId: i.subEventId, guestId: plusOne.id, weddingId: ctx.weddingId })));
  }
  return { host: hostName, plusOneId: plusOne.id };
}

export async function updateGuest(ctx: Ctx, guestId: string, raw: GuestUpdateInput) {
  const { bringsPlusOne: withPlusOne, ...input } = guestUpdateInput.parse(raw);
  return db.transaction(async (tx) => {
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const [guest] = Object.keys(changes).length
      ? await tx
          .update(guests)
          .set(changes)
          .where(and(eq(guests.id, guestId), eq(guests.weddingId, ctx.weddingId)))
          .returning()
      : await tx.select().from(guests).where(and(eq(guests.id, guestId), eq(guests.weddingId, ctx.weddingId)));
    if (!guest) throw new UserError("Guest not found");
    if (withPlusOne !== undefined) await setPlusOneTx(ctx, guestId, withPlusOne, tx);
    await log(ctx, "update", "guest", `Updated guest ${guestDisplayName(guest)}`, guestId, tx);
    return { name: guestDisplayName(guest) };
  });
}

/** Deletes a guest; deletes the household too if it becomes empty. */
export async function deleteGuest(ctx: Ctx, guestId: string) {
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .delete(guests)
      .where(and(eq(guests.id, guestId), eq(guests.weddingId, ctx.weddingId)))
      .returning();
    if (!guest) throw new UserError("Guest not found");
    const remaining = await tx.select({ id: guests.id }).from(guests).where(eq(guests.householdId, guest.householdId));
    if (!remaining.length) await tx.delete(households).where(eq(households.id, guest.householdId));
    await log(ctx, "delete", "guest", `Removed guest ${guestDisplayName(guest)}`, guestId, tx);
    return { name: guestDisplayName(guest), householdDeleted: !remaining.length };
  });
}

/** Invite or uninvite guests to a sub-event. Uninviting discards their RSVP for it. */
export async function setInvitations(ctx: Ctx, raw: InvitationInput) {
  const { subEventId, guestIds, invited } = invitationInput.parse(raw);
  await assertOwned(ctx, subEvents, subEventId, "Event");
  const owned = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.weddingId, ctx.weddingId), inArray(guests.id, guestIds)));
  if (owned.length !== guestIds.length) throw new UserError("Some guests were not found");

  if (invited) {
    await db
      .insert(subEventInvites)
      .values(guestIds.map((guestId) => ({ subEventId, guestId, weddingId: ctx.weddingId })))
      .onConflictDoNothing();
  } else {
    await db
      .delete(subEventInvites)
      .where(and(eq(subEventInvites.subEventId, subEventId), inArray(subEventInvites.guestId, guestIds)));
  }
  await log(ctx, "update", "invitation", `${invited ? "Invited" : "Uninvited"} ${guestIds.length} guest(s)`, subEventId);
  return { count: guestIds.length };
}

export async function setRsvp(ctx: Ctx, raw: RsvpInput) {
  const { guestId, subEventId, status, mealChoice } = rsvpInput.parse(raw);
  const [event] = await db
    .select({ name: subEvents.name, mealOptions: subEvents.mealOptions })
    .from(subEvents)
    .where(and(eq(subEvents.id, subEventId), eq(subEvents.weddingId, ctx.weddingId)));
  if (!event) throw new UserError("Event not found");
  if (mealChoice && event.mealOptions.length && !event.mealOptions.includes(mealChoice)) {
    throw new UserError(`Meal choice must be one of: ${event.mealOptions.join(", ")}`);
  }

  const [row] = await db
    .update(subEventInvites)
    .set({
      status,
      mealChoice: status === "attending" ? mealChoice : null,
      respondedAt: status === "pending" ? null : new Date(),
    })
    .where(
      and(
        eq(subEventInvites.guestId, guestId),
        eq(subEventInvites.subEventId, subEventId),
        eq(subEventInvites.weddingId, ctx.weddingId),
      ),
    )
    .returning();
  if (!row) throw new UserError(`That guest isn't invited to ${event.name}`);
  await log(ctx, "update", "rsvp", `Set RSVP to ${status} for ${event.name}`, guestId);
  return { event: event.name, status };
}

// ---------- Helpers ----------

function requireName(g: { firstName?: string | null }) {
  if (!g.firstName) throw new UserError("Guests need a first name. For an unnamed +1, use bringsPlusOne on the guest bringing them.");
}

async function assertSubEvents(ctx: Ctx, ids: string[]) {
  if (!ids.length) return;
  const rows = await db
    .select({ id: subEvents.id })
    .from(subEvents)
    .where(and(eq(subEvents.weddingId, ctx.weddingId), inArray(subEvents.id, ids)));
  if (rows.length !== new Set(ids).size) throw new UserError("Some events were not found");
}

function deriveHouseholdName(list: { firstName?: string | null; lastName?: string | null }[]) {
  const named = list.filter((g) => g.firstName);
  if (!named.length) return "Unnamed household";
  if (named.length === 1) return [named[0].firstName, named[0].lastName].filter(Boolean).join(" ");
  const lastNames = new Set(named.map((g) => g.lastName).filter(Boolean));
  if (lastNames.size === 1) {
    const [last] = lastNames;
    return named.length === 2 ? `${named[0].firstName} & ${named[1].firstName} ${last}` : `The ${last} Family`;
  }
  return named
    .slice(0, 2)
    .map((g) => [g.firstName, g.lastName].filter(Boolean).join(" "))
    .join(" & ");
}
