"use client";

import { Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { NONE, noneToEmpty } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formObject, useAction } from "@/components/use-action";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetSummary } from "@/server/budget";
import * as actions from "./actions";

type Expense = {
  id: string;
  description: string;
  amountCents: number;
  spentOn: string | null;
  categoryName: string | null;
};

export function BudgetView({
  weddingId,
  summary,
  expenses,
  currency,
  today,
  editable,
}: {
  weddingId: string;
  summary: BudgetSummary;
  expenses: Expense[];
  currency: string;
  today: string;
  editable: boolean;
}) {
  const { pending, run } = useAction();
  const money = (c: number) => formatMoney(c, currency);
  const total = summary.totalBudgetCents;
  const remaining = total != null ? total - summary.committedCents : null;
  const categories = summary.categories.filter((c) => c.id);

  return (
    <div className="space-y-6">
      <PageHeader section="budget" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card size="sm" className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardDescription>Total budget</CardDescription>
            {editable ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () =>
                      actions.setTotalBudget(
                        weddingId,
                        formObject(e.currentTarget).total,
                      ),
                    "Budget updated",
                  );
                }}
              >
                <MoneyInput
                  currency={currency}
                  name="total"
                  defaultValue={total != null ? total / 100 : ""}
                  placeholder="Set budget"
                  className="flex-1"
                  inputClassName="text-lg font-semibold"
                  aria-label="Total budget"
                />
                <Button type="submit" variant="outline" disabled={pending}>
                  Save
                </Button>
              </form>
            ) : (
              <CardTitle className="text-2xl">
                {total != null ? money(total) : "Not set"}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Stat
          label="Planned across categories"
          value={money(summary.plannedCents)}
        />
        <Stat label="Committed" value={money(summary.committedCents)} />
        <Stat label="Paid so far" value={money(summary.paidCents)} />
      </div>

      {total != null && total > 0 && (
        <Card size="sm">
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {Math.round((summary.committedCents / total) * 100)}% of budget
                committed
              </span>
              <span
                className={cn(remaining! < 0 && "font-medium text-destructive")}
              >
                {remaining! >= 0
                  ? `${money(remaining!)} left`
                  : `${money(-remaining!)} over budget`}
              </span>
            </div>
            <Progress
              value={Math.min(100, (summary.committedCents / total) * 100)}
            />
          </CardContent>
        </Card>
      )}

      {/* Phones: one compact row per category. */}
      <ul className="divide-y rounded-2xl border bg-card md:hidden">
        {summary.categories.map((c) => {
          const left = c.plannedCents - c.committedCents;
          return (
            <li key={c.id ?? "uncategorized"} className="space-y-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {c.name}
                </span>
                {editable && c.id ? (
                  <MoneyInput
                    currency={currency}
                    defaultValue={c.plannedCents / 100}
                    className="w-32"
                    inputClassName="h-8 text-right tabular-nums"
                    aria-label={`${c.name} planned`}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (Math.round(Number(v) * 100) !== c.plannedCents) {
                        run(() =>
                          actions.updateCategory(weddingId, c.id!, {
                            planned: v || "0",
                          }),
                        );
                      }
                    }}
                  />
                ) : (
                  <span className="tabular-nums">{money(c.plannedCents)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {money(c.committedCents)} committed · {money(c.paidCents)} paid
                {c.id && (c.plannedCents || c.committedCents) ? (
                  <span className={cn(left < 0 && "font-semibold text-late")}>
                    {" "}
                    · {money(left)} left
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
        <li className="flex justify-between bg-muted/50 p-3 text-sm font-semibold tabular-nums">
          <span>Total planned</span>
          <span>{money(summary.plannedCents)}</span>
        </li>
      </ul>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="w-40 text-right">Planned</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Left</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.categories.map((c) => {
              const left = c.plannedCents - c.committedCents;
              return (
                <TableRow key={c.id ?? "uncategorized"}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">
                    {editable && c.id ? (
                      <MoneyInput
                        currency={currency}
                        defaultValue={c.plannedCents / 100}
                        className="ml-auto w-32"
                        inputClassName="h-7 text-right tabular-nums"
                        aria-label={`${c.name} planned`}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (Math.round(Number(v) * 100) !== c.plannedCents) {
                            run(() =>
                              actions.updateCategory(weddingId, c.id!, {
                                planned: v || "0",
                              }),
                            );
                          }
                        }}
                      />
                    ) : (
                      <span className="tabular-nums">
                        {money(c.plannedCents)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(c.committedCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(c.paidCents)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      left < 0 && "text-destructive",
                    )}
                  >
                    {c.id && (c.plannedCents || c.committedCents)
                      ? money(left)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {editable && c.id && (
                      <ConfirmButton
                        title={`Delete ${c.name}?`}
                        description="Vendors and expenses in this category will become uncategorized."
                        onConfirm={() =>
                          run(
                            () => actions.deleteCategory(weddingId, c.id!),
                            "Category deleted",
                          )
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </ConfirmButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(summary.plannedCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(summary.committedCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(summary.paidCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(summary.plannedCents - summary.committedCents)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {editable && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = formObject(form);
            if (
              await run(
                () =>
                  actions.createCategory(weddingId, {
                    name: f.name,
                    planned: f.planned || "0",
                  }),
                "Category added",
              )
            ) {
              form.reset();
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cat-name">New category</Label>
            <Input
              id="cat-name"
              name="name"
              required
              placeholder="e.g. Honeymoon"
            />
          </div>
          <MoneyInput
            currency={currency}
            name="planned"
            placeholder="Planned"
            className="w-36"
            aria-label="Planned"
          />
          <Button type="submit" variant="outline" disabled={pending}>
            <Plus /> Add category
          </Button>
        </form>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Other expenses</CardTitle>
          <CardDescription>
            Spending not tied to a vendor, like rings, the marriage license or
            online orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{x.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      x.categoryName ?? "Uncategorized",
                      x.spentOn &&
                        formatDate(x.spentOn, { dateStyle: "medium" }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="tabular-nums">{money(x.amountCents)}</span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete expense"
                    onClick={() =>
                      run(
                        () => actions.deleteExpense(weddingId, x.id),
                        "Expense deleted",
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
            {expenses.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">
                No expenses yet.
              </li>
            )}
          </ul>
          {editable && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = formObject(form);
                const ok = await run(
                  () =>
                    actions.addExpense(weddingId, {
                      description: f.description,
                      amount: f.amount,
                      spentOn: f.spentOn,
                      budgetCategoryId: noneToEmpty(f.budgetCategoryId),
                    }),
                  "Expense added",
                );
                if (ok) form.reset();
              }}
            >
              <Input
                name="description"
                required
                placeholder="Description"
                className="min-w-40 flex-1"
                aria-label="Description"
              />
              <MoneyInput
                currency={currency}
                name="amount"
                required
                placeholder="Amount"
                className="w-32"
                aria-label="Amount"
              />
              <Input
                name="spentOn"
                type="date"
                defaultValue={today}
                className="w-40"
                aria-label="Date"
              />
              <Select name="budgetCategoryId" defaultValue={NONE}>
                <SelectTrigger className="w-44" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id!}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" disabled={pending}>
                <Plus /> Add expense
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
