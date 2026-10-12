import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** "2027-06-12T16:30" in `timeZone` -> UTC instant. */
export function localToUtc(local: string, timeZone: string): Date {
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, day, h, min, 0, timeZone).getTime());
}

/** UTC instant -> "2027-06-12T16:30" in `timeZone`, for datetime-local inputs. */
export function utcToLocal(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** Today's date ("YYYY-MM-DD") in `timeZone`. */
export function todayIn(timeZone: string): string {
  return format(new TZDate(new Date(), timeZone), "yyyy-MM-dd");
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(date);
}

export function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(date);
}
