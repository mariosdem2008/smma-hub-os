# Stripe Webhook Setup

**Required for:** Gate 1 (technical blockers) + Gate 4 (billing)
**Time to complete:** ~10 minutes
**Who does it:** Agency owner / developer with Stripe + Supabase access
**ICP/pricing authority:** [00-ICP-AND-POSITIONING](00-ICP-AND-POSITIONING.md)

---

## Why This Is Blocking

The `stripe-webhook` edge function validates incoming events using a signing secret (`STRIPE_WEBHOOK_SECRET`). Without it, every incoming Stripe event is rejected with "Webhook signature missing" and subscriptions will fail silently — upgrades won't activate, cancellations won't downgrade, and payment failures won't be flagged.

## What the Webhook Handles

The `supabase/functions/stripe-webhook/index.ts` function listens for:
- `checkout.session.completed` — activates a subscription after checkout
- `customer.subscription.created` / `customer.subscription.updated` — syncs plan tier to `agency_subscriptions` table
- `customer.subscription.deleted` — marks the paid subscription cancelled and moves the account into a billing-required state
- `invoice.payment_failed` — flags the account for payment failure

## Setup Steps

### Step 1: Add the webhook endpoint in Stripe

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **+ Add endpoint**
3. Enter the endpoint URL:
   ```
   https://dbclmdeowohzmwtkktsa.supabase.co/functions/v1/stripe-webhook
   ```
4. Under **Events to listen to**, select:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**

### Step 2: Copy the signing secret

1. Click on the webhook endpoint you just created
2. Under **Signing secret**, click **Reveal**
3. Copy the value — it starts with `whsec_`

### Step 3: Add the secret to Supabase

1. Go to [Supabase Dashboard → Project `dbclmdeowohzmwtkktsa` → Edge Functions](https://supabase.com/dashboard/project/dbclmdeowohzmwtkktsa/functions)
2. Click **Secrets** in the left sidebar
3. Click **+ New secret**
4. Name: `STRIPE_WEBHOOK_SECRET`
5. Value: paste the `whsec_` value from Step 2
6. Click **Save**

> **Note:** `STRIPE_SECRET_KEY` should already be set as a secret from your initial Stripe integration. If not, add it too — find it in Stripe Dashboard → Developers → API keys → Secret key (starts with `sk_live_` or `sk_test_`).

### Step 4: Verify

1. In the Stripe Dashboard, click **Send test webhook** on your endpoint
2. Select `checkout.session.completed`
3. Check Supabase Edge Function logs — you should see `Received event: checkout.session.completed` with no errors

---

## Local Testing

For local development with Stripe CLI:

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

The CLI will output a different `whsec_` secret for local testing — use that in your local `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## After Setup

Once the webhook is configured and verified:
- Update `docs/BETA_READINESS.md` Gate 1: check off **Stripe webhook secret configured**
- Update Gate 4 billing items as you test the EUR199 / EUR349 / EUR499 checkout flows
