# 06 — Subject Pack Model

> Pre-built operational templates that encode agency expertise for specific
> verticals and niches. A Subject Pack is the fastest path from "new agency
> account" to "operating with governed AI."
> ICP and pricing authority: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md).

---

## 1. What Is a Subject Pack?

A Subject Pack is a self-contained bundle of agency operational knowledge
tailored to a specific vertical, niche, or service type. It provides the
starting configuration that the Agency OS Setup layer consumes so that an
agency does not build its operational playbook from scratch.

**Core principle:** A pack is a starting point, not a ceiling. Every element
inside a pack is overridable. Agencies customize packs to match their
unique positioning, then the platform governs execution against the
customized configuration.

---

## 2. Pack Anatomy

Every Subject Pack contains the following components.

| Component | Description | Example (Real Estate SMMA Pack) |
|-----------|-------------|-------------------------------|
| Strategy Playbooks | Ordered sequences of strategic actions for common client scenarios | "New listing launch playbook", "Open house promotion playbook" |
| Content Frameworks | Templates and structures for content types the vertical demands | "Property showcase carousel", "Market update reel script", "Neighborhood guide article" |
| Channel Recommendations | Ranked channel mix with rationale and benchmark performance | Instagram (primary), Facebook (secondary), TikTok (emerging), Google Business (local) |
| Compliance Rules | Guardrails specific to the vertical's regulatory and ethical norms | Fair Housing Act language restrictions, MLS photo attribution rules |
| Sample Briefs | Pre-filled brief templates that demonstrate expected output quality | "Just Listed" campaign brief with objectives, audience, tone, deliverables |
| KPI Benchmarks | Vertical-specific performance targets by channel and content type | Instagram Reels: 3–5% engagement rate, Lead form: 2–4% conversion |
| Tone & Voice Defaults | Baseline voice attributes appropriate for the vertical | Professional, specific, community-focused |
| Approval Workflow Presets | Default approval chain configurations for the vertical | Agent drafts → Account Manager reviews → Client approves listing content |
| Hashtag & Keyword Banks | Curated lists of high-performing tags and search terms | #JustListed, #OpenHouse, #DreamHome, #[CityName]RealEstate |
| Competitor Intelligence Templates | Frameworks for tracking competitors in the vertical | Competing agencies' posting frequency, content mix, engagement benchmarks |

---

## 3. Pack Catalog — Platform-Provided Packs

The platform ships with curated packs maintained by the SMMAHUB team. These
packs are versioned and receive quarterly updates.

| Pack ID | Name | Primary Channels | Key Compliance Areas |
|---------|------|-----------------|---------------------|
| SP-RE | Real Estate SMMA | Instagram, Facebook, Google Business | Fair Housing, MLS rules |
| SP-EC | E-commerce DTC | Instagram, TikTok, Pinterest, Email | FTC disclosure, GDPR consent |
| SP-LS | Local Services | Google Business, Facebook, Nextdoor | Licensing claims, review policies |
| SP-HC | Healthcare & Wellness | Instagram, Facebook, YouTube | HIPAA awareness, FDA supplement claims |
| SP-HO | Hospitality & F&B | Instagram, TikTok, Google Business | Health department, alcohol advertising |
| SP-FI | Financial Services | LinkedIn, Facebook, YouTube | SEC/FINRA compliance, disclaimers |
| SP-SA | SaaS & Tech B2B | LinkedIn, Twitter/X, YouTube | Data privacy claims, benchmark sourcing |
| SP-ED | Education & Coaching | Instagram, YouTube, TikTok, Email | Earnings claims, testimonial rules |
| SP-AU | Automotive | Facebook, Instagram, YouTube, Google | Pricing accuracy, emissions disclaimers |
| SP-NP | Nonprofit & Advocacy | Facebook, Instagram, Email, LinkedIn | Donation solicitation rules, 501(c)(3) language |

---

## 4. Pack Lifecycle

### 4.1 Creation

Packs are authored through the Pack Authoring interface (available at T3 tier;
see [05-learning-experience-principles](05-learning-experience-principles.md), Section 2).

```
Author defines pack metadata
  → vertical, description, target agency types

Author populates each component
  → playbooks, frameworks, compliance rules, etc.
  → AI assists by suggesting content based on vertical knowledge

Author sets defaults
  → channel mix weights, KPI targets, tone attributes

Author validates pack
  → platform runs completeness check
  → AI reviews compliance rules for internal consistency

Pack published
  → private (agency-only) or submitted to marketplace
```

### 4.2 Distribution

| Distribution Channel | Visibility | Access Model |
|---------------------|-----------|-------------|
| Platform-provided | All agencies | Included with subscription |
| Agency-private | Authoring agency only | Internal use |
| Marketplace (future) | All agencies | Free or paid, per author's choice |
| Partner-distributed | Invited agencies | Shared via partner link |

### 4.3 Versioning

- Every pack has a semantic version (MAJOR.MINOR.PATCH).
- MAJOR: breaking changes to playbook structure or compliance rules.
- MINOR: new content frameworks, updated benchmarks.
- PATCH: typo fixes, minor benchmark adjustments.
- Agencies pinned to a pack version receive update notifications but are never
  force-upgraded. They choose when to pull changes.

### 4.4 Deprecation

- Platform-provided packs are deprecated with 90 days notice.
- Deprecated packs remain functional but stop receiving updates.
- Agencies on deprecated packs see a migration prompt suggesting the
  replacement pack.

---

## 5. Customization Model

When an agency selects a pack, the platform creates a **derived configuration**
— a copy that the agency owns and may modify freely.

### Customization Scopes

| Scope | What Changes | Example |
|-------|-------------|---------|
| Override | Replace a pack default with agency-specific value | Change KPI benchmark from 3% to 5% engagement |
| Extend | Add new elements the pack did not include | Add a "Luxury tier" content framework |
| Remove | Hide pack elements the agency does not use | Remove TikTok from channel recommendations |
| Lock | Prevent team members from modifying a value | Lock compliance rules so only Owner can change them |

### Customization Inheritance

```
Platform Pack (read-only base)
  └── Agency Derived Config (agency-owned, customizable)
        └── Client-Level Overrides (per-client adjustments)
```

- Client-level overrides take precedence over agency config.
- Agency config takes precedence over the base pack.
- When the base pack receives an update, the agency sees a diff showing which
  of their customizations conflict with the update.

---

## 6. How Packs Feed the Agency OS Setup Layer

The Agency OS Setup layer (platform layer 1) reads pack data to pre-configure
the following systems.

| Agency OS Setup Module | Pack Data Consumed |
|-----------------------|-------------------|
| Brand Voice & Tone | Tone & Voice Defaults |
| Content Playbooks | Strategy Playbooks, Content Frameworks |
| Channel Configuration | Channel Recommendations |
| Compliance & Guardrails | Compliance Rules |
| KPI & Reporting | KPI Benchmarks |
| Brief Templates | Sample Briefs |
| Approval Workflows | Approval Workflow Presets |
| Hashtag Library | Hashtag & Keyword Banks |

This mapping means that selecting a pack during onboarding (guided first-run
Step 3; see [05-learning-experience-principles](05-learning-experience-principles.md), Section 5)
immediately populates the agency's operational configuration with production-
quality defaults.

---

## 7. Pack-Aware AI Behavior

Governed Specialist Agents (platform layer 6) are pack-aware. When a pack is
active, agents adjust their behavior.

| Agent | Pack-Aware Behavior |
|-------|-------------------|
| Content Drafting Agent | Uses pack content frameworks as structural templates; applies pack tone defaults |
| Strategy Agent | References pack playbooks when generating recommendations; uses pack KPI benchmarks for goal-setting |
| Compliance Agent | Enforces pack compliance rules as hard constraints on all outputs |
| Brief Generation Agent | Pre-fills briefs using pack sample brief structure |
| Reporting Agent | Benchmarks client performance against pack KPI targets |

Agents always disclose when a pack rule influenced their output. This
traceability is part of the governed AI contract (see
[08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md), Section 8).

---

## 8. Agency-Created Packs

Agencies at the T3 tier may author their own packs for internal use or
marketplace distribution.

### Authoring Requirements

| Requirement | Minimum Threshold |
|------------|------------------|
| Completeness | All 10 components populated (see Section 2) |
| Compliance review | At least 3 compliance rules defined |
| Playbook depth | At least 2 strategy playbooks with 5+ steps each |
| Content frameworks | At least 4 content framework templates |
| KPI benchmarks | At least 5 KPI targets with source attribution |

### Quality Scoring

The platform assigns a quality score (0–100) to authored packs based on:

- Component completeness (30%)
- Compliance rule specificity (20%)
- Playbook actionability — steps are concrete, not vague (20%)
- Benchmark data sourcing — benchmarks cite real data (15%)
- Internal consistency — no contradictions across components (15%)

Packs scoring below 60 may be used privately but cannot be submitted to the
marketplace.

---

## 9. Marketplace Vision (Future)

The Subject Pack marketplace enables agencies to monetize their operational
expertise.

### Marketplace Rules

1. All marketplace packs undergo platform review before listing.
2. Packs must score 75+ on the quality scoring system.
3. Authors set pricing: free, one-time purchase, or subscription.
4. The platform takes a revenue share (percentage TBD).
5. Buyers rate and review packs; packs below 3.5 stars receive a quality warning.
6. Authors must respond to buyer questions within 5 business days.
7. Pack updates are delivered to all buyers automatically (buyers choose when to apply).

### Marketplace Categories

- By vertical (Real Estate, E-commerce, Healthcare, etc.)
- By service type (Organic Social, Paid Social, Content Marketing, etc.)
- By agency size (2-5 person operating team, 6-10 person operating team, larger qualified agency)
- By region (compliance rules vary by jurisdiction)

---

## 10. Data Model Summary

| Entity | Key Fields | Relationships |
|--------|-----------|--------------|
| `subject_pack` | id, name, vertical, version, author_type, quality_score, status | Has many `pack_components` |
| `pack_component` | id, pack_id, component_type, content_json, sort_order | Belongs to `subject_pack` |
| `agency_pack_config` | id, agency_id, source_pack_id, overrides_json, locked_fields | Belongs to `agency`, references `subject_pack` |
| `client_pack_override` | id, client_id, agency_pack_config_id, overrides_json | Belongs to `client`, references `agency_pack_config` |

All pack data is stored as structured JSON within Supabase, protected by RLS
policies scoped to the owning agency. See [16-technical-architecture](16-technical-architecture.md)
for storage and access patterns.

---

## 11. Cross-References

| Topic | Document |
|-------|----------|
| Learning tiers and first-run pack selection | [05-learning-experience-principles](05-learning-experience-principles.md) |
| How ingested content enriches pack-derived configs | [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md) |
| AI governance for pack-aware agents | [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md) |
| User flows that consume pack data | [09-core-user-flows](09-core-user-flows.md) |
| Information architecture for pack management UI | [10-information-architecture](10-information-architecture.md) |
| Technical architecture and data storage | [16-technical-architecture](16-technical-architecture.md) |

---

*SMMAHUB — Configure your agency's expertise once. Run it across every client
with governed AI.*
