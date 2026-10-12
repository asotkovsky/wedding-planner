import { CircleAlert, CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "yes" | "maybe" | "no" | "late" | "brand";

const STYLES: Record<Status, { className: string; icon: LucideIcon }> = {
  yes: { className: "bg-yes-soft text-yes", icon: CircleCheck },
  maybe: { className: "bg-maybe-soft text-maybe", icon: CircleDashed },
  no: { className: "bg-no-soft text-no", icon: CircleX },
  late: { className: "bg-late-soft text-late", icon: CircleAlert },
  brand: { className: "bg-brand-soft text-brand-ink", icon: CircleCheck },
};

/** Color + icon status label, so meaning never relies on color alone. */
export function StatusPill({
  status,
  children,
  className,
  icon = true,
}: {
  status: Status;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}) {
  const { className: tone, icon: Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      {icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

export const RSVP_STATUS: Record<"pending" | "attending" | "declined", { status: Status; label: string }> = {
  attending: { status: "yes", label: "Attending" },
  declined: { status: "no", label: "Can't make it" },
  pending: { status: "maybe", label: "Awaiting reply" },
};
