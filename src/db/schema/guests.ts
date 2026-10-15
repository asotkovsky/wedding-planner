import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  uniqueIndex,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { weddings } from "./weddings";

export const guestSide = pgEnum("guest_side", ["partner1", "partner2", "both"]);
export const ageGroup = pgEnum("age_group", ["adult", "child", "infant"]);
export const rsvpStatus = pgEnum("rsvp_status", ["pending", "attending", "declined"]);
export type RsvpStatus = (typeof rsvpStatus.enumValues)[number];

// A party that receives one invitation and one guest-page link.
export const households = pgTable(
  "households",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    inviteToken: text("invite_token").notNull().unique(),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    notes: text("notes"),
    // A note from the couple shown on this household's guest page.
    personalNote: text("personal_note"),
    rsvpSubmittedAt: timestamp("rsvp_submitted_at", { withTimezone: true }),
    // Free-text note the household left for the couple with their RSVP.
    guestMessage: text("guest_message"),
    ...timestamps(),
  },
  (t) => [index("households_wedding_idx").on(t.weddingId)],
);

export const guests = pgTable(
  "guests",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Null for an unnamed plus-one; the guest can fill it in when they RSVP.
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    side: guestSide("side"),
    ageGroup: ageGroup("age_group").notNull().default("adult"),
    isPlusOne: boolean("is_plus_one").notNull().default(false),
    // For a plus-one: the guest bringing them (they name their +1 when they RSVP).
    plusOneOf: uuid("plus_one_of").references((): AnyPgColumn => guests.id, { onDelete: "cascade" }),
    dietaryRestrictions: text("dietary_restrictions"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("guests_wedding_idx").on(t.weddingId),
    index("guests_household_idx").on(t.householdId),
    // One plus-one per guest.
    uniqueIndex("guests_plus_one_of_uq").on(t.plusOneOf),
  ],
);

// Ceremony, reception, rehearsal dinner, brunch, ...
export const subEvents = pgTable(
  "sub_events",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    locationName: text("location_name"),
    address: text("address"),
    mapUrl: text("map_url"),
    dressCode: text("dress_code"),
    mealOptions: jsonb("meal_options").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("sub_events_wedding_idx").on(t.weddingId)],
);

// Which guests are invited to which sub-event, and their RSVP for it.
export const subEventInvites = pgTable(
  "sub_event_invites",
  {
    subEventId: uuid("sub_event_id")
      .notNull()
      .references(() => subEvents.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    status: rsvpStatus("status").notNull().default("pending"),
    mealChoice: text("meal_choice"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.subEventId, t.guestId] }),
    index("sub_event_invites_guest_idx").on(t.guestId),
    index("sub_event_invites_wedding_idx").on(t.weddingId),
  ],
);
