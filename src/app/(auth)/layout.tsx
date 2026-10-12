import Link from "next/link";
import { Logo } from "@/components/brand";
import { StickerScatter } from "@/components/sticker-scatter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r-2 border-foreground bg-brand-soft lg:block">
        <div className="absolute inset-0 bg-dots opacity-50" />
        <StickerScatter layout="edge" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/">
            <Logo />
          </Link>
          <div className="max-w-md space-y-3">
            <h2 className="text-5xl leading-[1.05] font-extrabold">Plan the party, not the paperwork.</h2>
            <p className="text-lg text-muted-foreground">
              Guests, vendors, budget and the big-day timeline in one cheerful place, plus a planner that does the
              typing for you.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Made with ♥ for couples (and their very patient planners).</p>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center gap-8 p-6">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        {children}
      </section>
    </main>
  );
}
