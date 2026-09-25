/** Phone normalisation to E.164 with libphonenumber, so every layer stores the same identifier. */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

const MOBILE_TYPES = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);

export type NormalizePhoneOptions = {
  /** Country assumed for numbers without a `+` prefix. */
  defaultCountry?: CountryCode;
  /** Reject landlines (needed for WhatsApp or SMS delivery). Countries that do not distinguish keep passing. */
  mobileOnly?: boolean;
};

/** Returns `+919876543210` style E.164, or null when the input is not a valid number. */
export function normalizePhone(raw: string, options: NormalizePhoneOptions = {}): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), options.defaultCountry ?? "IN");
  if (!parsed?.isValid()) return null;
  if (options.mobileOnly) {
    const type = parsed.getType();
    if (type !== undefined && !MOBILE_TYPES.has(type)) return null;
  }
  return parsed.number;
}

/** Lowercase, trimmed email or null when it has no `@`. */
export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return value.includes("@") && value.length <= 254 ? value : null;
}
