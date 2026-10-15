/**
 * US-style phone formatting: 555-555-5555. Numbers starting with "+" (international) and
 * anything that isn't 10 digits (extensions, short codes) are left as entered.
 */
export function formatPhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return trimmed;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Formats while typing: "555", "555-555", "555-555-5555" (a leading 1 shows as "1 555-…"). */
export function formatPhoneAsTyped(value: string) {
  if (value.trimStart().startsWith("+")) return value;
  const all = value.replace(/\D/g, "");
  // US area codes never start with 1, so a leading 1 is the country code.
  const prefix = all.startsWith("1") ? "1 " : "";
  const digits = prefix ? all.slice(1) : all;
  // More than 10 digits (e.g. an extension): stop formatting rather than drop digits.
  if (digits.length > 10) return value;
  if (digits.length <= 3) return prefix ? `1 ${digits}`.trimEnd() : digits;
  if (digits.length <= 6) return `${prefix}${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${prefix}${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
