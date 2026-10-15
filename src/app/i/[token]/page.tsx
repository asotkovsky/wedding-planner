import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeddingTheme } from "@/components/wedding-theme";
import { themeVars } from "@/lib/theme";
import { getGuestPage } from "@/server/guest-page";
import { ClassicGuestPage } from "./classic-page";
import { ElegantGuestPage } from "./elegant-page";
import { buildGuestView } from "./view";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const page = await getGuestPage(token);
  return {
    title: page ? `${page.wedding.name} · You're invited!` : "Invitation",
    // Personal links: keep them out of search engines and referrer headers.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function GuestPage({ params }: Params) {
  const { token } = await params;
  const page = await getGuestPage(token);
  if (!page) notFound();
  const view = buildGuestView(page, token);
  const vars = themeVars(page.wedding.themePrimary, page.wedding.themeAccent);

  return (
    <div style={vars}>
      <WeddingTheme vars={vars} />
      {page.wedding.guestPageStyle === "elegant" ? <ElegantGuestPage view={view} /> : <ClassicGuestPage view={view} />}
    </div>
  );
}
