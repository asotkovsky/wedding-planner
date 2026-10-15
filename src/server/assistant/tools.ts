import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { utcToLocal } from "@/lib/datetime";
import * as budget from "../budget";
import { cents, UserError, type Ctx } from "../core";
import * as events from "../events";
import * as guestPage from "../guest-page";
import * as guests from "../guests";
import * as planning from "../planning";
import * as vendors from "../vendors";

// Tool input schemas are deliberately plain (no transforms): the services do their own
// parsing, so the raw model input is passed straight through. Amounts are in major
// currency units; times are wall-clock in the wedding's timezone.

const id = (what: string) => z.string().describe(`${what} id (from a list_* tool)`);
const localTime = z.string().describe('Local date-time in the wedding timezone, "YYYY-MM-DDTHH:mm"');
const date = z.string().describe('Date, "YYYY-MM-DD"');
const ageGroup = z.enum(["adult", "child", "infant"]);
const side = z.enum(["partner1", "partner2", "both"]).describe("Which partner's side the guest is from");
const rsvpStatus = z.enum(["pending", "attending", "declined"]);
const summary = z
  .string()
  .describe("One short sentence shown to the user when asking them to approve, e.g. 'Delete guest Jane Smith'");

const guestFields = {
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  side: side.nullish(),
  ageGroup: ageGroup.optional(),
  bringsPlusOne: z
    .boolean()
    .optional()
    .describe(
      "Give this guest an unnamed +1: a separate guest row they name when they RSVP. On update_guest, false removes their +1. Anyone you know the name of (spouse, partner, parent, child, friend) should be added as their own guest instead.",
    ),
  dietaryRestrictions: z.string().nullish(),
  notes: z.string().nullish(),
};

const householdFields = {
  name: z.string().nullish().describe("Defaults to a name derived from the guests, e.g. 'Jane & John Smith'"),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  addressLine1: z.string().nullish(),
  addressLine2: z.string().nullish(),
  city: z.string().nullish(),
  region: z.string().nullish().describe("State / province"),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
  notes: z.string().nullish().describe("Private notes for the couple and their crew"),
  personalNote: z.string().nullish().describe("A note from the couple shown to this household on their guest page"),
};

const eventFields = {
  name: z.string(),
  startsAt: localTime.nullish(),
  endsAt: localTime.nullish(),
  locationName: z.string().nullish(),
  address: z.string().nullish(),
  mapUrl: z.string().nullish(),
  dressCode: z.string().nullish(),
  description: z.string().nullish().describe("Details shown to guests"),
  mealOptions: z.array(z.string()).optional().describe("Meal choices guests pick from when RSVPing, if any"),
};

const vendorFields = {
  name: z.string(),
  category: z
    .string()
    .describe("e.g. Venue, Caterer, Photographer, Videographer, DJ, Band, Florist, Officiant, Hair & Makeup, Baker, Rentals"),
  status: z.enum(["considering", "booked", "declined"]).optional(),
  contactName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  contractTotal: z.number().nullish().describe("Total contract price in the wedding currency"),
  budgetCategoryId: z.string().nullish().describe("Defaults to a matching budget category"),
  notes: z.string().nullish(),
};

const paymentFields = {
  description: z.string().describe("e.g. Deposit, Second installment, Final balance"),
  amount: z.number().describe("Amount in the wedding currency"),
  dueDate: date.nullish(),
  paidOn: date.nullish().describe("Set if already paid"),
  method: z.string().nullish(),
};

const taskFields = {
  title: z.string(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  dueDate: date.nullish(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeUserId: z.string().nullish().describe("A collaborator's user id from get_wedding_overview"),
  vendorId: z.string().nullish(),
};

const timelineFields = {
  title: z.string(),
  startsAt: localTime,
  endsAt: localTime.nullish(),
  subEventId: z.string().nullish().describe("Event id this item belongs to, e.g. the ceremony"),
  location: z.string().nullish(),
  description: z.string().nullish(),
  vendorId: z.string().nullish().describe("Vendor responsible for this item"),
  guestVisible: z.boolean().optional().describe("Show on guests' pages (default false)"),
};

/** Tools that always need the user's approval (destructive). */
export const APPROVAL_REQUIRED = [
  "delete_household",
  "delete_guest",
  "delete_event",
  "delete_vendor",
  "delete_vendor_payment",
  "delete_expense",
  "delete_budget_category",
  "delete_tasks",
  "delete_timeline_items",
] as const;

/** Bulk changes above this size need approval. */
export const BULK_APPROVAL_THRESHOLD = 10;

/** Runs a service call; expected errors go back to the model instead of failing the stream. */
async function attempt<T extends object>(summaryText: (r: T) => string, fn: () => Promise<T>) {
  try {
    const result = await fn();
    return { ok: true as const, summary: summaryText(result), ...result };
  } catch (e) {
    if (e instanceof UserError) return { ok: false as const, error: e.message };
    if (e instanceof z.ZodError) return { ok: false as const, error: z.prettifyError(e) };
    throw e;
  }
}

export function buildTools(ctx: Ctx, { canWrite }: { canWrite: boolean }) {
  const tz = ctx.timezone;
  const local = (d: Date | null) => (d ? utcToLocal(d, tz) : null);

  const readTools = {
    list_guests: tool({
      description:
        "List households and their guests with per-event RSVP status. Use filters to keep results small. Returns ids needed by other tools.",
      inputSchema: z.object({
        search: z.string().optional().describe("Case-insensitive match on household or guest name"),
        eventId: z.string().optional().describe("Only guests invited to this event"),
        rsvpStatus: rsvpStatus.optional().describe("Only guests with this status (requires eventId)"),
      }),
      execute: async ({ search, eventId, rsvpStatus: status }) => {
        const [hh, evs] = await Promise.all([guests.listHouseholds(ctx), events.listSubEvents(ctx)]);
        const eventName = new Map(evs.map((e) => [e.id, e.name]));
        const q = search?.toLowerCase();
        const result = hh
          .map((h) => ({
            id: h.id,
            name: h.name,
            email: h.email,
            rsvpSubmitted: !!h.rsvpSubmittedAt,
            guests: h.guests
              .filter((g) => !eventId || g.invites.some((i) => i.subEventId === eventId && (!status || i.status === status)))
              .map((g) => ({
                id: g.id,
                name: guests.guestDisplayName(g),
                ageGroup: g.ageGroup,
                isPlusOne: g.isPlusOne,
                plusOneOf: g.plusOneOf,
                side: g.side,
                dietaryRestrictions: g.dietaryRestrictions,
                rsvps: g.invites.map((i) => ({
                  eventId: i.subEventId,
                  event: eventName.get(i.subEventId),
                  status: i.status,
                  mealChoice: i.mealChoice,
                })),
              })),
          }))
          .filter((h) => h.guests.length > 0 || (!eventId && !q))
          .filter(
            (h) => !q || h.name.toLowerCase().includes(q) || h.guests.some((g) => g.name.toLowerCase().includes(q)),
          );
        return { households: result, totalGuests: result.reduce((s, h) => s + h.guests.length, 0) };
      },
    }),

    list_events: tool({
      description: "List the wedding's events (ceremony, reception, …) with times, locations and RSVP counts.",
      inputSchema: z.object({}),
      execute: async () => ({
        events: (await events.listSubEvents(ctx)).map((e) => ({
          id: e.id,
          name: e.name,
          startsAt: local(e.startsAt),
          endsAt: local(e.endsAt),
          locationName: e.locationName,
          address: e.address,
          dressCode: e.dressCode,
          mealOptions: e.mealOptions,
          invited: e.invited,
          attending: e.attending,
          declined: e.declined,
        })),
      }),
    }),

    list_vendors: tool({
      description: "List vendors with contract totals, payments (paid and scheduled) and remaining balances.",
      inputSchema: z.object({}),
      execute: async () => ({
        currency: ctx.currency,
        vendors: (await vendors.listVendors(ctx)).map((v) => ({
          id: v.id,
          name: v.name,
          category: v.category,
          status: v.status,
          contactName: v.contactName,
          email: v.email,
          phone: v.phone,
          contractTotal: cents(v.contractTotalCents),
          paid: cents(v.paidCents),
          balance: cents(v.balanceCents),
          budgetCategoryId: v.budgetCategoryId,
          payments: v.payments.map((p) => ({
            id: p.id,
            description: p.description,
            amount: cents(p.amountCents),
            dueDate: p.dueDate,
            paidOn: p.paidOn,
          })),
        })),
      }),
    }),

    get_budget: tool({
      description:
        "Budget summary: total budget, and per category the planned, committed (booked contracts + expenses) and paid amounts. Also lists non-vendor expenses.",
      inputSchema: z.object({}),
      execute: async () => {
        const [s, exp] = await Promise.all([budget.getBudgetSummary(ctx), budget.listExpenses(ctx)]);
        return {
          currency: ctx.currency,
          totalBudget: cents(s.totalBudgetCents),
          planned: cents(s.plannedCents),
          committed: cents(s.committedCents),
          paid: cents(s.paidCents),
          categories: s.categories.map((c) => ({
            id: c.id,
            name: c.name,
            planned: cents(c.plannedCents),
            committed: cents(c.committedCents),
            paid: cents(c.paidCents),
          })),
          expenses: exp.map((e) => ({
            id: e.id,
            description: e.description,
            amount: cents(e.amountCents),
            spentOn: e.spentOn,
            category: e.categoryName,
          })),
        };
      },
    }),

    list_tasks: tool({
      description: "List planning tasks (the pre-wedding checklist).",
      inputSchema: z.object({ includeDone: z.boolean().optional().describe("Include completed tasks (default false)") }),
      execute: async ({ includeDone }) => ({
        tasks: (await planning.listTasks(ctx))
          .filter((t) => includeDone || t.status !== "done")
          .map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            status: t.status,
            category: t.category,
            assigneeUserId: t.assigneeUserId,
          })),
      }),
    }),

    list_timeline: tool({
      description: "List the day-of timeline (run of show).",
      inputSchema: z.object({}),
      execute: async () => ({
        items: (await planning.listTimeline(ctx)).map((i) => ({
          id: i.id,
          title: i.title,
          startsAt: local(i.startsAt),
          endsAt: local(i.endsAt),
          subEventId: i.subEventId,
          location: i.location,
          vendorId: i.vendorId,
          guestVisible: i.guestVisible,
        })),
      }),
    }),

    get_guest_page: tool({
      description:
        "Read the content of the guests' invitation page: welcome message, dress code, travel and accommodation info, RSVP deadline and FAQ. Households' RSVP replies are in list_guests.",
      inputSchema: z.object({}),
      execute: async () => guestPage.getGuestPageContent(ctx),
    }),
  } satisfies ToolSet;

  // Viewers get the same tool definitions (so shared chat history stays valid), but writes refuse to run.
  const write: typeof attempt = canWrite
    ? attempt
    : async () => ({ ok: false as const, error: "You have view-only access to this wedding, so I can't make changes." });

  const writeTools = {
    // ---- Guests ----
    create_household: tool({
      description:
        "Add a household (a party that shares one invitation) with one or more guests. Use for any new guest who isn't joining an existing household.",
      inputSchema: z.object({
        ...householdFields,
        guests: z.array(z.object(guestFields)).min(1),
        eventIds: z
          .array(z.string())
          .optional()
          .describe("Events to invite every guest in the household to. Omit to invite them to all events."),
      }),
      execute: ({ eventIds, ...input }) =>
        write(
          (r) => `Added household ${r.name} (${r.guestIds.length} guest${r.guestIds.length === 1 ? "" : "s"})`,
          async () => {
            const subEventIds = eventIds ?? (await events.listSubEvents(ctx)).map((e) => e.id);
            return guests.createHousehold(ctx, { ...input, subEventIds });
          },
        ),
    }),

    add_guest: tool({
      description:
        "Add a guest (e.g. a plus-one or child) to an existing household. They're invited to the same events as the household unless eventIds is given.",
      inputSchema: z.object({ householdId: id("Household"), ...guestFields, eventIds: z.array(z.string()).optional() }),
      execute: ({ eventIds, ...input }) =>
        write((r) => `Added ${r.name}`, () => guests.addGuest(ctx, { ...input, subEventIds: eventIds })),
    }),

    update_guest: tool({
      description: "Update a guest's details. Only the fields you pass are changed; pass null to clear a field.",
      inputSchema: z.object({ guestId: id("Guest"), ...guestFields }).partial().required({ guestId: true }),
      execute: ({ guestId, ...input }) =>
        write((r) => `Updated ${r.name}`, () => guests.updateGuest(ctx, guestId, input)),
    }),

    update_household: tool({
      description: "Update a household's name, contact info or address. Only the fields you pass are changed.",
      inputSchema: z.object({ householdId: id("Household"), ...householdFields }),
      execute: ({ householdId, ...input }) =>
        write((r) => `Updated household ${r.name}`, () => guests.updateHousehold(ctx, householdId, input)),
    }),

    set_rsvp: tool({
      description: "Record a guest's RSVP for one event. The guest must be invited to that event.",
      inputSchema: z.object({
        guestId: id("Guest"),
        eventId: id("Event"),
        status: rsvpStatus,
        mealChoice: z.string().nullish().describe("Must be one of the event's meal options, if it has any"),
      }),
      execute: ({ eventId, ...input }) =>
        write((r) => `RSVP for ${r.event}: ${r.status}`, () => guests.setRsvp(ctx, { ...input, subEventId: eventId })),
    }),

    set_rsvps: tool({
      description:
        "Record RSVPs for several guests or events in one call. Use this instead of calling set_rsvp repeatedly. Each guest must be invited to that event.",
      inputSchema: z.object({
        rsvps: z
          .array(
            z.object({
              guestId: id("Guest"),
              eventId: id("Event"),
              status: rsvpStatus,
              mealChoice: z.string().nullish().describe("Must be one of the event's meal options, if it has any"),
            }),
          )
          .min(1),
      }),
      execute: ({ rsvps }) =>
        write(
          (r) =>
            `Recorded ${r.saved} RSVP${r.saved === 1 ? "" : "s"}${r.failed.length ? ` (${r.failed.length} couldn't be saved)` : ""}`,
          async () => {
            let saved = 0;
            const failed: { guestId: string; eventId: string; error: string }[] = [];
            for (const { eventId, ...input } of rsvps) {
              try {
                await guests.setRsvp(ctx, { ...input, subEventId: eventId });
                saved++;
              } catch (e) {
                if (!(e instanceof UserError || e instanceof z.ZodError)) throw e;
                failed.push({ guestId: input.guestId, eventId, error: e.message });
              }
            }
            return { saved, failed };
          },
        ),
    }),

    set_invitations: tool({
      description:
        "Invite or uninvite guests to an event. Uninviting deletes their RSVP for that event and requires the user's approval.",
      inputSchema: z.object({ eventId: id("Event"), guestIds: z.array(z.string()).min(1), invited: z.boolean(), summary }),
      execute: ({ eventId, guestIds, invited }) =>
        write(
          (r) => `${invited ? "Invited" : "Uninvited"} ${r.count} guest(s)`,
          () => guests.setInvitations(ctx, { subEventId: eventId, guestIds, invited }),
        ),
    }),

    // ---- Events ----
    create_event: tool({
      description: "Create an event guests can be invited to (e.g. Ceremony, Reception, Rehearsal dinner, Brunch).",
      inputSchema: z.object({
        ...eventFields,
        inviteAllGuests: z.boolean().optional().describe("Invite every current guest (default false)"),
      }),
      execute: (input) =>
        write(
          (r) => `Created ${r.name}${r.invited ? ` and invited ${r.invited} guests` : ""}`,
          () => events.createSubEvent(ctx, input),
        ),
    }),

    update_event: tool({
      description: "Update an event. Only the fields you pass are changed.",
      inputSchema: z.object({ eventId: id("Event"), ...eventFields }).partial().required({ eventId: true }),
      execute: ({ eventId, ...input }) => write((r) => `Updated ${r.name}`, () => events.updateSubEvent(ctx, eventId, input)),
    }),

    invite_all_guests: tool({
      description: "Invite every current guest to an event.",
      inputSchema: z.object({ eventId: id("Event") }),
      execute: ({ eventId }) =>
        write((r) => `Invited ${r.newlyInvited} more guest(s) to ${r.name}`, () => events.inviteAllGuests(ctx, eventId)),
    }),

    // ---- Vendors & payments ----
    create_vendor: tool({
      description: "Add a vendor.",
      inputSchema: z.object(vendorFields),
      execute: (input) => write((r) => `Added vendor ${r.name}`, () => vendors.createVendor(ctx, input)),
    }),

    update_vendor: tool({
      description: "Update a vendor (e.g. mark as booked, set the contract total). Only the fields you pass are changed.",
      inputSchema: z.object({ vendorId: id("Vendor"), ...vendorFields }).partial().required({ vendorId: true }),
      execute: ({ vendorId, ...input }) => write((r) => `Updated ${r.name}`, () => vendors.updateVendor(ctx, vendorId, input)),
    }),

    add_vendor_payment: tool({
      description: "Schedule (or record) a payment to a vendor, e.g. a deposit or installment.",
      inputSchema: z.object({ vendorId: id("Vendor"), ...paymentFields }),
      execute: (input) => write(() => `Added payment "${input.description}"`, () => vendors.addPayment(ctx, input)),
    }),

    update_vendor_payment: tool({
      description: "Update a scheduled payment. Only the fields you pass are changed.",
      inputSchema: z.object({ paymentId: id("Payment"), ...paymentFields }).partial().required({ paymentId: true }),
      execute: ({ paymentId, ...input }) =>
        write((r) => `Updated payment "${r.description}"`, () => vendors.updatePayment(ctx, paymentId, input)),
    }),

    set_payment_paid: tool({
      description: "Mark one vendor payment as paid (or unpaid).",
      inputSchema: z.object({ paymentId: id("Payment"), paid: z.boolean(), paidOn: date.optional().describe("Defaults to today") }),
      execute: ({ paymentId, paid, paidOn }) =>
        write(
          (r) => `Marked "${r.description}" as ${paid ? "paid" : "unpaid"}`,
          () => vendors.setPaymentPaid(ctx, paymentId, paid, paidOn),
        ),
    }),

    mark_vendor_paid_in_full: tool({
      description:
        "Mark a vendor as fully paid: every unpaid payment is marked paid, and any remaining contract balance is recorded as a paid final payment.",
      inputSchema: z.object({ vendorId: id("Vendor"), paidOn: date.optional().describe("Defaults to today") }),
      execute: ({ vendorId, paidOn }) =>
        write((r) => `Marked ${r.name} as paid in full`, () => vendors.markVendorPaidInFull(ctx, vendorId, paidOn)),
    }),

    // ---- Budget ----
    set_total_budget: tool({
      description: "Set the overall wedding budget.",
      inputSchema: z.object({ total: z.number().nullable().describe("Amount in the wedding currency, or null to clear") }),
      execute: ({ total }) =>
        write(
          () => `Set total budget`,
          async () => {
            await budget.setTotalBudget(ctx, total);
            return {};
          },
        ),
    }),

    create_budget_category: tool({
      description: "Add a budget category.",
      inputSchema: z.object({ name: z.string(), planned: z.number().optional().describe("Planned amount") }),
      execute: (input) => write(() => `Added budget category ${input.name}`, () => budget.createCategory(ctx, input)),
    }),

    update_budget_category: tool({
      description: "Rename a budget category or set its planned amount.",
      inputSchema: z.object({ categoryId: id("Budget category"), name: z.string().optional(), planned: z.number().optional() }),
      execute: ({ categoryId, ...input }) =>
        write((r) => `Updated budget category ${r.name}`, () => budget.updateCategory(ctx, categoryId, input)),
    }),

    add_expense: tool({
      description: "Record spending that isn't a vendor payment (e.g. rings, marriage license).",
      inputSchema: z.object({
        description: z.string(),
        amount: z.number(),
        budgetCategoryId: z.string().nullish(),
        spentOn: date.nullish(),
      }),
      execute: (input) => write(() => `Added expense "${input.description}"`, () => budget.addExpense(ctx, input)),
    }),

    // ---- Planning ----
    create_tasks: tool({
      description: `Add one or more planning tasks. Use for generating a planning checklist. More than ${BULK_APPROVAL_THRESHOLD} tasks at once requires the user's approval, so batch a full checklist into one call.`,
      inputSchema: z.object({ tasks: z.array(z.object(taskFields)).min(1).max(200), summary }),
      execute: ({ tasks }) =>
        write((r) => `Added ${r.taskIds.length} task(s)`, () => planning.createTasks(ctx, tasks)),
    }),

    update_task: tool({
      description: "Update a task (e.g. mark done, change due date, assign). Only the fields you pass are changed.",
      inputSchema: z.object({ taskId: id("Task"), ...taskFields }).partial().required({ taskId: true }),
      execute: ({ taskId, ...input }) =>
        write((r) => `Updated task "${r.title}"`, () => planning.updateTask(ctx, taskId, input)),
    }),

    create_timeline_items: tool({
      description: `Add items to the day-of timeline. Use for drafting a run of show. More than ${BULK_APPROVAL_THRESHOLD} items at once requires the user's approval, so batch a full timeline into one call.`,
      inputSchema: z.object({ items: z.array(z.object(timelineFields)).min(1).max(200), summary }),
      execute: ({ items }) =>
        write((r) => `Added ${r.itemIds.length} timeline item(s)`, () => planning.createTimelineItems(ctx, items)),
    }),

    update_timeline_item: tool({
      description: "Update a timeline item. Only the fields you pass are changed.",
      inputSchema: z.object({ itemId: id("Timeline item"), ...timelineFields }).partial().required({ itemId: true }),
      execute: ({ itemId, ...input }) =>
        write((r) => `Updated "${r.title}"`, () => planning.updateTimelineItem(ctx, itemId, input)),
    }),

    // ---- Guest page ----
    update_guest_page: tool({
      description:
        "Update the guests' invitation page. Only the fields you pass change. faq and registry replace the whole list, so call get_guest_page first and include existing items you want to keep.",
      inputSchema: z.object({
        welcomeMessage: z.string().nullish(),
        dressCode: z.string().nullish(),
        travelInfo: z.string().nullish().describe("Getting there: airports, parking, shuttles"),
        accommodationInfo: z.string().nullish().describe("Where to stay: hotel blocks, booking codes"),
        rsvpDeadline: date.nullish().describe("Last day guests can RSVP"),
        faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
        registry: z
          .array(z.object({ label: z.string().describe("e.g. 'Zola', 'Honeymoon fund'"), url: z.string() }))
          .optional()
          .describe("Replaces the whole list of registry links"),
      }),
      execute: (input) =>
        write((r) => `Updated the guest page (${r.updated.join(", ")})`, () => guestPage.updateGuestPageContent(ctx, input)),
    }),

    // ---- Deletes (always require approval) ----
    delete_household: tool({
      description: "Delete a household with all its guests and RSVPs. Requires approval.",
      inputSchema: z.object({ householdId: id("Household"), summary }),
      execute: ({ householdId }) => write((r) => `Deleted ${r.name}`, () => guests.deleteHousehold(ctx, householdId)),
    }),
    delete_guest: tool({
      description: "Remove one guest (and the household, if they were its last guest). Requires approval.",
      inputSchema: z.object({ guestId: id("Guest"), summary }),
      execute: ({ guestId }) => write((r) => `Removed ${r.name}`, () => guests.deleteGuest(ctx, guestId)),
    }),
    delete_event: tool({
      description: "Delete an event with its invitations, RSVPs and timeline items. Requires approval.",
      inputSchema: z.object({ eventId: id("Event"), summary }),
      execute: ({ eventId }) => write((r) => `Deleted ${r.name}`, () => events.deleteSubEvent(ctx, eventId)),
    }),
    delete_vendor: tool({
      description: "Delete a vendor and its payments. Requires approval.",
      inputSchema: z.object({ vendorId: id("Vendor"), summary }),
      execute: ({ vendorId }) => write((r) => `Deleted ${r.name}`, () => vendors.deleteVendor(ctx, vendorId)),
    }),
    delete_vendor_payment: tool({
      description: "Delete a vendor payment. Requires approval.",
      inputSchema: z.object({ paymentId: id("Payment"), summary }),
      execute: ({ paymentId }) =>
        write((r) => `Deleted payment "${r.description}"`, () => vendors.deletePayment(ctx, paymentId)),
    }),
    delete_expense: tool({
      description: "Delete an expense. Requires approval.",
      inputSchema: z.object({ expenseId: id("Expense"), summary }),
      execute: ({ expenseId }) =>
        write((r) => `Deleted expense "${r.description}"`, () => budget.deleteExpense(ctx, expenseId)),
    }),
    delete_budget_category: tool({
      description: "Delete a budget category; its vendors and expenses become uncategorized. Requires approval.",
      inputSchema: z.object({ categoryId: id("Budget category"), summary }),
      execute: ({ categoryId }) => write((r) => `Deleted category ${r.name}`, () => budget.deleteCategory(ctx, categoryId)),
    }),
    delete_tasks: tool({
      description: "Delete one or more tasks. Requires approval.",
      inputSchema: z.object({ taskIds: z.array(z.string()).min(1), summary }),
      execute: ({ taskIds }) => write((r) => `Deleted ${r.deleted} task(s)`, () => planning.deleteTasks(ctx, taskIds)),
    }),
    delete_timeline_items: tool({
      description: "Delete one or more timeline items. Requires approval.",
      inputSchema: z.object({ itemIds: z.array(z.string()).min(1), summary }),
      execute: ({ itemIds }) =>
        write((r) => `Deleted ${r.deleted} timeline item(s)`, () => planning.deleteTimelineItems(ctx, itemIds)),
    }),
  } satisfies ToolSet;

  return { ...readTools, ...writeTools };
}

export type AssistantTools = ReturnType<typeof buildTools>;

/**
 * Which tool calls pause for the user's approval: every delete, bulk creates above the
 * threshold, and uninviting guests (which discards their RSVPs).
 */
export const toolApproval = {
  ...Object.fromEntries(APPROVAL_REQUIRED.map((name) => [name, "user-approval" as const])),
  create_tasks: (input: { tasks: unknown[] }) =>
    input.tasks.length > BULK_APPROVAL_THRESHOLD ? ("user-approval" as const) : ("not-applicable" as const),
  create_timeline_items: (input: { items: unknown[] }) =>
    input.items.length > BULK_APPROVAL_THRESHOLD ? ("user-approval" as const) : ("not-applicable" as const),
  set_invitations: (input: { invited: boolean }) =>
    input.invited ? ("not-applicable" as const) : ("user-approval" as const),
};
