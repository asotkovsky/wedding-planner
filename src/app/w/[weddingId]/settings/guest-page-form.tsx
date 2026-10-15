"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Field, PhoneField, TextareaField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formObject, useAction } from "@/components/use-action";
import type { FaqItem, GuestPageStyle, RegistryLink } from "@/db/schema";
import { cn } from "@/lib/utils";
import { updateGuestPage } from "./actions";

const STYLES: { value: GuestPageStyle; label: string; description: string; preview: React.ReactNode }[] = [
  {
    value: "classic",
    label: "Classic",
    description: "Playful and colorful, in your wedding colors.",
    preview: (
      <span className="flex h-20 items-center justify-center rounded-lg bg-brand-soft font-display text-xl font-extrabold sticker-sm">
        A <span className="mx-1 text-brand">♥</span> S
      </span>
    ),
  },
  {
    value: "elegant",
    label: "Elegant",
    description: "Timeless and refined, like a traditional wedding website.",
    preview: (
      <span className="flex h-20 flex-col items-center justify-center border border-[#e4ddd0] bg-[#fbf9f5] font-serif">
        <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">We&apos;re getting married</span>
        <span className="text-xl">
          A <span className="text-brand-ink italic">&amp;</span> S
        </span>
      </span>
    ),
  },
];

export function GuestPageForm({
  weddingId,
  content,
  previewHref,
  disabled,
}: {
  weddingId: string;
  content: {
    welcomeMessage: string | null;
    travelInfo: string | null;
    accommodationInfo: string | null;
    dressCode: string | null;
    rsvpDeadline: string | null;
    faq: FaqItem[];
    registry: RegistryLink[];
    guestPageStyle: GuestPageStyle;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  previewHref: string | null;
  disabled: boolean;
}) {
  const { pending, run } = useAction();
  const [faq, setFaq] = useState<(FaqItem & { key: number })[]>(content.faq.map((f, i) => ({ ...f, key: i })));
  const [style, setStyle] = useState<GuestPageStyle>(content.guestPageStyle);
  const [registry, setRegistry] = useState<(RegistryLink & { key: number })[]>(
    content.registry.map((r, i) => ({ ...r, key: i })),
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    await run(
      () =>
        updateGuestPage(weddingId, {
          guestPageStyle: style,
          welcomeMessage: f.welcomeMessage,
          dressCode: f.dressCode,
          travelInfo: f.travelInfo,
          accommodationInfo: f.accommodationInfo,
          contactName: f.contactName,
          contactPhone: f.contactPhone,
          contactEmail: f.contactEmail,
          rsvpDeadline: f.rsvpDeadline,
          faq: faq
            .filter((q) => q.question.trim() && q.answer.trim())
            .map(({ question, answer }) => ({ question, answer })),
          registry: registry
            .filter((r) => r.label.trim() || r.url.trim())
            .map(({ label, url }) => ({ label: label.trim() || "Registry", url })),
        }),
      "Guest page saved ✨",
    );
  }

  const setItem = (key: number, patch: Partial<FaqItem>) =>
    setFaq((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Style</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Guest page style">
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={style === s.value}
                onClick={() => setStyle(s.value)}
                className={cn(
                  "space-y-2 rounded-xl border-2 p-3 text-left transition-colors hover:bg-muted",
                  style === s.value ? "border-foreground" : "border-transparent bg-muted/50",
                )}
              >
                {s.preview}
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.description}</span>
              </button>
            ))}
          </div>
        </div>
        <TextareaField
          name="welcomeMessage"
          label="Welcome message"
          defaultValue={content.welcomeMessage ?? ""}
          placeholder="We can't wait to celebrate with you! Here's everything you need to know…"
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="dressCode" label="Dress code" defaultValue={content.dressCode ?? ""} placeholder="Garden formal" />
          <Field name="rsvpDeadline" label="RSVP by" type="date" defaultValue={content.rsvpDeadline ?? ""} />
        </div>
        <TextareaField
          name="travelInfo"
          label="Getting there"
          defaultValue={content.travelInfo ?? ""}
          placeholder="Nearest airports, parking, shuttles…"
          rows={3}
        />
        <TextareaField
          name="accommodationInfo"
          label="Where to stay"
          defaultValue={content.accommodationInfo ?? ""}
          placeholder="Hotel blocks, booking codes, nearby options…"
          rows={3}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">Contact for questions</p>
          <p className="text-xs text-muted-foreground">
            Shown on the guest page so guests know who to ask. Leave the name empty to hide it.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              name="contactName"
              label="Name"
              defaultValue={content.contactName ?? ""}
              placeholder="e.g. Jamie, our planner"
            />
            <PhoneField name="contactPhone" label="Phone" defaultValue={content.contactPhone ?? ""} />
            <Field name="contactEmail" label="Email" type="email" defaultValue={content.contactEmail ?? ""} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Registry</p>
          {registry.map((r) => (
            <div key={r.key} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input
                value={r.label}
                onChange={(e) =>
                  setRegistry((list) => list.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)))
                }
                placeholder="Name, e.g. Zola"
                aria-label="Registry name"
                className="sm:w-48"
              />
              <Input
                value={r.url}
                onChange={(e) =>
                  setRegistry((list) => list.map((x) => (x.key === r.key ? { ...x, url: e.target.value } : x)))
                }
                placeholder="Link, e.g. zola.com/registry/…"
                aria-label="Registry link"
                inputMode="url"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove registry"
                onClick={() => setRegistry((list) => list.filter((x) => x.key !== r.key))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-dashed"
            onClick={() => setRegistry((list) => [...list, { key: Date.now(), label: "", url: "" }])}
          >
            <Plus /> Add a registry
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">FAQ</p>
          {faq.map((q) => (
            <div key={q.key} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <Input
                  value={q.question}
                  onChange={(e) => setItem(q.key, { question: e.target.value })}
                  placeholder="Question, e.g. Can I bring my kids?"
                  aria-label="FAQ question"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove question"
                  onClick={() => setFaq((list) => list.filter((x) => x.key !== q.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              <Textarea
                value={q.answer}
                onChange={(e) => setItem(q.key, { answer: e.target.value })}
                placeholder="Answer"
                aria-label="FAQ answer"
                rows={2}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-dashed"
            onClick={() => setFaq((list) => [...list, { key: Date.now(), question: "", answer: "" }])}
          >
            <Plus /> Add a question
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        {!disabled && (
          <Button type="submit" disabled={pending}>
            Save guest page
          </Button>
        )}
        {previewHref ? (
          <Button asChild variant="outline">
            <a href={previewHref} target="_blank" rel="noreferrer">
              <ExternalLink /> Preview as a guest
            </a>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Add a household to preview the guest page.</span>
        )}
      </div>
    </form>
  );
}
