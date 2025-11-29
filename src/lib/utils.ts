import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a local datetime string to UTC ISO string for database storage
 * @param localDate - Date object in user's local timezone
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Europe/London')
 * @returns ISO string in UTC
 */
export function convertToUTC(localDate: Date, timezone: string): string {
  try {
    // The Date instance already represents the exact moment picked in the UI
    // in the browser's local timezone. To store it in the DB we only need
    // the UTC instant, which is given by toISOString().
    //
    // We intentionally ignore the `timezone` argument here to avoid
    // double‑applying offsets, which was causing times to shift (e.g. 08:50 → 06:50).
    return localDate.toISOString();
  } catch (error) {
    console.error("Error converting to UTC:", error);
    return localDate.toISOString();
  }
}

/**
 * Convert a UTC ISO string to a Date in user's local timezone
 * @param utcString - UTC ISO string from database
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Europe/London')
 * @returns Date object adjusted for timezone
 */
export function convertToLocal(utcString: string, timezone: string): Date {
  try {
    const utcDate = new Date(utcString);

    // Format the date in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const getValue = (type: string) => parts.find((p) => p.type === type)?.value || "0";

    return new Date(
      parseInt(getValue("year")),
      parseInt(getValue("month")) - 1,
      parseInt(getValue("day")),
      parseInt(getValue("hour")),
      parseInt(getValue("minute")),
      parseInt(getValue("second")),
    );
  } catch (error) {
    console.error("Error converting to local:", error);
    return new Date(utcString);
  }
}

/**
 * Get list of common timezones grouped by region
 */
export function getTimezoneList(): Array<{ label: string; value: string; group: string }> {
  return [
    // UTC
    { label: "UTC (Coordinated Universal Time)", value: "UTC", group: "UTC" },

    // Americas
    { label: "Eastern Time (New York)", value: "America/New_York", group: "Americas" },
    { label: "Central Time (Chicago)", value: "America/Chicago", group: "Americas" },
    { label: "Mountain Time (Denver)", value: "America/Denver", group: "Americas" },
    { label: "Pacific Time (Los Angeles)", value: "America/Los_Angeles", group: "Americas" },
    { label: "Alaska Time (Anchorage)", value: "America/Anchorage", group: "Americas" },
    { label: "Hawaii Time (Honolulu)", value: "Pacific/Honolulu", group: "Americas" },
    { label: "Toronto", value: "America/Toronto", group: "Americas" },
    { label: "Mexico City", value: "America/Mexico_City", group: "Americas" },
    { label: "São Paulo", value: "America/Sao_Paulo", group: "Americas" },
    { label: "Buenos Aires", value: "America/Argentina/Buenos_Aires", group: "Americas" },

    // Europe
    { label: "London", value: "Europe/London", group: "Europe" },
    { label: "Paris", value: "Europe/Paris", group: "Europe" },
    { label: "Berlin", value: "Europe/Berlin", group: "Europe" },
    { label: "Madrid", value: "Europe/Madrid", group: "Europe" },
    { label: "Rome", value: "Europe/Rome", group: "Europe" },
    { label: "Amsterdam", value: "Europe/Amsterdam", group: "Europe" },
    { label: "Brussels", value: "Europe/Brussels", group: "Europe" },
    { label: "Stockholm", value: "Europe/Stockholm", group: "Europe" },
    { label: "Athens", value: "Europe/Athens", group: "Europe" },
    { label: "Moscow", value: "Europe/Moscow", group: "Europe" },

    // Asia
    { label: "Dubai", value: "Asia/Dubai", group: "Asia" },
    { label: "Mumbai", value: "Asia/Kolkata", group: "Asia" },
    { label: "Bangkok", value: "Asia/Bangkok", group: "Asia" },
    { label: "Singapore", value: "Asia/Singapore", group: "Asia" },
    { label: "Hong Kong", value: "Asia/Hong_Kong", group: "Asia" },
    { label: "Shanghai", value: "Asia/Shanghai", group: "Asia" },
    { label: "Tokyo", value: "Asia/Tokyo", group: "Asia" },
    { label: "Seoul", value: "Asia/Seoul", group: "Asia" },

    // Pacific
    { label: "Sydney", value: "Australia/Sydney", group: "Pacific" },
    { label: "Melbourne", value: "Australia/Melbourne", group: "Pacific" },
    { label: "Brisbane", value: "Australia/Brisbane", group: "Pacific" },
    { label: "Auckland", value: "Pacific/Auckland", group: "Pacific" },

    // Africa
    { label: "Cairo", value: "Africa/Cairo", group: "Africa" },
    { label: "Johannesburg", value: "Africa/Johannesburg", group: "Africa" },
    { label: "Lagos", value: "Africa/Lagos", group: "Africa" },
  ];
}
