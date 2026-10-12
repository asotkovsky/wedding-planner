import { and, count, countDistinct, eq, isNotNull, ne, sum } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { expenses, guests, subEventInvites, tasks, vendorPayments, vendors } from "@/db/schema";
import { requireWeddingAccess } from "@/lib/access";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";

export default async function OverviewPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await requireWeddingAccess(weddingId);

  const [[guestCount], [attending], [booked], [paid], [spent], [openTasks]] = await Promise.all([
    db.select({ n: count() }).from(guests).where(eq(guests.weddingId, weddingId)),
    db
      .select({ n: countDistinct(subEventInvites.guestId) })
      .from(subEventInvites)
      .where(and(eq(subEventInvites.weddingId, weddingId), eq(subEventInvites.status, "attending"))),
    db
      .select({ n: count() })
      .from(vendors)
      .where(and(eq(vendors.weddingId, weddingId), eq(vendors.status, "booked"))),
    db
      .select({ total: sum(vendorPayments.amountCents).mapWith(Number) })
      .from(vendorPayments)
      .where(and(eq(vendorPayments.weddingId, weddingId), isNotNull(vendorPayments.paidAt))),
    db
      .select({ total: sum(expenses.amountCents).mapWith(Number) })
      .from(expenses)
      .where(eq(expenses.weddingId, weddingId)),
    db
      .select({ n: count() })
      .from(tasks)
      .where(and(eq(tasks.weddingId, weddingId), ne(tasks.status, "done"))),
  ]);

  const spentCents = (paid.total ?? 0) + (spent.total ?? 0);
  const days = wedding.date ? daysUntil(wedding.date) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{wedding.name}</h1>
        <p className="text-muted-foreground">
          {wedding.date
            ? `${formatDate(wedding.date)} · ${days! >= 0 ? `${days} days to go` : "Married!"}`
            : "Set a date in Settings"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Guests" value={guestCount.n} />
        <Stat label="Attending (any event)" value={attending.n} />
        <Stat label="Vendors booked" value={booked.n} />
        <Stat
          label="Spent"
          value={formatMoney(spentCents, wedding.currency)}
          hint={wedding.totalBudgetCents ? `of ${formatMoney(wedding.totalBudgetCents, wedding.currency)}` : undefined}
        />
        <Stat label="Open tasks" value={openTasks.n} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}
