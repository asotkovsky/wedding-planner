"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/celebrate";

/** Fires once when a couple lands on their brand-new wedding HQ (?welcome=1), then tidies the URL. */
export function WelcomeCelebration({ names, joined = false }: { names: string; joined?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      celebrate();
      toast.success(
        joined ? `Welcome to ${names}'s planning crew! 🥂` : `Congratulations, ${names}! Your wedding HQ is ready 🎉`,
      );
    }, 300);
    router.replace(pathname, { scroll: false });
    return () => clearTimeout(t);
  }, [names, joined, pathname, router]);
  return null;
}
