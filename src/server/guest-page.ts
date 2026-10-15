import "server-only";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { GUEST_PAGE_STYLES, guests, households, subEventInvites, subEvents, timelineItems, weddings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { todayIn } from "@/lib/datetime";
import { log, optDate, optEmail, optPhone, optText, UserError, type Ctx } from "./core";
import { withPlusOnesAfterHosts } from "./guests";
import { listPhotos } from "./photos";

// ============ Public: the household's guest page ============
//
// Everything here is reachable without signing in, by anyone holding the household's link.
// Only return what that household should see: never planner notes, other households,
// or events they aren't invited to.

const TOKEN_RE = /^[A-Za-z0-9_-]{10,64}$/;

export type GuestPageData = NonNullable<Awaited<ReturnType<typeof getGuestPage>>>;

export async function getGuestPage(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const [row] = await db
    .select({ household: households, wedding: weddings })
    .from(households)
    .innerJoin(weddings, eq(weddings.id, households.weddingId))
    .where(eq(households.inviteToken, token));
  if (!row) return null;
  const { household, wedding } = row;

  const guestRows = await db
    .select()
    .from(guests)
    .where(eq(guests.householdId, household.id))
    .orderBy(asc(guests.sortOrder), asc(guests.createdAt));
  const invites = guestRows.length
    ? await db
        .select()
        .from(subEventInvites)
        .where(inArray(subEventInvites.guestId, guestRows.map((g) => g.id)))
    : [];
  const eventIds = [...new Set(invites.map((i) => i.subEventId))];
  const [eventRows, timeline, photos] = await Promise.all([
    eventIds.length
      ? db
          .select()
          .from(subEvents)
          .where(inArray(subEvents.id, eventIds))
          .orderBy(asc(subEvents.startsAt), asc(subEvents.sortOrder))
      : Promise.resolve([]),
    db
      .select()
      .from(timelineItems)
      .where(
        and(
          eq(timelineItems.weddingId, wedding.id),
          eq(timelineItems.guestVisible, true),
          // General items, or items for events this household is invited to.
          eventIds.length
            ? or(isNull(timelineItems.subEventId), inArray(timelineItems.subEventId, eventIds))
            : isNull(timelineItems.subEventId),
        ),
      )
      .orderBy(asc(timelineItems.startsAt)),
    listPhotos(wedding.id),
  ]);

  const eventOrder = new Map(eventRows.map((e, i) => [e.id, i]));

  return {
    wedding: {
      name: wedding.name,
      partner1Name: wedding.partner1Name,
      partner2Name: wedding.partner2Name,
      date: wedding.date,
      timezone: wedding.timezone,
      venueName: wedding.venueName,
      venueAddress: wedding.venueAddress,
      welcomeMessage: wedding.welcomeMessage,
      travelInfo: wedding.travelInfo,
      accommodationInfo: wedding.accommodationInfo,
      dressCode: wedding.dressCode,
      faq: wedding.faq,
      registry: wedding.registry,
      guestPageStyle: wedding.guestPageStyle,
      contact: wedding.contactName
        ? { name: wedding.contactName, phone: wedding.contactPhone, email: wedding.contactEmail }
        : null,
      rsvpDeadline: wedding.rsvpDeadline,
      themePrimary: wedding.themePrimary,
      themeAccent: wedding.themeAccent,
      rsvpOpen: isRsvpOpen(wedding),
    },
    // Cover first.
    photos,
    household: {
      name: household.name,
      email: household.email,
      rsvpSubmittedAt: household.rsvpSubmittedAt,
      guestMessage: household.guestMessage,
      personalNote: household.personalNote,
    },
    guests: withPlusOnesAfterHosts(guestRows).map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      isPlusOne: g.isPlusOne,
      // First name of the guest bringing this plus-one.
      hostFirstName: g.plusOneOf ? (guestRows.find((h) => h.id === g.plusOneOf)?.firstName ?? null) : null,
      ageGroup: g.ageGroup,
      dietaryRestrictions: g.dietaryRestrictions,
      // In the same (chronological) order as the events.
      invites: invites
        .filter((i) => i.guestId === g.id)
        .sort((x, y) => eventOrder.get(x.subEventId)! - eventOrder.get(y.subEventId)!)
        .map((i) => ({ subEventId: i.subEventId, status: i.status, mealChoice: i.mealChoice })),
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      locationName: e.locationName,
      address: e.address,
      mapUrl: e.mapUrl,
      dressCode: e.dressCode,
      mealOptions: e.mealOptions,
    })),
    timeline: timeline.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      location: t.location,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
    })),
  };
}

function isRsvpOpen(wedding: { rsvpDeadline: string | null; date: string | null; timezone: string }) {
  const today = todayIn(wedding.timezone);
  if (wedding.rsvpDeadline) return today <= wedding.rsvpDeadline;
  // Without a deadline, RSVPs stay open until the wedding day.
  return !wedding.date || today <= wedding.date;
}

export const rsvpSubmission = z.object({
  guests: z
    .array(
      z.object({
        guestId: z.uuid(),
        firstName: optText(100),
        lastName: optText(100),
        dietaryRestrictions: optText(500),
        responses: z
          .array(
            z.object({
              subEventId: z.uuid(),
              status: z.enum(["attending", "declined"]),
              mealChoice: optText(100),
            }),
          )
          .max(50),
      }),
    )
    .min(1)
    .max(50),
  email: z
    .union([z.literal(""), z.email()])
    .nullish()
    .transform((v) => v || null),
  message: optText(2000),
});
export type RsvpSubmission = z.input<typeof rsvpSubmission>;

/** Saves a household's RSVP. Every guest and event must belong to the household behind `token`. */
export async function submitRsvp(token: string, raw: RsvpSubmission) {
  const input = rsvpSubmission.parse(raw);
  const page = await getGuestPage(token);
  if (!page) throw new UserError("This invitation link isn't valid.");
  if (!page.wedding.rsvpOpen) throw new UserError("RSVPs are closed. Please reach out to the couple directly.");

  const guestsById = new Map(page.guests.map((g) => [g.id, g]));
  const eventsById = new Map(page.events.map((e) => [e.id, e]));
  for (const g of input.guests) {
    const guest = guestsById.get(g.guestId);
    if (!guest) throw new UserError("Something doesn't match this invitation. Please reload the page.");
    for (const r of g.responses) {
      const event = eventsById.get(r.subEventId);
      if (!event || !guest.invites.some((i) => i.subEventId === r.subEventId)) {
        throw new UserError("Something doesn't match this invitation. Please reload the page.");
      }
      if (r.status === "attending" && event.mealOptions.length && !r.mealChoice) {
        throw new UserError(`Please choose a meal for ${guestLabel(guest, g)} at ${event.name}.`);
      }
      if (r.mealChoice && !event.mealOptions.includes(r.mealChoice)) {
        throw new UserError(`That meal option isn't available for ${event.name}.`);
      }
    }
    if (guest.isPlusOne && !guest.firstName && !g.firstName && g.responses.some((r) => r.status === "attending")) {
      throw new UserError("Please tell us your plus-one's name.");
    }
  }

  const [household] = await db
    .select({ id: households.id, weddingId: households.weddingId, name: households.name })
    .from(households)
    .where(eq(households.inviteToken, token));

  const now = new Date();
  let attending = 0;
  let declined = 0;
  await db.transaction(async (tx) => {
    for (const g of input.guests) {
      const guest = guestsById.get(g.guestId)!;
      const changes = Object.fromEntries(
        Object.entries({
          dietaryRestrictions: g.dietaryRestrictions,
          // Guests may only fill in names for their own unnamed plus-ones.
          ...(guest.isPlusOne ? { firstName: g.firstName, lastName: g.lastName } : {}),
        }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(changes).length) {
        await tx
          .update(guests)
          .set(changes)
          .where(and(eq(guests.id, g.guestId), eq(guests.householdId, household.id)));
      }
      for (const r of g.responses) {
        await tx
          .update(subEventInvites)
          .set({ status: r.status, mealChoice: r.status === "attending" ? r.mealChoice : null, respondedAt: now })
          .where(and(eq(subEventInvites.guestId, g.guestId), eq(subEventInvites.subEventId, r.subEventId)));
      }
      if (g.responses.some((r) => r.status === "attending")) attending++;
      else if (g.responses.length) declined++;
    }
    await tx
      .update(households)
      .set({ rsvpSubmittedAt: now, guestMessage: input.message, ...(input.email ? { email: input.email } : {}) })
      .where(eq(households.id, household.id));
    await logActivity(
      {
        weddingId: household.weddingId,
        actorUserId: null,
        action: "update",
        entityType: "rsvp",
        entityId: household.id,
        summary: `${household.name} RSVP'd: ${attending} coming, ${declined} can't make it`,
      },
      tx,
    );
  });
  return { attending, declined, weddingId: household.weddingId };
}

function guestLabel(guest: { firstName: string | null }, input: { firstName?: string | null }) {
  return guest.firstName ?? input.firstName ?? "your plus-one";
}

// ============ Planner: editing the guest page content ============

/** A registry link: web addresses only, with https:// added when it was left off ("amazon.com/wedding"). */
const registryLink = z.object({
  label: z.string().trim().min(1, "Give each registry a name").max(100),
  url: z.preprocess(
    (v) => (typeof v === "string" && v.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? `https://${v.trim()}` : v),
    z.url({ protocol: /^https?$/, message: "Registry links must be web addresses" }),
  ),
});

export const guestPageContentInput = z
  .object({
    welcomeMessage: optText(4000),
    travelInfo: optText(4000),
    accommodationInfo: optText(4000),
    dressCode: optText(500),
    rsvpDeadline: optDate,
    faq: z
      .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2000) }))
      .max(40)
      .optional(),
    registry: z.array(registryLink).max(10).optional(),
    guestPageStyle: z.enum(GUEST_PAGE_STYLES),
    contactName: optText(100),
    contactPhone: optPhone,
    contactEmail: optEmail,
  })
  .partial();
export type GuestPageContentInput = z.input<typeof guestPageContentInput>;

export async function getGuestPageContent(ctx: Ctx) {
  const [w] = await db
    .select({
      welcomeMessage: weddings.welcomeMessage,
      travelInfo: weddings.travelInfo,
      accommodationInfo: weddings.accommodationInfo,
      dressCode: weddings.dressCode,
      rsvpDeadline: weddings.rsvpDeadline,
      faq: weddings.faq,
      registry: weddings.registry,
      guestPageStyle: weddings.guestPageStyle,
      contactName: weddings.contactName,
      contactPhone: weddings.contactPhone,
      contactEmail: weddings.contactEmail,
    })
    .from(weddings)
    .where(eq(weddings.id, ctx.weddingId));
  return w;
}

export async function updateGuestPageContent(ctx: Ctx, raw: GuestPageContentInput) {
  const input = guestPageContentInput.parse(raw);
  await db.update(weddings).set(input).where(eq(weddings.id, ctx.weddingId));
  await log(ctx, "update", "wedding", "Updated the guest page", ctx.weddingId);
  return { updated: Object.keys(input) };
}
