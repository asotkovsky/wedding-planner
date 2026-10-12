import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { subEvents } from "./guests";
import { vendors } from "./money";
import { weddings } from "./weddings";

export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "done"]);

// Pre-wedding planning checklist.
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    dueDate: date("due_date"),
    status: taskStatus("status").notNull().default("todo"),
    assigneeUserId: text("assignee_user_id").references(() => user.id, { onDelete: "set null" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("tasks_wedding_idx").on(t.weddingId)],
);

// Run-of-show entries, optionally attached to a sub-event and shown on guest pages.
export const timelineItems = pgTable(
  "timeline_items",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    subEventId: uuid("sub_event_id").references(() => subEvents.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    guestVisible: boolean("guest_visible").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("timeline_items_wedding_idx").on(t.weddingId)],
);
