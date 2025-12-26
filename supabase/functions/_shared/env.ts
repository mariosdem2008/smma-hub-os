/**
 * Shared environment configuration for Supabase Edge Functions
 * Supports both production and local development environments
 */

// Supabase configuration (from environment variables)
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Environment detection
// - Prefer explicit ENV if set (local/prod)
// - Otherwise infer from SUPABASE_URL (local dev uses localhost/127.0.0.1)
const EXPLICIT_ENV = Deno.env.get("ENV");
export const IS_LOCAL =
  EXPLICIT_ENV === "local" ||
  (!EXPLICIT_ENV && (SUPABASE_URL.includes("localhost") || SUPABASE_URL.includes("127.0.0.1")));
export const IS_PROD = EXPLICIT_ENV === "prod" || (!EXPLICIT_ENV && !IS_LOCAL);
export const ENV = (IS_LOCAL ? "local" : "prod") as "local" | "prod";

// Public URL for the application (for redirects, webhooks, etc.)
export const PUBLIC_URL = IS_LOCAL
  ? "http://localhost:5173"
  : (Deno.env.get("PUBLIC_URL") || "https://smmahub.net");

// Meta OAuth redirect URI
export const META_REDIRECT_URI = Deno.env.get("META_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/social-oauth-callback`;

// Helper to get storage URL
export const getStorageUrl = (bucket: string, path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

// Stripe webhook URL
export const getStripeWebhookUrl = () => `${SUPABASE_URL}/functions/v1/stripe-webhook`;

// Meta OAuth callback URL
export const getMetaCallbackUrl = () => META_REDIRECT_URI;
