import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function load(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("billing stripe contract alignment", () => {
  it("uses the same Stripe SDK major and API version across billing edge functions", () => {
    const checkout = load("supabase/functions/create-checkout/index.ts");
    const webhook = load("supabase/functions/stripe-webhook/index.ts");
    const portal = load("supabase/functions/customer-portal/index.ts");
    const checkSubscription = load("supabase/functions/check-subscription/index.ts");

    const expectedImport = "stripe@18.5.0";
    const expectedApiVersion = "2025-08-27.basil";

    expect(checkout).toContain(expectedImport);
    expect(webhook).toContain(expectedImport);
    expect(portal).toContain(expectedImport);
    expect(checkSubscription).toContain(expectedImport);

    expect(checkout).toContain(expectedApiVersion);
    expect(webhook).toContain(expectedApiVersion);
    expect(portal).toContain(expectedApiVersion);
    expect(checkSubscription).toContain(expectedApiVersion);
  });

  it("returns JSON errors from stripe-webhook", () => {
    const webhook = load("supabase/functions/stripe-webhook/index.ts");
    expect(webhook).toContain("JSON.stringify({ error:");
    expect(webhook).toContain("'Content-Type': 'application/json'");
  });

  it("returns JSON errors from create-checkout for auth and validation failures", () => {
    const checkout = load("supabase/functions/create-checkout/index.ts");
    expect(checkout).not.toContain("new Response('Unauthorized'");
    expect(checkout).not.toContain("new Response('Plan type is required'");
    expect(checkout).not.toContain("new Response('Invalid plan type'");
    expect(checkout).not.toContain("new Response('Price not configured'");
    expect(checkout).toContain("JSON.stringify({ error: 'Unauthorized' })");
    expect(checkout).toContain("'Content-Type': 'application/json'");
  });

  it("uses a safe fallback origin for Stripe redirect URLs", () => {
    const checkout = load("supabase/functions/create-checkout/index.ts");
    expect(checkout).toContain("req.headers.get('origin') || PUBLIC_URL || 'http://localhost:5173'");
    expect(checkout).toContain("success_url: `${origin}/billing?success=true`");
    expect(checkout).toContain("cancel_url: `${origin}/pricing?canceled=true`");
  });
});
