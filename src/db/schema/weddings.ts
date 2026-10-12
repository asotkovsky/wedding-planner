import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";

export const memberRole = pgEnum("member_role", ["owner", "editor", "viewer"]);
export type MemberRole = (typeof memberRole.enumValues)[number];

export type FaqItem = { question: string; answer: string };

// The tenant. Every other domain table carries a wedding_id.
export const weddings = pgTable("weddings", {
  id: id(),
  name: text("name").notNull(),
  partner1Name: text("partner1_name").notNull(),
  partner2Name: text("partner2_name").notNull(),
  date: date("date"),
  timezone: text("timezone").notNull().default("America/New_York"),
  currency: text("currency").notNull().default("USD"),
  totalBudgetCents: integer("total_budget_cents"),
  // Guest-facing page content
  venueName: text("venue_name"),
  venueAddress: text("venue_address"),
  welcomeMessage: text("welcome_message"),
  travelInfo: text("travel_info"),
  accommodationInfo: text("accommodation_info"),
  dressCode: text("dress_code"),
  faq: jsonb("faq").$type<FaqItem[]>().notNull().default([]),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  ...timestamps(),
});

export const weddingMembers = pgTable(
  "wedding_members",
  {
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.weddingId, t.userId] }), index("wedding_members_user_idx").on(t.userId)],
);

// Collaborator invites (planner, partner, parent). Accepted via /invite/[token].
export const weddingInvites = pgTable(
  "wedding_invites",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wedding_invites_wedding_idx").on(t.weddingId)],
);
