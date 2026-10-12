import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/datetime";
import { getCtx } from "@/server/action";
import { listCategories } from "@/server/budget";
import { listVendors } from "@/server/vendors";
import { VendorsView } from "./vendors-view";

export default async function VendorsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [vendors, categories] = await Promise.all([listVendors(ctx), listCategories(ctx)]);

  return (
    <VendorsView
      weddingId={weddingId}
      vendors={vendors}
      categories={categories}
      currency={wedding.currency}
      today={todayIn(wedding.timezone)}
      editable={canEdit(role)}
    />
  );
}
