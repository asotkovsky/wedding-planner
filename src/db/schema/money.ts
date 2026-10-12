// Vendors, payments and budget. All amounts are integer cents in the wedding's currency.
import { date, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { weddings } from "./weddings";

export const budgetCategories = pgTable(
  "budget_categories",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    plannedCents: integer("planned_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [unique("budget_categories_wedding_name_uq").on(t.weddingId, t.name)],
);

export const vendorStatus = pgEnum("vendor_status", ["considering", "booked", "declined"]);

export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    status: vendorStatus("status").notNull().default("considering"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    contractTotalCents: integer("contract_total_cents"),
    budgetCategoryId: uuid("budget_category_id").references(() => budgetCategories.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("vendors_wedding_idx").on(t.weddingId)],
);

// Deposits and installments. A payment is paid when paid_on is set.
export const vendorPayments = pgTable(
  "vendor_payments",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date"),
    paidOn: date("paid_on"),
    method: text("method"),
    ...timestamps(),
  },
  (t) => [index("vendor_payments_wedding_idx").on(t.weddingId), index("vendor_payments_vendor_idx").on(t.vendorId)],
);

// Spending not tied to a vendor (e.g. rings, license, favors bought online).
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    budgetCategoryId: uuid("budget_category_id").references(() => budgetCategories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    spentOn: date("spent_on"),
    ...timestamps(),
  },
  (t) => [index("expenses_wedding_idx").on(t.weddingId)],
);
