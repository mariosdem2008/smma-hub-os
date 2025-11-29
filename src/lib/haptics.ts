/**
 * Haptic feedback utilities for native-like touch interactions
 * Uses Web Vibration API for web, can be extended with Capacitor for native apps
 */

type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const hapticPatterns: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [50, 100, 50, 100, 50],
};

/**
 * Trigger haptic feedback
 * @param style - The type of haptic feedback
 */
export function triggerHaptic(style: HapticStyle = "light") {
  // Check if Vibration API is supported
  if (!("vibrate" in navigator)) {
    return;
  }

  try {
    const pattern = hapticPatterns[style];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if vibration not supported
    console.debug("Haptic feedback not available:", error);
  }
}

/**
 * Haptic feedback for button taps
 */
export function hapticButton() {
  triggerHaptic("light");
}

/**
 * Haptic feedback for selection changes (tabs, toggles)
 */
export function hapticSelection() {
  triggerHaptic("selection");
}

/**
 * Haptic feedback for success actions
 */
export function hapticSuccess() {
  triggerHaptic("success");
}

/**
 * Haptic feedback for errors
 */
export function hapticError() {
  triggerHaptic("error");
}

/**
 * Haptic feedback for warnings
 */
export function hapticWarning() {
  triggerHaptic("warning");
}
