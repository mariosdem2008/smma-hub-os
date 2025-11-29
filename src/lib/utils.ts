import { parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Convert Local Zoned Date → UTC ISO string for DB storage
 */
export function convertToUTC(localDate: Date, timezone: string): string {
  try {
    // Convert local date in user's timezone → pure UTC date
    const utcDate = fromZonedTime(localDate, timezone);

    // Return ISO string for DB storage
    return utcDate.toISOString();
  } catch (error) {
    console.error("Error converting to UTC:", error);
    return localDate.toISOString();
  }
}

/**
 * Convert UTC ISO string → Local Zoned Date for UI display
 */
export function convertToLocal(utcString: string, timezone: string): Date {
  try {
    // Parse UTC string WITHOUT shifting (safe)
    const utcDate = parseISO(utcString);

    // Convert UTC → user's timezone
    return toZonedTime(utcDate, timezone);
  } catch (error) {
    console.error("Error converting to local:", error);
    return parseISO(utcString);
  }
}

/**
 * Get list of common timezones
 */
export function getTimezoneList(): string[] {
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
    "Pacific/Auckland"
  ];
}

/**
 * Merge Tailwind classes
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
