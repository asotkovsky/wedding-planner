import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { budgetCategories, expenses, vendorPayments, vendors, weddings } from "@/db/schema";
import { assertOwned, log, money, optDate, optMoney, optUuid, UserError, type Ctx } from "./core";

export const categoryCreateInput = z.object({
  name: z.string().trim().min(1).max(100),
  planned: money.optional(),
});
export const categoryUpdateInput = categoryCreateInput.partial();

const expenseFields = {
  description: z.string().trim().min(1).max(200),
  amount: money,
  budgetCategoryId: optUuid,
  spentOn: optDate,
};
export const expenseCreateInput = z.object(expenseFields);
export const expenseUpdateInput = z.object(expenseFields).partial();

export type CategoryCreateInput = z.input<typeof categoryCreateInput>;
export type CategoryUpdateInput = z.input<typeof categoryUpdateInput>;
export type ExpenseCreateInput = z.input<typeof expenseCreateInput>;
export type ExpenseUpdateInput = z.input<typeof expenseUpdateInput>;
export type BudgetSummary = Awaited<ReturnType<typeof getBudgetSummary>>;

/**
 * Per category:
 *  - planned:   what you intend to spend
 *  - committed: contract totals of booked vendors (or their scheduled payments, if larger) + expenses
 *  - paid:      vendor payments marked paid + expenses
 */
export async function getBudgetSummary(ctx: Ctx) {
  const [[wedding], cats, vendorRows, expenseRows] = await Promise.all([
    db.select({ totalBudgetCents: weddings.totalBudgetCents }).from(weddings).where(eq(weddings.id, ctx.weddingId)),
    db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.weddingId, ctx.weddingId))
      .orderBy(asc(budgetCategories.sortOrder), asc(budgetCategories.name)),
    db
      .select({
        budgetCategoryId: vendors.budgetCategoryId,
        status: vendors.status,
        contractTotalCents: vendors.contractTotalCents,
        scheduledCents: sql<number>`coalesce(sum(${vendorPayments.amountCents}), 0)::int`,
        paidCents: sql<number>`coalesce(sum(${vendorPayments.amountCents}) filter (where ${vendorPayments.paidOn} is not null), 0)::int`,
      })
      .from(vendors)
      .leftJoin(vendorPayments, eq(vendorPayments.vendorId, vendors.id))
      .where(eq(vendors.weddingId, ctx.weddingId))
      .groupBy(vendors.id),
    db
      .select({
        budgetCategoryId: expenses.budgetCategoryId,
        totalCents: sql<number>`sum(${expenses.amountCents})::int`,
      })
      .from(expenses)
      .where(eq(expenses.weddingId, ctx.weddingId))
      .groupBy(expenses.budgetCategoryId),
  ]);

  type Row = { id: string | null; name: string; plannedCents: number; committedCents: number; paidCents: number };
  const rows = new Map<string | null, Row>(
    cats.map((c) => [c.id, { id: c.id, name: c.name, plannedCents: c.plannedCents, committedCents: 0, paidCents: 0 }]),
  );
  const row = (id: string | null) => {
    if (!rows.has(id)) rows.set(id, { id: null, name: "Uncategorized", plannedCents: 0, committedCents: 0, paidCents: 0 });
    return rows.get(id)!;
  };

  for (const v of vendorRows) {
    const r = row(v.budgetCategoryId);
    r.paidCents += v.paidCents;
    if (v.status === "booked") r.committedCents += Math.max(v.contractTotalCents ?? 0, v.scheduledCents);
    else r.committedCents += v.paidCents; // deposits paid to vendors not (yet) booked still count
  }
  for (const e of expenseRows) {
    const r = row(e.budgetCategoryId);
    r.committedCents += e.totalCents;
    r.paidCents += e.totalCents;
  }

  const categories = [...rows.values()];
  const sum = (k: "plannedCents" | "committedCents" | "paidCents") => categories.reduce((s, c) => s + c[k], 0);
  return {
    totalBudgetCents: wedding?.totalBudgetCents ?? null,
    plannedCents: sum("plannedCents"),
    committedCents: sum("committedCents"),
    paidCents: sum("paidCents"),
    categories,
  };
}

export async function listExpenses(ctx: Ctx) {
  return db
    .select({
      id: expenses.id,
      description: expenses.description,
      amountCents: expenses.amountCents,
      spentOn: expenses.spentOn,
      budgetCategoryId: expenses.budgetCategoryId,
      categoryName: budgetCategories.name,
    })
    .from(expenses)
    .leftJoin(budgetCategories, eq(budgetCategories.id, expenses.budgetCategoryId))
    .where(eq(expenses.weddingId, ctx.weddingId))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}

// ---------- Categories ----------

export async function listCategories(ctx: Ctx) {
  return db
    .select({ id: budgetCategories.id, name: budgetCategories.name })
    .from(budgetCategories)
    .where(eq(budgetCategories.weddingId, ctx.weddingId))
    .orderBy(asc(budgetCategories.sortOrder), asc(budgetCategories.name));
}

export async function createCategory(ctx: Ctx, raw: CategoryCreateInput) {
  const { name, planned } = categoryCreateInput.parse(raw);
  const [cat] = await db
    .insert(budgetCategories)
    .values({ name, plannedCents: planned ?? 0, weddingId: ctx.weddingId, sortOrder: 1000 })
    .onConflictDoNothing()
    .returning();
  if (!cat) throw new UserError(`A category named "${name}" already exists`);
  await log(ctx, "create", "budget_category", `Added budget category ${name}`, cat.id);
  return { categoryId: cat.id };
}

export async function updateCategory(ctx: Ctx, categoryId: string, raw: CategoryUpdateInput) {
  const { name, planned } = categoryUpdateInput.parse(raw);
  const [cat] = await db
    .update(budgetCategories)
    .set({ name, plannedCents: planned })
    .where(and(eq(budgetCategories.id, categoryId), eq(budgetCategories.weddingId, ctx.weddingId)))
    .returning();
  if (!cat) throw new UserError("Budget category not found");
  await log(ctx, "update", "budget_category", `Updated budget category ${cat.name}`, categoryId);
  return { name: cat.name };
}

/** Vendors and expenses in the category become uncategorized. */
export async function deleteCategory(ctx: Ctx, categoryId: string) {
  const [cat] = await db
    .delete(budgetCategories)
    .where(and(eq(budgetCategories.id, categoryId), eq(budgetCategories.weddingId, ctx.weddingId)))
    .returning({ name: budgetCategories.name });
  if (!cat) throw new UserError("Budget category not found");
  await log(ctx, "delete", "budget_category", `Deleted budget category ${cat.name}`, categoryId);
  return cat;
}

export async function setTotalBudget(ctx: Ctx, total: number | string | null) {
  const totalBudgetCents = total === null || total === "" ? null : optMoney.parse(total);
  await db.update(weddings).set({ totalBudgetCents }).where(eq(weddings.id, ctx.weddingId));
  await log(ctx, "update", "wedding", "Updated total budget", ctx.weddingId);
}

// ---------- Expenses ----------

export async function addExpense(ctx: Ctx, raw: ExpenseCreateInput) {
  const { amount, ...input } = expenseCreateInput.parse(raw);
  await assertOwned(ctx, budgetCategories, input.budgetCategoryId, "Budget category");
  const [expense] = await db
    .insert(expenses)
    .values({ ...input, amountCents: amount, weddingId: ctx.weddingId })
    .returning();
  await log(ctx, "create", "expense", `Added expense "${expense.description}"`, expense.id);
  return { expenseId: expense.id };
}

export async function updateExpense(ctx: Ctx, expenseId: string, raw: ExpenseUpdateInput) {
  const { amount, ...input } = expenseUpdateInput.parse(raw);
  await assertOwned(ctx, budgetCategories, input.budgetCategoryId, "Budget category");
  const [expense] = await db
    .update(expenses)
    .set({ ...input, amountCents: amount })
    .where(and(eq(expenses.id, expenseId), eq(expenses.weddingId, ctx.weddingId)))
    .returning();
  if (!expense) throw new UserError("Expense not found");
  await log(ctx, "update", "expense", `Updated expense "${expense.description}"`, expenseId);
  return { description: expense.description };
}

export async function deleteExpense(ctx: Ctx, expenseId: string) {
  const [expense] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.weddingId, ctx.weddingId)))
    .returning({ description: expenses.description });
  if (!expense) throw new UserError("Expense not found");
  await log(ctx, "delete", "expense", `Deleted expense "${expense.description}"`, expenseId);
  return expense;
}
