import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/datetime";
import { getCtx } from "@/server/action";
import { getBudgetSummary, listExpenses } from "@/server/budget";
import { BudgetView } from "./budget-view";

export default async function BudgetPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [summary, expenses] = await Promise.all([getBudgetSummary(ctx), listExpenses(ctx)]);

  return (
    <BudgetView
      weddingId={weddingId}
      summary={summary}
      expenses={expenses}
      currency={wedding.currency}
      today={todayIn(wedding.timezone)}
      editable={canEdit(role)}
    />
  );
}
