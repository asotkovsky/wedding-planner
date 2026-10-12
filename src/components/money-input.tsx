import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The currency's symbol as shown to an English reader: $, €, £, CA$, A$… */
export function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

type MoneyInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  currency: string;
  /** Classes for the wrapper (width, margins). */
  className?: string;
  /** Classes for the input itself (height, text alignment). */
  inputClassName?: string;
};

/** A number input for an amount of money, with the currency symbol as a prefix. */
export function MoneyInput({ currency, className, inputClassName, ...props }: MoneyInputProps) {
  const symbol = currencySymbol(currency);
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
      >
        {symbol}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        {...props}
        className={inputClassName}
        // Make room for the symbol: about 0.55rem per character plus the left inset.
        style={{ paddingLeft: `${0.85 + symbol.length * 0.55}rem`, ...props.style }}
      />
    </div>
  );
}

export function MoneyField({
  name,
  label,
  currency,
  className,
  errors,
  ...props
}: Omit<MoneyInputProps, "name"> & { name: string; label: string; errors?: string[] }) {
  const id = props.id ?? `f-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput id={id} name={name} currency={currency} {...props} />
      {errors?.map((e) => (
        <p key={e} className="text-sm text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}
