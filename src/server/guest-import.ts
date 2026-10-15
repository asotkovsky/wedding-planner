import "server-only";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subEventInvites, subEvents, weddings } from "@/db/schema";
import { aiErrorMessage, anthropic, MODEL } from "./ai";
import { UserError, type Ctx } from "./core";
import { createHousehold, listHouseholds } from "./guests";

/** Roughly 500+ guests; longer lists can be imported in parts. */
export const MAX_IMPORT_CHARS = 60_000;

// What the model fills in. Structured output caps how many fields can be nullable, so unknown
// text is an empty string and an unknown side is "unknown"; tidy() turns those into nulls.
const text = z.string();
const importedGuest = z.object({
  firstName: text,
  lastName: text,
  email: text,
  phone: text,
  side: z.enum(["partner1", "partner2", "both", "unknown"]),
  ageGroup: z.enum(["adult", "child", "infant"]),
  dietaryRestrictions: text,
  notes: text.describe("Anything else the list says about them, e.g. 'needs wheelchair access'"),
  bringsPlusOne: z.boolean().describe("Brings an unnamed companion: '+1', 'and guest', 'and her husband'"),
  rsvp: z.enum(["attending", "declined", "pending"]),
  meal: text.describe("Their meal choice, if the list gives one"),
});
const importedHousehold = z.object({
  name: text.describe("e.g. 'Jane & John Smith', 'The Garcia Family', 'Jordan Lee'"),
  email: text,
  phone: text,
  addressLine1: text,
  addressLine2: text,
  city: text,
  region: text.describe("State / province"),
  postalCode: text,
  country: text,
  notes: text,
  guests: z.array(importedGuest),
});
const importResult = z.object({
  households: z.array(importedHousehold),
  remarks: text.describe(
    "One short sentence on anything the couple needs to fix or decide (a meal not on the menu, a broken email, a missing name). Don't explain routine choices. Empty if nothing.",
  ),
});

const orNull = (v: string) => v.trim() || null;
const validEmail = (v: string) => (z.email().safeParse(v.trim()).success ? v.trim() : null);

/** Empty strings to nulls, broken emails dropped, nameless guests removed. */
function tidy(h: z.infer<typeof importedHousehold>) {
  return {
    name: h.name.trim(),
    email: validEmail(h.email),
    phone: orNull(h.phone),
    addressLine1: orNull(h.addressLine1),
    addressLine2: orNull(h.addressLine2),
    city: orNull(h.city),
    region: orNull(h.region),
    postalCode: orNull(h.postalCode),
    country: orNull(h.country),
    notes: orNull(h.notes),
    guests: h.guests
      .filter((g) => g.firstName.trim() || g.lastName.trim())
      .map((g) => ({
        firstName: orNull(g.firstName),
        lastName: orNull(g.lastName),
        email: validEmail(g.email),
        phone: orNull(g.phone),
        side: g.side === "unknown" ? null : g.side,
        ageGroup: g.ageGroup,
        dietaryRestrictions: orNull(g.dietaryRestrictions),
        notes: orNull(g.notes),
        bringsPlusOne: g.bringsPlusOne,
        rsvp: g.rsvp,
        meal: g.rsvp === "declined" ? null : orNull(g.meal),
      })),
  };
}

export type ImportedHousehold = ReturnType<typeof tidy>;
export type GuestListReading = {
  households: (ImportedHousehold & { alreadyOnList: string[] })[];
  remarks: string | null;
};

const LINES_PER_PART = 25;
const PARALLEL_PARTS = 6;

/** Splits a long list into parts, keeping continuation lines ("  + their daughter") with the line above. */
function splitList(list: string) {
  const parts: string[][] = [[]];
  for (const line of list.split("\n")) {
    const current = parts[parts.length - 1];
    const continues = /^[\s+&-]/.test(line);
    if (current.length >= LINES_PER_PART && !continues && line.trim()) parts.push([line]);
    else current.push(line);
  }
  return parts.map((p) => p.join("\n"));
}

const fullName = (g: { firstName: string | null; lastName: string | null }) =>
  [g.firstName, g.lastName].filter(Boolean).join(" ").trim().toLowerCase();

/**
 * Reads a guest list in any shape (CSV, a spreadsheet paste, notes, an email) into households.
 * Nothing is saved: the couple reviews the result and then calls importHouseholds.
 */
export async function readGuestList(ctx: Ctx, text: string): Promise<GuestListReading> {
  const list = text.trim();
  if (!list) throw new UserError("Paste a guest list or choose a file first.");
  if (list.length > MAX_IMPORT_CHARS) {
    throw new UserError("That list is too long to read in one go. Try importing it in a few parts.");
  }
  const [[wedding], existing, events] = await Promise.all([
    db
      .select({ partner1: weddings.partner1Name, partner2: weddings.partner2Name })
      .from(weddings)
      .where(eq(weddings.id, ctx.weddingId)),
    listHouseholds(ctx),
    db.select({ mealOptions: subEvents.mealOptions }).from(subEvents).where(eq(subEvents.weddingId, ctx.weddingId)),
  ]);
  const mealOptions = [...new Set(events.flatMap((e) => e.mealOptions))];
  const instructions = `You turn a wedding guest list into households for ${wedding.partner1} & ${wedding.partner2}'s wedding planner.

- A household is a party that shares one invitation: a couple, a family, people at the same address, or people the list groups together. Anyone on their own is their own household.
- Use an empty string for anything the list doesn't say, and side "unknown" when it doesn't say whose side.
- Copy only what the list says. Never invent emails, phones, addresses or names. Family members listed together may share the family's last name.
- Only use complete email addresses (name@domain.tld). Leave out one that looks broken and mention it in remarks.
- side: "partner1" for ${wedding.partner1}'s side, "partner2" for ${wedding.partner2}'s side, "both" if shared. Use "unknown" when the list doesn't say or it's ambiguous (e.g. "bride's side" when you can't tell who that is).
- ageGroup: "child" for kids, "infant" for babies, otherwise "adult".
- Someone coming with an unnamed companion ("+1", "and guest", "and her husband") gets bringsPlusOne; don't add the companion as a guest. A named partner or child is their own guest.
- Other details about a guest (access needs, relationship, "VIP") go in their notes.
- rsvp: "attending" if the list says they're coming (yes, accepted, attending), "declined" if not (no, regrets, can't make it), otherwise "pending" (maybe, no response, blank). A plus-one shares the reply of the guest they come with unless the list says otherwise.
- meal: ${mealOptions.length ? `the meal options are ${mealOptions.join(", ")}. Use the exact option name when their choice clearly matches one; otherwise copy what the list says.` : "copy what the list says."}
- Contact details shared by the household (one email or address for the family) go on the household; personal ones go on the guest.
- Ignore header rows, totals, blank lines and anything that isn't a guest. Keep the list's order.`;

  // Long lists are read in parts at the same time; writing out a few hundred households in one
  // reply would take minutes. Every part after the first gets the list's first line, which is
  // usually the column headers.
  const chunks = splitList(list);
  const firstLine = list.split("\n", 1)[0];
  const readPart = async (i: number) => {
    const { output } = await generateText({
      model: anthropic(MODEL),
      output: Output.object({ schema: importResult }),
      maxOutputTokens: 32_000,
      providerOptions: { anthropic: { effort: "low" } satisfies AnthropicLanguageModelOptions },
      instructions:
        i === 0
          ? instructions
          : `${instructions}\n\nThis is part ${i + 1} of a longer list. Its first line, for reference only (don't add it again): ${firstLine}`,
      prompt: chunks[i],
    });
    return output;
  };
  const outputs: z.infer<typeof importResult>[] = [];
  try {
    // At most a few parts at a time, to stay within API rate limits.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_PARTS, chunks.length) }, async () => {
        while (next < chunks.length) {
          const i = next++;
          outputs[i] = await readPart(i);
        }
      }),
    );
  } catch (e) {
    console.error("[guest-import]", e);
    throw new UserError(aiErrorMessage(e, "Your planner couldn't read that list just now. Please try again."));
  }
  const output = {
    households: outputs.flatMap((o) => o.households),
    remarks: outputs.map((o) => o.remarks.trim()).filter(Boolean).join(" "),
  };

  const known = new Set(existing.flatMap((h) => h.guests.map(fullName)).filter(Boolean));
  const households = output.households
    .map(tidy)
    .filter((h) => h.guests.length > 0)
    .map((h) => ({ ...h, alreadyOnList: h.guests.filter((g) => known.has(fullName(g))).map(fullName) }));

  return { households, remarks: orNull(output.remarks) };
}

// The replies come back from the browser, so they're checked again here (createHousehold checks the rest).
const replies = z.array(
  z.object({
    guests: z.array(
      z.object({
        rsvp: z.enum(["attending", "declined", "pending"]).catch("pending"),
        meal: z.string().trim().max(100).nullish().catch(null),
      }),
    ),
  }),
);

/**
 * Adds the households the couple confirmed, inviting everyone to the chosen events and recording
 * any replies from the list. A meal is only saved for an event that offers it.
 */
export async function importHouseholds(ctx: Ctx, households: ImportedHousehold[], subEventIds: string[]) {
  if (households.length > 1000) throw new UserError("That's a lot of households! Please import them in parts.");
  const listReplies = replies.parse(households);
  const events = subEventIds.length
    ? await db
        .select({ id: subEvents.id, mealOptions: subEvents.mealOptions })
        .from(subEvents)
        .where(and(eq(subEvents.weddingId, ctx.weddingId), inArray(subEvents.id, subEventIds)))
    : [];

  const added: string[] = [];
  const failed: string[] = [];
  let guestCount = 0;
  // Guest ids grouped by the reply to record: "eventId|status|meal".
  const toRecord = new Map<string, string[]>();
  for (const [i, h] of households.entries()) {
    try {
      const r = await createHousehold(ctx, { ...h, subEventIds });
      added.push(r.name);
      guestCount += r.guestIds.length + r.plusOneIds.length;
      const record = (key: string, guestId: string) => toRecord.set(key, [...(toRecord.get(key) ?? []), guestId]);
      // Unnamed +1s were created in the same order as the guests bringing them.
      let plusOne = 0;
      listReplies[i].guests.forEach((g, j) => {
        const plusOneId = h.guests[j].bringsPlusOne ? r.plusOneIds[plusOne++] : undefined;
        if (g.rsvp === "pending") return;
        for (const e of events) {
          const meal =
            g.rsvp === "attending" ? e.mealOptions.find((m) => m.toLowerCase() === g.meal?.toLowerCase()) : undefined;
          record(`${e.id}|${g.rsvp}|${meal ?? ""}`, r.guestIds[j]);
          // A +1 shares their guest's reply; their meal is picked when they're named on the RSVP page.
          if (plusOneId) record(`${e.id}|${g.rsvp}|`, plusOneId);
        }
      });
    } catch (e) {
      if (!(e instanceof UserError || e instanceof z.ZodError)) throw e;
      failed.push(h.name);
    }
  }

  for (const [key, guestIds] of toRecord) {
    const [subEventId, status, meal] = key.split("|") as [string, "attending" | "declined", string];
    await db
      .update(subEventInvites)
      .set({ status, mealChoice: meal || null, respondedAt: new Date() })
      .where(
        and(
          eq(subEventInvites.weddingId, ctx.weddingId),
          eq(subEventInvites.subEventId, subEventId),
          inArray(subEventInvites.guestId, guestIds),
        ),
      );
  }
  return { added: added.length, guests: guestCount, failed };
}
