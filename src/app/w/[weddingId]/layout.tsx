import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { AssistantMain, AssistantShell } from "@/components/assistant/assistant-shell";
import { Logo, LogoMark } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { WeddingTheme } from "@/components/wedding-theme";
import { db } from "@/db";
import { weddingMembers, weddings } from "@/db/schema";
import { canEdit, requireWeddingAccess } from "@/lib/access";
import { themeVars } from "@/lib/theme";
import { MobileTabBar, WeddingNav, WeddingSwitcher } from "./nav";

export default async function WeddingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { user, wedding, role } = await requireWeddingAccess(weddingId);
  const myWeddings = await db
    .select({ id: weddings.id, name: weddings.name })
    .from(weddingMembers)
    .innerJoin(weddings, eq(weddings.id, weddingMembers.weddingId))
    .where(eq(weddingMembers.userId, user.id))
    .orderBy(desc(weddings.createdAt));
  const vars = themeVars(wedding.themePrimary, wedding.themeAccent);
  const switcher = { current: { id: wedding.id, name: wedding.name }, weddings: myWeddings };

  return (
    <div style={vars}>
      <WeddingTheme vars={vars} />
      <AssistantShell weddingId={wedding.id} canWrite={canEdit(role)}>
        <div className="flex min-h-screen flex-col md:flex-row">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 border-r bg-sidebar p-4 md:flex">
            <Link href="/weddings" className="px-1">
              <Logo />
            </Link>
            <WeddingSwitcher {...switcher} />
            {/* Scrolls on short screens; the account row stays pinned below. */}
            <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
              <WeddingNav weddingId={wedding.id} />
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t pt-3">
              <UserMenu name={user.name} email={user.email} />
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{user.name}</div>
                <div className="truncate text-muted-foreground capitalize">{role}</div>
              </div>
            </div>
          </aside>

          {/* Phone top bar */}
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
            <Link href="/weddings" aria-label="All weddings">
              <LogoMark />
            </Link>
            <WeddingSwitcher {...switcher} compact />
            <div className="ml-auto">
              <UserMenu name={user.name} email={user.email} />
            </div>
          </header>

          <AssistantMain>{children}</AssistantMain>
        </div>
        <MobileTabBar weddingId={wedding.id} />
      </AssistantShell>
    </div>
  );
}
