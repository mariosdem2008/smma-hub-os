# Codex Build Brief: ICP Lock — Documentation Sweep

You are doing a documentation-only repositioning sweep for SMMAHUB. The founder has locked the ICP and pricing. Your job: make every product doc conform to the new source of truth, and remove all framing aimed at beginners/solo freelancers/Tier-1.

## Source of truth (read first, do not contradict)
`docs/00-ICP-AND-POSITIONING.md` — this is authoritative. The locked facts:
- **ICP = Tier 2 operating agencies only:** 5–25 active clients, €15k–€100k/month revenue, team of 2–10, already running a real business, will instantly detect shallowness.
- **NOT for:** solo freelancers, beginners, "getting my first client," sub-€5k aspirational agencies, free-trial/discount churners (~80% of self-described "SMMA owners"). Building for them is a trap.
- **Positioning:** operating infrastructure / agency operating system — NOT a content tool, dashboard-with-AI-buttons, or cheap subscription app. Sold like infrastructure (Linear/Vercel/HubSpot tier).
- **Pricing:** floor **€199/month**, range €199–€499 (+ custom). **No free plan.** Top of funnel = booked strategy audit / guided demo, not self-serve free signup.
- **Quality bar:** every agent output, onboarding step, and portal screen calibrated for an expert operator; depth over breadth.

## Rules
- **Docs only.** Do NOT change any code, edge functions, migrations, or `src/`. This is a writing task.
- Do NOT touch: `docs/audit/**`, `docs/audits/**`, `docs/ai/**` (frozen evidence/artifacts), `docs/codex-briefs/**`, `docs/design/**`, `docs/AUDIT_VERDICT_2026-06-10.md`, and `docs/00-ICP-AND-POSITIONING.md` (already authored — reference it, don't rewrite it).
- Preserve each doc's existing structure, headings, tables, and cross-reference style. Rewrite content to conform; don't restructure unnecessarily or change voice/tone conventions.
- Where a doc states "current reality vs target," keep that distinction honest.
- Both `docs/*.md` and `docs/product/*.md` trees exist and overlap. Update BOTH where a file exists in each. If they conflict with each other, make both conform to the source of truth.
- Add a cross-reference to `00-ICP-AND-POSITIONING.md` in any doc whose rules now depend on it.

## Files to update (where they exist, in docs/ and docs/product/)
- `00-project-charter.md` — mission/problem/thesis framed around Tier 2 operators and infrastructure positioning.
- `01-product-vision.md` — vision for established agencies; remove beginner enablement framing.
- `02-user-problems-personas-jtbd.md` — **rewrite personas to ONLY the Tier 2 operator** (owner + account manager + editor/strategist on a 2–10 person team). Remove solo/beginner personas and "first client" JTBD entirely. JTBD = operational leverage, context-once, approval flow, premium client-facing delivery.
- `03-market-landscape-and-positioning.md` — position as infrastructure for operating agencies; competitor framing per the source of truth; market sized at the Tier 2 segment (~50k–150k agencies globally), not the inflated "everyone with a laptop" TAM.
- `04-value-proposition-and-messaging.md` — messaging sells operational outcomes and infrastructure, priced from €199; remove "easy/cheap/for beginners" angles; assume an expert buyer.
- `13-feature-matrix-mvp-v1-v2.md` and `14-mvp-scope.md` — prioritization favors operational leverage for a real team; drop beginner-enablement features from scope framing.
- `15-explicit-non-goals.md` — add explicit non-goals: not for Tier 1 / solo / beginners; no free plan; not a content tool.
- `19-monetization-and-unit-economics.md` — **rewrite pricing to the €199 floor, €199/€349/€499 (+custom), no free plan**; unit economics modeled on €200–€500/mo ACV and the Tier 2 segment; remove the €29/€59/€129 tiers and any free-tier economics.
- `20-launch-assumptions-and-go-to-market.md` — GTM aimed at Tier 2 (strategy-audit/demo funnel, no free-trial-collector loop).
- `CURRENT_STATE.md` — already has its billing section updated; only adjust other sections if they describe pricing/personas inconsistently.
- `vision/SMMAHUB_MASTER_VISION_AND_PRODUCT_STANDARD_2026-03-23.md` — ensure the commercial-positioning and "high ticket" sections state the locked ICP and €199 floor explicitly; reference the source-of-truth doc.
- Any other doc in `docs/` or `docs/product/` (e.g. appendix, roadmap) that names a persona, a price, a free tier, or a beginner audience — bring it into conformance. Grep for: `€29`, `€59`, `€129`, `Free plan`, `free tier`, `Starter`, `freelanc`, `beginner`, `first client`, `solo`, `aspiration`.

## Acceptance criteria
- No remaining doc copy targets beginners/solo/Tier-1, and no doc presents a free plan or a sub-€199 price as a current/target offering (legacy prices may only appear when explicitly labeled as "legacy, to be removed").
- Personas doc(s) contain only Tier 2 operator personas.
- Monetization doc(s) reflect the €199 floor and no free plan.
- Each updated doc cross-references `00-ICP-AND-POSITIONING.md` where its rules depend on it.
- Pure docs change — `git status` shows only `docs/**` modifications (and no touched frozen-evidence paths).

## Deliverables
Print `CODEX ICP SWEEP SUMMARY` with: every file changed, a one-line note of what changed in each, and any contradictions you found and how you resolved them.

Do the sweep now.
