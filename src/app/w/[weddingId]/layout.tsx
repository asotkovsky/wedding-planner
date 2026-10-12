import { desc, eq } from "drizzle-orm";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { weddingMembers, weddings } from "@/db/schema";
import { requireWeddingAccess } from "@/lib/access";
import { WeddingNav, WeddingSwitcher } from "./nav";

export default async function WeddingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { user, wedding } = await requireWeddingAccess(weddingId);
  const myWeddings = await db
    .select({ id: weddings.id, name: weddings.name })
    .from(weddingMembers)
    .innerJoin(weddings, eq(weddings.id, weddingMembers.weddingId))
    .where(eq(weddingMembers.userId, user.id))
    .orderBy(desc(weddings.createdAt));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b p-4 md:w-60 md:border-r md:border-b-0">
        <WeddingSwitcher current={{ id: wedding.id, name: wedding.name }} weddings={myWeddings} />
        <WeddingNav weddingId={wedding.id} />
        <div className="mt-auto hidden md:block">
          <UserMenu name={user.name} email={user.email} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
