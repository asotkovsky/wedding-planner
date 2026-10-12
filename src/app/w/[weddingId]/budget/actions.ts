"use server";

import { runAction } from "@/server/action";
import * as budget from "@/server/budget";

export async function setTotalBudget(weddingId: string, total: string) {
  return runAction(weddingId, (ctx) => budget.setTotalBudget(ctx, total));
}

export async function createCategory(weddingId: string, input: budget.CategoryCreateInput) {
  return runAction(weddingId, (ctx) => budget.createCategory(ctx, input));
}

export async function updateCategory(weddingId: string, categoryId: string, input: budget.CategoryUpdateInput) {
  return runAction(weddingId, (ctx) => budget.updateCategory(ctx, categoryId, input));
}

export async function deleteCategory(weddingId: string, categoryId: string) {
  return runAction(weddingId, (ctx) => budget.deleteCategory(ctx, categoryId));
}

export async function addExpense(weddingId: string, input: budget.ExpenseCreateInput) {
  return runAction(weddingId, (ctx) => budget.addExpense(ctx, input));
}

export async function deleteExpense(weddingId: string, expenseId: string) {
  return runAction(weddingId, (ctx) => budget.deleteExpense(ctx, expenseId));
}
