import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/access";

export default async function Home() {
  if (await getSession()) redirect("/weddings");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Wedding Planner</h1>
      <p className="max-w-md text-muted-foreground">
        Guests, vendors, budget and timelines in one place, with an assistant that does the busywork for you.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
