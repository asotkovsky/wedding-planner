import { eq } from "drizzle-orm";
import { db } from "@/db";
import { weddingMembers } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { NewWeddingWizard } from "./new-wedding-wizard";

export const metadata = { title: "Plan your wedding · I Do Crew" };

export default async function NewWeddingPage() {
  const user = await requireUser();
  const memberships = await db
    .select({ weddingId: weddingMembers.weddingId })
    .from(weddingMembers)
    .where(eq(weddingMembers.userId, user.id))
    .limit(1);
  return <NewWeddingWizard userFirstName={user.name.split(" ")[0]} canCancel={memberships.length > 0} />;
}
