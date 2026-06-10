# 05 — Learning Experience Principles

> How agencies learn to use SMMAHUB — progressive disclosure, guided first-run,
> contextual help, and the "aha moment" for every Tier 2 operating persona.
> ICP and pricing authority: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md).

---

## 1. Guiding Philosophy

SMMAHUB is a deep platform. Agencies operate across strategy, content, delivery,
and client management simultaneously. The learning experience must therefore
follow one rule above all others:

**Reveal value before demanding setup investment.**

Every screen the user touches during onboarding must produce a visible,
meaningful outcome — never a blank state that says "configure me first."

---

## 2. Progressive Disclosure Model

The platform exposes capability in three tiers. Each tier unlocks when the prior
tier's learning milestones are met.

| Tier | Label | Audience | Unlocked By |
|------|-------|----------|-------------|
| T1 | First-Time | All new users | Account creation |
| T2 | Active | Users with 1+ clients operating | Completing guided first-run |
| T3 | Advanced | Power users / Agency Owners | 30+ days active, 3+ clients |

### T1 — First-Time Experience

- Guided first-run wizard (see Section 5).
- Contextual tooltips on every primary navigation item.
- Sample data pre-loaded so dashboards are never empty.
- AI agents operate in suggestion-only mode (see [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md), Section 3).
- Subject Pack selector surfaces immediate vertical-specific value (see [06-subject-pack-model](06-subject-pack-model.md)).

### T2 — Active Experience

- Full navigation unlocked; advanced settings visible but clearly labeled.
- AI agents may operate in draft mode with approval gates.
- Reporting dashboards show real client data.
- Contextual help shifts from tooltips to in-line documentation links.
- "Did you know?" nudges introduce features the user has not yet touched.

### T3 — Advanced Experience

- Bulk operations, API access, custom automations visible.
- AI agents eligible for auto-execute mode (requires explicit opt-in).
- Agency-level analytics and cross-client benchmarking.
- Pack authoring tools unlocked (see [06-subject-pack-model](06-subject-pack-model.md), Section 6).
- Help surfaces shift to keyboard shortcuts, command palette, and documentation search.

---

## 3. Persona-Specific "Aha Moments"

Each persona must reach their aha moment within the first session. The platform
is designed to accelerate arrival at these moments.

| Persona | Aha Moment | Target Time |
|---------|-----------|-------------|
| Agency Owner | "I can see my entire agency's workload and AI is already suggesting priorities." | < 10 min |
| Account Manager | "The Client Operating Record gives me everything I need for this client in one place." | < 8 min |
| Content Creator | "I described the brief and the AI produced a draft that actually sounds like our brand." | < 5 min |
| Strategist | "The readiness assessment surfaced gaps I would have missed manually." | < 12 min |
| Client Stakeholder | "I can see exactly what's happening, approve content, and give feedback without email." | < 3 min |

---

## 4. Learning Milestones

Milestones are tracked per user and per agency. They drive progressive
disclosure unlocks, achievement badges, and onboarding completion scoring.

### Agency-Level Milestones

| # | Milestone | Signals |
|---|-----------|---------|
| M1 | Agency profile completed | Brand voice, services, ICP defined |
| M2 | First Subject Pack selected or created | Pack bound to agency config |
| M3 | Pilot client onboarded | Client Operating Record created, intake complete |
| M4 | First strategy generated | Readiness assessment run, strategy brief produced |
| M5 | First approval cycle completed | Content moved through internal + client approval |
| M6 | First month of operation | 30 days with active clients |
| M7 | Pack customization | Agency modifies or authors a Subject Pack |

### User-Level Milestones

| # | Milestone | Personas |
|---|-----------|----------|
| U1 | Completed guided first-run | All |
| U2 | Created or edited first content piece | Content Creator |
| U3 | Approved or rejected first deliverable | Account Manager, Client Stakeholder |
| U4 | Generated first strategy recommendation | Strategist |
| U5 | Reviewed first cross-client dashboard | Agency Owner |
| U6 | Configured first automation rule | Agency Owner, Account Manager |

---

## 5. Guided First-Run Experience

The first-run experience is a linear, five-step wizard that takes the Agency
Owner from zero to a functioning agency configuration. It is not skippable on
first login but may be exited and resumed.

### Step Sequence

```
Step 1: Agency Identity
  → Agency name, logo, timezone, primary services
  → Output: Agency profile record created

Step 2: Brand Voice & Guardrails
  → Upload style guide or answer guided questions
  → AI extracts tone, vocabulary, compliance rules
  → Output: Brand governance config saved

Step 3: Select a Subject Pack
  → Browse platform-provided packs by vertical
  → Preview pack contents (playbooks, KPIs, frameworks)
  → Output: Pack bound to agency; modules pre-configured

Step 4: Onboard Pilot Client
  → AI-assisted client intake conversation
  → Client Operating Record seeded with intake data
  → Output: Pilot client record with enriched profile

Step 5: Generate First Strategy
  → Readiness assessment runs against client record
  → AI generates strategy brief with recommendations
  → Output: Strategy brief ready for review
```

Each step produces a visible artifact. The user never completes a step and sees
nothing in return.

### Resume Behavior

- Progress is persisted per step.
- Returning users see a checkpoint card showing completed steps and next action.
- After 48 hours of inactivity, a re-engagement email triggers with a deep link
  to the next incomplete step.

---

## 6. Contextual Help Patterns

### Pattern Catalog

| Pattern | When Used | Example |
|---------|-----------|---------|
| Tooltip | Hovering over unfamiliar UI element | "Client Operating Record — the single source of truth for this client" |
| Inline hint | Empty state or first use of a feature | "No strategies yet. Generate your first one →" |
| Guided tour | First visit to a major section | Step-by-step overlay highlighting key areas of the Strategy dashboard |
| Help drawer | User clicks "?" icon | Contextual article matching current page, with search |
| AI assistant | User types a question | In-app chat with the platform's help agent, scoped to current context |
| Video snippet | Complex multi-step feature | 30-second embedded clip showing approval workflow |

### Contextual Scoping Rules

- Help content is scoped to the user's current page and role.
- Search results prioritize articles matching the user's active tier (T1/T2/T3).
- AI assistant responses cite specific SMMAHUB features and link to relevant
  settings pages.

---

## 7. Anti-Patterns to Avoid

These are failure modes the learning experience must actively prevent.

| Anti-Pattern | Why It Fails | SMMAHUB Mitigation |
|-------------|-------------|-------------------|
| Overwhelming setup | Users abandon before seeing value | Five-step wizard with visible output at each step |
| Hiding value behind configuration | Users never discover core capabilities | Sample data, pre-loaded dashboards, Subject Packs |
| Feature dump on first login | Cognitive overload | Progressive disclosure tiers |
| Generic onboarding | Agencies feel the platform is not built for them | Vertical-specific Subject Packs from step 3 |
| No feedback on progress | Users feel lost | Milestone tracking, checkpoint cards, completion percentage |
| Forcing advanced decisions early | Users make uninformed choices | Sensible defaults from Subject Packs; advanced config deferred to T3 |
| Silent AI | Users do not understand what AI did or why | Every AI output includes source attribution and confidence indicator |
| One-size-fits-all help | Content Creator sees Agency Owner docs | Role-scoped contextual help |

---

## 8. Training Content Strategy

### Content Types

| Type | Format | Audience | Update Cadence |
|------|--------|----------|----------------|
| Getting Started Guide | Interactive in-app wizard | All new users | Per release |
| Feature Walkthroughs | Short video (< 2 min) + article | All | Per feature ship |
| Best Practice Playbooks | Long-form article | Agency Owners, Strategists | Quarterly |
| API Documentation | Reference docs | Developers, Advanced users | Per release |
| Release Notes | Changelog with screenshots | All | Per release |
| Community Templates | Shared Subject Packs and configs | All | Community-driven |

### Content Principles

1. Every article answers one question. No multi-topic pages.
2. Screenshots are annotated with numbered callouts matching step lists.
3. Video content has captions and a companion text summary.
4. All training content is searchable from the in-app help drawer.
5. Content is versioned alongside the platform — stale docs are flagged and
   updated within 5 business days of a breaking change.

---

## 9. Measuring Learning Effectiveness

| Metric | Target | Source |
|--------|--------|--------|
| Time to pilot client onboarded | < 30 min | Milestone M3 timestamp |
| Guided first-run completion rate | > 80% | Step completion events |
| 7-day retention after signup | > 65% | Login events |
| Support tickets from T1 users | < 2 per user | Support system |
| Aha moment reached in first session | > 70% per persona | Milestone U1–U5 events |
| Help article satisfaction score | > 4.0 / 5.0 | In-article feedback widget |

---

## 10. Cross-References

| Topic | Document |
|-------|----------|
| Subject Pack model and first-run pack selection | [06-subject-pack-model](06-subject-pack-model.md) |
| AI trust levels and progressive agent autonomy | [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md) |
| Core user flows including onboarding flow detail | [09-core-user-flows](09-core-user-flows.md) |
| Content ingestion and how the Agency Brain is built | [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md) |
| Information architecture and navigation model | [10-information-architecture](10-information-architecture.md) |
| Technical architecture (React, Supabase, edge functions) | [16-technical-architecture](16-technical-architecture.md) |

---

*SMMAHUB — Configure your agency's expertise once. Run it across every client
with governed AI.*
