# A8 — Environment and Configuration (Current Truth)

## Purpose
Inventory environment variables, feature flags, model configuration, and edge function configs that affect AI behavior. This matters because missing secrets or misconfigured `verify_jwt` and timeouts are common production failure causes.

## Key Findings Summary
- AI features rely on secrets such as `OPENAI_API_KEY` (and potentially other provider keys) being set in the edge environment.
- Many AI behaviors are controlled via env vars (model IDs, embedding model IDs, strict schema flags, etc.).
- Edge functions have per-function `config.toml` settings including `verify_jwt`.
- Model selection supports env override patterns (see router/task policy code and tests).

## Detailed Analysis
### Required vs optional env vars
- `OPENAI_API_KEY` is required for embeddings and OpenAI provider calls.
- Embedding model ID is configurable (defaults observed in code).

### Edge function config
- Each function may include `config.toml` controlling auth verification.

### Model configuration
- Task models are selected via policy and can be overridden by env.

## Code Evidence
### API key references in TS (`rg -n "OPENAI_API_KEY|ANTHROPIC_API_KEY|API_KEY" --type ts`)

```text
tests\integration\ai\embedding-fail-hard.test.ts:5:  it("throws MISSING_API_KEY when fail-hard is on and key is missing", async () => {
tests\integration\ai\embedding-fail-hard.test.ts:11:    })).rejects.toMatchObject({ code: "MISSING_API_KEY" });
tests\integration\ai\embedding-fail-hard.test.ts:34:    expect(result.errorCode).toBe("MISSING_API_KEY");
src\ai\providers\openai.ts:12:  return getEnvVar("OPENAI_API_KEY");
src\ai\providers\openai.ts:159:    throw new Error("OPENAI_API_KEY is not configured");
src\ai\providers\openai.ts:317:    throw new Error("OPENAI_API_KEY is not configured");
src\ai\providers\openai.ts:485:    throw new Error("OPENAI_API_KEY is not configured");
src\ai\providers\gemini.ts:11:  return getEnvVar("GEMINI_API_KEY");
src\ai\providers\gemini.ts:109:    throw new Error("GEMINI_API_KEY is not configured");
src\ai\providers\anthropic.ts:11:  return getEnvVar("ANTHROPIC_API_KEY");
src\ai\providers\anthropic.ts:85:    throw new Error("ANTHROPIC_API_KEY is not configured");
src\hooks\useStrategyModules.ts:269:        if (payload?.code === 'MISSING_API_KEY') {
src\hooks\useStrategyDocuments.ts:84:        if (payload?.code === "MISSING_API_KEY") {
supabase\functions\generate-ai-content\index.ts:186:    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
supabase\functions\generate-ai-content\index.ts:187:    if (!OPENAI_API_KEY) {
supabase\functions\_shared\embedding-policy.ts:19:      const error = new Error("OPENAI_API_KEY is not configured") as Error & { code?: string };
supabase\functions\_shared\embedding-policy.ts:20:      error.code = "MISSING_API_KEY";
supabase\functions\_shared\embedding-policy.ts:23:    return { status: "failed", errorCode: "MISSING_API_KEY" };
supabase\functions\ai-brain-ingest\index.ts:238:        const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-brain-ingest\index.ts:268:            if (error?.code === "MISSING_API_KEY") {
supabase\functions\ai-brain-ingest\index.ts:269:              return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
supabase\functions\ai-brain-ingest\index.ts:351:      const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-brain-ingest\index.ts:381:          if (error?.code === "MISSING_API_KEY") {
supabase\functions\ai-brain-ingest\index.ts:382:            return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
supabase\functions\ai-documents-ingest\index.ts:192:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-documents-ingest\index.ts:224:      if (error?.code === "MISSING_API_KEY") {
supabase\functions\ai-documents-ingest\index.ts:225:        return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
supabase\functions\ai-onboarding-guide\index.ts:680:    const openaiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-onboarding-guide\index.ts:682:      console.error("CRITICAL: OPENAI_API_KEY not set");
supabase\functions\ai-ask\index.ts:308:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-rep-chat\index.ts:23:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-retrieve-context\index.ts:121:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\send-waitlist-email\index.ts:3:const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
supabase\functions\send-waitlist-email\index.ts:34:        "api-key": BREVO_API_KEY || "",
supabase\functions\_shared\agency-admin-general-ai.ts:489:    const embeddingApiKey = typeof Deno !== "undefined" ? Deno.env.get("OPENAI_API_KEY") : process.env.OPENAI_API_KEY;
supabase\functions\client-auth-forgot-password\index.ts:60:    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
supabase\functions\client-auth-forgot-password\index.ts:67:        Authorization: `Bearer ${RESEND_API_KEY}`,
supabase\functions\ai-strategy-generate\index.ts:355:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase\functions\ai-strategy-generate\index.ts:380:      metadata: { code: "MISSING_API_KEY" },
supabase\functions\ai-strategy-generate\index.ts:382:    console.error("OPENAI_API_KEY not configured");
supabase\functions\ai-strategy-generate\index.ts:386:        message: "Please configure OPENAI_API_KEY in your Supabase project secrets before generating strategies.",
supabase\functions\ai-strategy-generate\index.ts:387:        code: "MISSING_API_KEY",
supabase\functions\generate-monthly-report\index.ts:151:    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
supabase\functions\generate-monthly-report\index.ts:155:    if (OPENAI_API_KEY) {
supabase\functions\notify-assigned-editor\index.ts:41:    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
supabase\functions\notify-assigned-editor\index.ts:42:    const resendApiKey = Deno.env.get("RESEND_API_KEY");
supabase\functions\send-approval-notification\index.ts:5:const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
supabase\functions\send-approval-notification\index.ts:241:          'Authorization': `Bearer ${RESEND_API_KEY}`,
supabase\functions\send-approval-notification\index.ts:389:          'Authorization': `Bearer ${RESEND_API_KEY}`,
supabase\functions\send-approval-notification\index.ts:519:        "Authorization": `Bearer ${RESEND_API_KEY}`,
supabase\functions\_shared\brain-documents.ts:631:      ? Deno.env.get("OPENAI_API_KEY")
supabase\functions\_shared\brain-documents.ts:633:      ? process.env.OPENAI_API_KEY
supabase\functions\send-team-invite\index.ts:6:const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
supabase\functions\send-portal-invite\index.ts:4:const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
supabase\functions\send-portal-invite\index.ts:145:  if (!resendApiKey) missingEnv.push("RESEND_API_KEY");
```

### Env access in edge functions (first 50 matches)

```text
supabase/functions\add-client-user-to-conversation\index.ts:5:const CLIENT_PORTAL_JWT_SECRET = Deno.env.get('CLIENT_PORTAL_JWT_SECRET');
supabase/functions\ai-ask\index.ts:109:  const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
supabase/functions\ai-ask\index.ts:143:  const ragModelId = Deno.env.get("RAG_MODEL_ID") ?? "gpt-5-mini";
supabase/functions\ai-ask\index.ts:308:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-ask\index.ts:346:  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-brain-ingest\index.ts:114:  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
supabase/functions\ai-brain-ingest\index.ts:238:        const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-brain-ingest\index.ts:239:        const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-brain-ingest\index.ts:351:      const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-brain-ingest\index.ts:352:      const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-brain-analyze\index.ts:71:    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
supabase/functions\ai-brain-analyze\index.ts:72:    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
supabase/functions\ai-job-worker\index.ts:67:  const batchSize = Number(Deno.env.get("AI_JOB_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);
supabase/functions\ai-job-worker\index.ts:76:  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
supabase/functions\ai-documents-ingest\index.ts:46:  const lockdownEnabled = Deno.env.get("AI_LOCKDOWN_UNUSED_ENDPOINTS") === "true";
supabase/functions\ai-documents-ingest\index.ts:108:  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
supabase/functions\ai-documents-ingest\index.ts:192:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-documents-ingest\index.ts:193:  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-onboarding-guide\index.ts:680:    const openaiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-onboarding-scan\index.ts:363:    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
supabase/functions\ai-onboarding-scan\index.ts:364:    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
supabase/functions\ai-onboarding-suggest\index.ts:211:    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
supabase/functions\ai-onboarding-suggest\index.ts:212:    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
supabase/functions\ai-retrieve-context\index.ts:29:  const lockdownEnabled = Deno.env.get("AI_LOCKDOWN_UNUSED_ENDPOINTS") === "true";
supabase/functions\ai-retrieve-context\index.ts:121:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-retrieve-context\index.ts:126:  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\client-auth-forgot-password\index.ts:60:    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
supabase/functions\ai-strategy-generate\index.ts:153:  const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
supabase/functions\ai-strategy-generate\index.ts:157:  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
supabase/functions\ai-strategy-generate\index.ts:355:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-strategy-generate\index.ts:394:  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-strategy-generate\index.ts:645:      model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
supabase/functions\ai-strategy-generate\index.ts:659:    const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
supabase/functions\ai-strategy-generate\index.ts:761:    p_model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
supabase/functions\ai-strategy-generate\index.ts:773:      model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
supabase/functions\ai-strategy-generate\index.ts:787:  const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
supabase/functions\ai-rep-chat\index.ts:23:  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
supabase/functions\ai-rep-chat\index.ts:27:    const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
supabase/functions\ai-rep-chat\index.ts:133:    model: Deno.env.get("CHAT_MODEL_ID") ?? "mapping-only",
supabase/functions\check-subscription\index.ts:36:    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
supabase/functions\client-auth-login\index.ts:5:const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
supabase/functions\client-auth-reset-password\index.ts:5:const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
supabase/functions\client-auth-signup\index.ts:5:const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
supabase/functions\generate-ai-content\index.ts:186:    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
supabase/functions\create-checkout\index.ts:6:const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
supabase/functions\generate-monthly-report\index.ts:151:    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
supabase/functions\list-conversations\index.ts:28:const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
supabase/functions\customer-portal\index.ts:22:    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
supabase/functions\send-team-invite\index.ts:6:const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
supabase/functions\send-team-invite\index.ts:8:const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
```

### All AI function `config.toml` files

```toml
=== supabase\functions\ai-strategy-generate\config.toml ===
verify_jwt = false


=== supabase\functions\client-auth-login\config.toml ===
verify_jwt = false

=== supabase\functions\client-auth-logout\config.toml ===
verify_jwt = false

=== supabase\functions\client-auth-reset-password\config.toml ===
verify_jwt = false

=== supabase\functions\client-auth-signup\config.toml ===
verify_jwt = false

=== supabase\functions\client-auth-validate-invite\config.toml ===
verify_jwt = false

=== supabase\functions\client-refresh-token\config.toml ===
verify_jwt = false

```

### Env example file

```dotenv
# ============================================
# SMMAHUB Environment Variables
# ============================================
# Copy this file to .env and fill in your values
# For local development, also create .env.local

# ============================================
# PUBLIC URL
# ============================================
# Production: https://smmahub.net
# Local: http://localhost:5173
VITE_PUBLIC_URL=https://smmahub.net

# ============================================
# SUPABASE CONFIGURATION
# ============================================
# These are automatically set by your deployment platform
# For local development, use your local Supabase values

VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key" # fallback if ANON not provided

# ============================================
# LOCAL DEVELOPMENT (Optional)
# ============================================
# Run `supabase start` to get these values
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key

# ============================================
# NOTES
# ============================================
# - All secrets (STRIPE_SECRET_KEY, OPENAI_API_KEY, etc.)
#   are stored in Supabase/deployment platform secrets
# - Do NOT commit actual keys to version control
# - The frontend only needs VITE_* prefixed variables

# ============================================
# AI PROVIDERS (Server-side / Edge)
# ============================================
# GEMINI_API_KEY=your-gemini-api-key
# AI_PROVIDER=gemini
# AI_TEXT_MODEL_DEFAULT=gemini-1.5-flash
# AI_EMBED_DIM_EXPECTED=1536
# ENABLE_UNUSED_AI_ENDPOINTS=false
```

### Model references (first 30 matches)

```text
src\ai\budgets.ts:24:function pickPricing(model: string) {
src\ai\budgets.ts:32:  model: string,
src\ai\logging.ts:11:  model: string;
src\ai\logging.ts:28:    model: input.model,
src\ai\modelTypes.ts:16:  model: string;
src\ai\modelPolicy.ts:15:  model: string
src\ai\modelPolicy.ts:38:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
src\ai\modelPolicy.ts:39:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
src\ai\modelPolicy.ts:43:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:44:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:48:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
src\ai\modelPolicy.ts:49:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
src\ai\modelPolicy.ts:53:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
src\ai\modelPolicy.ts:54:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
src\ai\modelPolicy.ts:58:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
src\ai\modelPolicy.ts:59:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
src\ai\modelPolicy.ts:63:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:64:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:65:    legacyModelEnv: "RAG_MODEL_ID",
src\ai\modelPolicy.ts:69:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:70:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:74:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
src\ai\modelPolicy.ts:75:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
src\ai\modelPolicy.ts:79:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
src\ai\modelPolicy.ts:80:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
src\ai\modelPolicy.ts:84:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:85:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
src\ai\modelPolicy.ts:86:    legacyModelEnv: "STRATEGY_MODEL_ID",
src\ai\modelPolicy.ts:90:    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
src\ai\modelPolicy.ts:91:    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
```

## Verification SQL/Commands
```bash
# List function configs (verify_jwt flags)
find supabase/functions -name "config.toml" -print

# Confirm OPENAI_API_KEY is referenced and required
rg -n "OPENAI_API_KEY" supabase/functions -S
```

## Problems Found
1. Missing `OPENAI_API_KEY` blocks both embeddings and strategy generation; UX must guide admins to configure secrets.
2. `verify_jwt=false` functions increase security risk if membership checks have bugs; these must be audited and tested.
3. Model config and overrides are distributed across code and env; without a single checklist it’s easy to misconfigure production.

## Recommendations
1. Add a production readiness checklist step to validate required secrets and model IDs.
2. Enumerate all `verify_jwt=false` functions and add integration tests for authZ checks.
3. Centralize AI env var documentation (required/optional/default) and link it in the UI when configuration errors occur.
