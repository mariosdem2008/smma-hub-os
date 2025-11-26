// Platform-specific optimal posting times and scheduling rules

export interface PostingTimeSlot {
  day: string;
  startHour: number;
  endHour: number;
  label: string;
}

export interface PlatformSchedulingRules {
  platform: string;
  optimalTimes: PostingTimeSlot[];
  bestPractices: string[];
  peakEngagementDays: string[];
}

export const platformSchedulingRules: Record<string, PlatformSchedulingRules> = {
  instagram: {
    platform: "Instagram",
    optimalTimes: [
      { day: "Monday-Friday", startHour: 11, endHour: 13, label: "Lunch Break (11 AM - 1 PM)" },
      { day: "Monday-Friday", startHour: 19, endHour: 21, label: "Evening (7 PM - 9 PM)" },
      { day: "Wednesday", startHour: 11, endHour: 13, label: "Wednesday Midday Peak" },
      { day: "Friday", startHour: 10, endHour: 11, label: "Friday Morning" },
    ],
    bestPractices: [
      "Post during lunch breaks and evening hours",
      "Wednesday at 11 AM typically sees highest engagement",
      "Avoid posting between 3-4 PM when engagement dips",
      "Stories perform best in the morning (7-9 AM)",
    ],
    peakEngagementDays: ["Wednesday", "Friday"],
  },
  facebook: {
    platform: "Facebook",
    optimalTimes: [
      { day: "Monday-Friday", startHour: 13, endHour: 15, label: "Early Afternoon (1 PM - 3 PM)" },
      { day: "Wednesday", startHour: 11, endHour: 13, label: "Wednesday Midday" },
      { day: "Thursday-Friday", startHour: 13, endHour: 16, label: "Thursday-Friday Afternoon" },
    ],
    bestPractices: [
      "Post between 1-3 PM on weekdays for maximum reach",
      "Thursday and Friday afternoons see high engagement",
      "Avoid posting late at night (after 10 PM)",
      "Video content performs best in early afternoon",
    ],
    peakEngagementDays: ["Wednesday", "Thursday", "Friday"],
  },
  tiktok: {
    platform: "TikTok",
    optimalTimes: [
      { day: "Tuesday", startHour: 9, endHour: 10, label: "Tuesday Morning" },
      { day: "Thursday", startHour: 12, endHour: 13, label: "Thursday Noon" },
      { day: "Friday", startHour: 17, endHour: 18, label: "Friday Evening" },
      { day: "Monday-Friday", startHour: 18, endHour: 22, label: "Evening Peak (6 PM - 10 PM)" },
    ],
    bestPractices: [
      "Post during evening hours when users are most active",
      "Tuesday, Thursday, and Friday see highest engagement",
      "Short-form content (15-30 seconds) performs best",
      "Use trending sounds and hashtags for better reach",
    ],
    peakEngagementDays: ["Tuesday", "Thursday", "Friday"],
  },
  linkedin: {
    platform: "LinkedIn",
    optimalTimes: [
      { day: "Tuesday-Thursday", startHour: 8, endHour: 10, label: "Morning Business Hours (8 AM - 10 AM)" },
      { day: "Tuesday-Wednesday", startHour: 12, endHour: 13, label: "Lunch Break" },
      { day: "Wednesday", startHour: 9, endHour: 10, label: "Wednesday Morning Peak" },
    ],
    bestPractices: [
      "Post during business hours (8 AM - 5 PM)",
      "Tuesday through Thursday see highest engagement",
      "Avoid weekends - engagement drops significantly",
      "Professional content performs best in morning hours",
    ],
    peakEngagementDays: ["Tuesday", "Wednesday", "Thursday"],
  },
  youtube: {
    platform: "YouTube",
    optimalTimes: [
      { day: "Monday-Friday", startHour: 14, endHour: 16, label: "Afternoon (2 PM - 4 PM)" },
      { day: "Thursday-Friday", startHour: 12, endHour: 15, label: "Thursday-Friday Midday" },
      { day: "Weekend", startHour: 9, endHour: 11, label: "Weekend Morning" },
    ],
    bestPractices: [
      "Upload between 2-4 PM on weekdays for maximum views",
      "Thursday and Friday uploads tend to perform best",
      "Weekend mornings (9-11 AM) see high engagement",
      "Consistent upload schedule builds audience loyalty",
    ],
    peakEngagementDays: ["Thursday", "Friday", "Saturday", "Sunday"],
  },
  twitter: {
    platform: "Twitter/X",
    optimalTimes: [
      { day: "Monday-Friday", startHour: 12, endHour: 13, label: "Lunch Hour (12 PM - 1 PM)" },
      { day: "Monday-Friday", startHour: 17, endHour: 18, label: "Evening Commute (5 PM - 6 PM)" },
      { day: "Wednesday", startHour: 9, endHour: 10, label: "Wednesday Morning" },
    ],
    bestPractices: [
      "Post during lunch breaks and evening commutes",
      "Wednesday sees highest engagement overall",
      "Multiple daily posts (3-5) are acceptable",
      "Trending topics and hashtags boost visibility",
    ],
    peakEngagementDays: ["Wednesday", "Friday"],
  },
};

export const getOptimalPostingTimes = (platform: string): PlatformSchedulingRules | null => {
  return platformSchedulingRules[platform.toLowerCase()] || null;
};

export const getSuggestedPostingTime = (platform: string, selectedDate: Date): Date => {
  const rules = getOptimalPostingTimes(platform);
  if (!rules || rules.optimalTimes.length === 0) {
    // Default to 12 PM if no rules found
    const suggestedTime = new Date(selectedDate);
    suggestedTime.setHours(12, 0, 0, 0);
    return suggestedTime;
  }

  // Get the day of week for the selected date
  const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Find the first optimal time slot that matches the day
  const matchingSlot = rules.optimalTimes.find(slot => 
    slot.day.includes(dayOfWeek) || slot.day === "Monday-Friday" || slot.day === "Weekend"
  );

  if (matchingSlot) {
    const suggestedTime = new Date(selectedDate);
    suggestedTime.setHours(matchingSlot.startHour, 0, 0, 0);
    return suggestedTime;
  }

  // Default to noon
  const defaultTime = new Date(selectedDate);
  defaultTime.setHours(12, 0, 0, 0);
  return defaultTime;
};

export const getAllPlatformSuggestions = (platforms: string[], selectedDate: Date) => {
  return platforms.map(platform => {
    const rules = getOptimalPostingTimes(platform);
    const suggestedTime = getSuggestedPostingTime(platform, selectedDate);
    return {
      platform,
      suggestedTime,
      rules,
    };
  });
};
