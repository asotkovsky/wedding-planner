import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { CreateWeddingForm } from "./create-wedding-form";

export default async function WeddingsPage() {
  const user = await requireUser();
  const rows = await db
    .select({ id: weddings.id, name: weddings.name, date: weddings.date, role: weddingMembers.role })
    .from(weddingMembers)
    .innerJoin(weddings, eq(weddings.id, weddingMembers.weddingId))
    .where(eq(weddingMembers.userId, user.id))
    .orderBy(desc(weddings.createdAt));

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your weddings</h1>
        <UserMenu name={user.name} email={user.email} />
      </header>

      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((w) => (
            <Link key={w.id} href={`/w/${w.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{w.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {w.date ? formatDate(w.date) : "Date not set"}
                    <Badge variant="secondary">{w.role}</Badge>
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{rows.length ? "Plan another wedding" : "Plan your first wedding"}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateWeddingForm />
        </CardContent>
      </Card>
    </main>
  );
}
