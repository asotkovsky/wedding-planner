import {
  CalendarClock,
  ClipboardCheck,
  House,
  PartyPopper,
  PiggyBank,
  Settings,
  Store,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "./brand";

export type Section = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  tagline: string;
};

// One place for each section's identity: nav, page headers and empty states all use it.
export const SECTIONS = {
  overview: { key: "overview", href: "", label: "Home", icon: House, tone: "brand", title: "Home", tagline: "" },
  guests: {
    key: "guests",
    href: "/guests",
    label: "Guests",
    icon: UsersRound,
    tone: "sky",
    title: "Who's coming?",
    tagline: "Your people, their RSVPs and their meal picks.",
  },
  events: {
    key: "events",
    href: "/events",
    label: "Events",
    icon: PartyPopper,
    tone: "lilac",
    title: "The festivities",
    tagline: "Every part of the celebration guests can RSVP to.",
  },
  vendors: {
    key: "vendors",
    href: "/vendors",
    label: "Vendors",
    icon: Store,
    tone: "peach",
    title: "Your dream team",
    tagline: "The pros making it happen, and what you owe them.",
  },
  budget: {
    key: "budget",
    href: "/budget",
    label: "Budget",
    icon: PiggyBank,
    tone: "mint",
    title: "Money matters",
    tagline: "Committed = booked contracts + expenses. Paid = money out the door.",
  },
  tasks: {
    key: "tasks",
    href: "/tasks",
    label: "Tasks",
    icon: ClipboardCheck,
    tone: "sun",
    title: "To-do list",
    tagline: "Little steps to the big day.",
  },
  timeline: {
    key: "timeline",
    href: "/timeline",
    label: "Day-of",
    icon: CalendarClock,
    tone: "rose",
    title: "Day-of timeline",
    tagline: "The run of show for you, your crew and your vendors.",
  },
  settings: {
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: Settings,
    tone: "gray",
    title: "Settings",
    tagline: "Details, colors and collaborators.",
  },
} satisfies Record<string, Section>;

export type SectionKey = keyof typeof SECTIONS;
export const NAV_ORDER: SectionKey[] = ["overview", "guests", "events", "vendors", "budget", "tasks", "timeline", "settings"];
