import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { budgetCategories, vendorPayments, vendors, vendorStatus } from "@/db/schema";
import { todayIn } from "@/lib/datetime";
import { assertOwned, log, money, optDate, optEmail, optMoney, optPhone, optText, optUrl, optUuid, UserError, type Ctx } from "./core";

const vendorFields = {
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  status: z.enum(vendorStatus.enumValues).optional(),
  contactName: optText(200),
  email: optEmail,
  phone: optPhone,
  website: optUrl,
  /** Total contract price in major currency units. */
  contractTotal: optMoney,
  budgetCategoryId: optUuid,
  notes: optText(),
};

export const vendorCreateInput = z.object(vendorFields);
export const vendorUpdateInput = z.object(vendorFields).partial();

const paymentFields = {
  description: z.string().trim().min(1).max(200),
  /** Amount in major currency units. */
  amount: money,
  dueDate: optDate,
  paidOn: optDate,
  method: optText(100),
};

export const paymentCreateInput = z.object({ vendorId: z.uuid(), ...paymentFields });
export const paymentUpdateInput = z.object(paymentFields).partial();

export type VendorCreateInput = z.input<typeof vendorCreateInput>;
export type VendorUpdateInput = z.input<typeof vendorUpdateInput>;
export type PaymentCreateInput = z.input<typeof paymentCreateInput>;
export type PaymentUpdateInput = z.input<typeof paymentUpdateInput>;
export type VendorWithPayments = Awaited<ReturnType<typeof listVendors>>[number];

// ---------- Queries ----------

export async function listVendors(ctx: Ctx) {
  const [vs, ps] = await Promise.all([
    db.select().from(vendors).where(eq(vendors.weddingId, ctx.weddingId)).orderBy(asc(vendors.category), asc(vendors.name)),
    db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.weddingId, ctx.weddingId))
      .orderBy(asc(vendorPayments.dueDate), asc(vendorPayments.createdAt)),
  ]);
  const byVendor = Map.groupBy(ps, (p) => p.vendorId);
  return vs.map((v) => {
    const payments = byVendor.get(v.id) ?? [];
    const paidCents = payments.filter((p) => p.paidOn).reduce((s, p) => s + p.amountCents, 0);
    const scheduledCents = payments.reduce((s, p) => s + p.amountCents, 0);
    const nextDue = payments.find((p) => !p.paidOn) ?? null;
    return {
      ...v,
      payments,
      paidCents,
      scheduledCents,
      balanceCents: v.contractTotalCents != null ? v.contractTotalCents - paidCents : null,
      nextDue,
    };
  });
}

// ---------- Vendors ----------

export async function createVendor(ctx: Ctx, raw: VendorCreateInput) {
  const { contractTotal, ...input } = vendorCreateInput.parse(raw);
  await assertOwned(ctx, budgetCategories, input.budgetCategoryId, "Budget category");
  const budgetCategoryId = input.budgetCategoryId ?? (await guessBudgetCategory(ctx, input.category));
  const [vendor] = await db
    .insert(vendors)
    .values({ ...input, budgetCategoryId, contractTotalCents: contractTotal, weddingId: ctx.weddingId })
    .returning();
  await log(ctx, "create", "vendor", `Added vendor ${vendor.name} (${vendor.category})`, vendor.id);
  return { vendorId: vendor.id, name: vendor.name };
}

export async function updateVendor(ctx: Ctx, vendorId: string, raw: VendorUpdateInput) {
  const { contractTotal, ...input } = vendorUpdateInput.parse(raw);
  await assertOwned(ctx, budgetCategories, input.budgetCategoryId, "Budget category");
  const [vendor] = await db
    .update(vendors)
    .set({ ...input, contractTotalCents: contractTotal })
    .where(and(eq(vendors.id, vendorId), eq(vendors.weddingId, ctx.weddingId)))
    .returning();
  if (!vendor) throw new UserError("Vendor not found");
  await log(ctx, "update", "vendor", `Updated vendor ${vendor.name}`, vendorId);
  return { name: vendor.name };
}

export async function deleteVendor(ctx: Ctx, vendorId: string) {
  const [vendor] = await db
    .delete(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.weddingId, ctx.weddingId)))
    .returning({ name: vendors.name });
  if (!vendor) throw new UserError("Vendor not found");
  await log(ctx, "delete", "vendor", `Deleted vendor ${vendor.name} and its payments`, vendorId);
  return vendor;
}

/**
 * Marks every unpaid payment as paid. If the contract total exceeds what's scheduled,
 * records the remainder as a paid "Final balance" payment. A vendor still marked
 * "considering" becomes "booked".
 */
export async function markVendorPaidInFull(ctx: Ctx, vendorId: string, paidOn?: string) {
  const day = paidOn ?? todayIn(ctx.timezone);
  return db.transaction(async (tx) => {
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.weddingId, ctx.weddingId)));
    if (!vendor) throw new UserError("Vendor not found");

    const updated = await tx
      .update(vendorPayments)
      .set({ paidOn: day })
      .where(and(eq(vendorPayments.vendorId, vendorId), isNull(vendorPayments.paidOn)))
      .returning({ amountCents: vendorPayments.amountCents });
    const all = await tx
      .select({ amountCents: vendorPayments.amountCents })
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId));
    const scheduled = all.reduce((s, p) => s + p.amountCents, 0);
    const remainder = (vendor.contractTotalCents ?? 0) - scheduled;
    if (remainder > 0) {
      await tx.insert(vendorPayments).values({
        weddingId: ctx.weddingId,
        vendorId,
        description: "Final balance",
        amountCents: remainder,
        paidOn: day,
      });
    }
    if (!updated.length && remainder <= 0) {
      throw new UserError(`${vendor.name} has nothing left to pay. Set a contract total or add a payment first.`);
    }
    if (vendor.status === "considering") {
      await tx.update(vendors).set({ status: "booked" }).where(eq(vendors.id, vendorId));
    }
    await log(ctx, "update", "vendor", `Marked ${vendor.name} as paid in full`, vendorId, tx);
    return {
      name: vendor.name,
      paymentsMarkedPaid: updated.length,
      finalBalanceAddedCents: Math.max(remainder, 0),
    };
  });
}

// ---------- Payments ----------

export async function addPayment(ctx: Ctx, raw: PaymentCreateInput) {
  const { amount, ...input } = paymentCreateInput.parse(raw);
  await assertOwned(ctx, vendors, input.vendorId, "Vendor");
  const [payment] = await db
    .insert(vendorPayments)
    .values({ ...input, amountCents: amount, weddingId: ctx.weddingId })
    .returning();
  await log(ctx, "create", "payment", `Added payment "${payment.description}"`, payment.id);
  return { paymentId: payment.id };
}

export async function updatePayment(ctx: Ctx, paymentId: string, raw: PaymentUpdateInput) {
  const { amount, ...input } = paymentUpdateInput.parse(raw);
  const [payment] = await db
    .update(vendorPayments)
    .set({ ...input, amountCents: amount })
    .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.weddingId, ctx.weddingId)))
    .returning();
  if (!payment) throw new UserError("Payment not found");
  await log(ctx, "update", "payment", `Updated payment "${payment.description}"`, paymentId);
  return { description: payment.description };
}

export async function setPaymentPaid(ctx: Ctx, paymentId: string, paid: boolean, paidOn?: string) {
  return updatePayment(ctx, paymentId, { paidOn: paid ? (paidOn ?? todayIn(ctx.timezone)) : null });
}

export async function deletePayment(ctx: Ctx, paymentId: string) {
  const [payment] = await db
    .delete(vendorPayments)
    .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.weddingId, ctx.weddingId)))
    .returning({ description: vendorPayments.description });
  if (!payment) throw new UserError("Payment not found");
  await log(ctx, "delete", "payment", `Deleted payment "${payment.description}"`, paymentId);
  return payment;
}

// Map common vendor categories to the default budget categories.
const CATEGORY_HINTS: Record<string, string> = {
  venue: "Venue",
  caterer: "Catering",
  catering: "Catering",
  photographer: "Photography",
  videographer: "Videography",
  dj: "Music & Entertainment",
  band: "Music & Entertainment",
  florist: "Flowers & Decor",
  rentals: "Flowers & Decor",
  officiant: "Officiant",
  "hair & makeup": "Attire & Beauty",
  attire: "Attire & Beauty",
  baker: "Cake & Desserts",
  transportation: "Transportation",
  stationery: "Stationery",
};

async function guessBudgetCategory(ctx: Ctx, vendorCategory: string) {
  const target = CATEGORY_HINTS[vendorCategory.toLowerCase()];
  if (!target) return null;
  const [row] = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(and(eq(budgetCategories.weddingId, ctx.weddingId), eq(budgetCategories.name, target)));
  return row?.id ?? null;
}
