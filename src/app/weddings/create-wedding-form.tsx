"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/defaults";
import { createWedding } from "./actions";

export function CreateWeddingForm() {
  const [state, action, pending] = useActionState(createWedding, undefined);
  const [timezone, setTimezone] = useState("America/New_York");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field name="partner1Name" label="Partner 1" errors={state?.errors?.partner1Name} />
      <Field name="partner2Name" label="Partner 2" errors={state?.errors?.partner2Name} />
      <Field name="date" label="Wedding date (optional)" type="date" errors={state?.errors?.date} />
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select name="currency" defaultValue="USD">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <input type="hidden" name="timezone" value={timezone} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Create wedding
        </Button>
      </div>
    </form>
  );
}

function Field({ name, label, type = "text", errors }: { name: string; label: string; type?: string; errors?: string[] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={type !== "date"} />
      {errors?.map((e) => (
        <p key={e} className="text-sm text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}
