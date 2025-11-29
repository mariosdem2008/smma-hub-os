import { parseISO } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

/**
 * Convert Local Zoned Date → UTC ISO string for DB storage
 */
export function convertToUTC(localDate: Date, timezone: string): string {
  try {
    // Convert local date in user's timezone → pure UTC date
    const utcDate = zonedTimeToUtc(localDate, timezone);

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
    return utcToZonedTime(utcDate, timezone);
  } catch (error) {
    console.error("Error converting to local:", error);
    return parseISO(utcString);
  }
}

/**
 * Merge Tailwind classes
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
