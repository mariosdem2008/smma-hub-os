/**
 * Environment configuration for SMMAHUB
 * Supports both production and local development environments
 */

export const ENV = import.meta.env.MODE === "development" ? "local" : "prod";

export const IS_LOCAL = ENV === "local";
export const IS_PROD = ENV === "prod";

// Public URL for the application
export const PUBLIC_URL = IS_LOCAL
  ? "http://localhost:5173"
  : (import.meta.env.VITE_PUBLIC_URL || "https://smmahub.net");

// Supabase configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Helper to get storage URL
export const getStorageUrl = (bucket: string, path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

// API base URL (for edge functions)
export const getApiUrl = () => {
  if (IS_LOCAL) {
    return "http://localhost:54321/functions/v1";
  }
  return `${SUPABASE_URL}/functions/v1`;
};
