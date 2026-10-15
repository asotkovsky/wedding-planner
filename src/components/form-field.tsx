import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneAsTyped } from "@/lib/phone";
import { cn } from "@/lib/utils";

type FieldProps = {
  name: string;
  label: string;
  className?: string;
} & Omit<React.ComponentProps<"input">, "name">;

export function Field({ name, label, className, ...props }: FieldProps) {
  const id = props.id ?? `f-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} step={props.type === "number" ? "0.01" : undefined} {...props} />
    </div>
  );
}

/** A phone input that formats US numbers as you type (555-555-5555). */
export function PhoneField(props: Omit<FieldProps, "type">) {
  return (
    <Field
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      {...props}
      onInput={(e) => {
        const input = e.currentTarget;
        input.value = formatPhoneAsTyped(input.value);
        props.onInput?.(e);
      }}
    />
  );
}

export function TextareaField({
  name,
  label,
  className,
  ...props
}: { name: string; label: string; className?: string } & Omit<React.ComponentProps<"textarea">, "name">) {
  const id = props.id ?? `f-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} {...props} />
    </div>
  );
}

export const NONE = "__none__";

/** A shadcn Select that submits with its form. Use NONE for an empty choice. */
export function SelectField({
  name,
  label,
  options,
  defaultValue,
  className,
  placeholder,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Select name={name} defaultValue={defaultValue ?? undefined}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Maps the NONE sentinel (and missing values) to "". */
export function noneToEmpty(v: string | undefined) {
  return !v || v === NONE ? "" : v;
}
