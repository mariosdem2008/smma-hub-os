# Data Source Catalog

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-APP-SC`                                             |
| Status           | **Active**                                                   |
| Owner            | Agency OS Product Team                                       |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [../16-technical-architecture](../16-technical-architecture.md), [../18-rag-ocr-grading-architecture](../18-rag-ocr-grading-architecture.md), [../17-data-entities-high-level](../17-data-entities-high-level.md) |

---

## 1. Purpose

This document catalogs every data source the SMMAHUB platform can ingest, how ingestion works, what data is extracted, how freshness is maintained, and the current implementation status. The platform's AI quality is directly proportional to the richness of the data it operates on. This catalog defines the data surface area.

---

## 2. Source Inventory

### 2.1 Agency-Level Sources

These sources populate the agency brain and are shared across all clients managed by the agency.

| # | Source Type | Ingestion Method | Data Extracted | Freshness Model | Status |
|---|-----------|-----------------|----------------|-----------------|--------|
| SC-01 | Manual entry (setup wizard) | Form input via AI Setup wizard v2. Structured fields for agency name, services, niches, tone of voice, operating model. | Agency identity, service catalog, niche expertise, voice rules, guardrails, workflow definitions. | On-demand. Agency updates fields through settings or setup wizard. No automatic refresh. | **Available** |
| SC-02 | Document upload (PDF/DOCX) | File upload through knowledge module interface. Documents processed via OCR and text extraction pipeline. Stored as embeddings in pgvector. | Unstructured agency knowledge: SOPs, playbooks, style guides, training materials, client templates, proposal templates. | On-demand. Agency uploads new versions. Old versions retained for audit trail. | **Available** |
| SC-03 | Brand guideline files | Specialized upload flow for brand assets. Supports PDF brand books, image files (logo, colors), font files. | Visual identity: logos (variants), color palette (hex values), typography, usage rules, brand voice documentation. | On-demand. Re-upload to update. Version history maintained. | **Available** |
| SC-04 | Website scraping (agency) | URL input. Server-side scraper extracts text content, metadata, and structure from the agency's website. | Agency positioning, service descriptions, team bios, case studies, testimonials, portfolio items. | Manual re-scrape. Future: scheduled monthly refresh. | **In development** |

### 2.2 Client-Level Sources

These sources populate the client operating record and are scoped to a single client.

| # | Source Type | Ingestion Method | Data Extracted | Freshness Model | Status |
|---|-----------|-----------------|----------------|-----------------|--------|
| SC-05 | AI-assisted onboarding chat | Conversational interface. AI asks structured questions, extracts answers into typed fields on the client record. | Client identity, business description, target audience, goals, competitors, brand voice, content preferences, existing social presence, budget, timeline. | One-time during onboarding. Can be re-run to update. | **Available** |
| SC-06 | Manual client entry | Form-based input on the client workspace. Direct field editing for all client record attributes. | Same fields as SC-05, entered manually instead of through chat. | On-demand. Agency edits fields directly. | **Available** |
| SC-07 | Client document upload | File upload on client workspace. Same processing pipeline as SC-02. | Client-specific knowledge: brand guides, product catalogs, competitor analyses, market research, previous campaign reports. | On-demand. Re-upload to update. | **Available** |
| SC-08 | Website scraping (client) | URL input on client record. Same scraping pipeline as SC-04 but targeting the client's website. | Client positioning, products/services, pricing, team, location, about page content. | Manual re-scrape. Future: scheduled monthly refresh. | **In development** |
| SC-09 | Social media API (read) | OAuth connection to client social profiles (Meta, Instagram, TikTok, LinkedIn, X). Read-only access. | Profile metadata, follower counts, recent posts, engagement metrics, audience demographics, top-performing content. | Automated sync. Frequency: daily for metrics, weekly for content analysis. | **Planned (Phase 1)** |
| SC-10 | Google Business Profile | OAuth or API key connection. Read-only access to GBP data. | Business info, reviews, Q&A, photos, posts, insights (views, searches, actions). | Automated sync. Frequency: daily for reviews, weekly for insights. | **Planned (Phase 2)** |
| SC-11 | Meta Ads API | OAuth connection via Meta Business Suite. Read-only access to ad account data. | Campaign performance, ad spend, ROAS, audience insights, creative performance, conversion data. | Automated sync. Frequency: daily. Token refresh handled by `refresh-meta-tokens` edge function. | **Planned (Phase 2)** |
| SC-12 | Analytics platforms (GA4, etc.) | OAuth or API key connection. Read-only access. | Website traffic, referral sources, conversion funnels, audience behavior, landing page performance. | Automated sync. Frequency: daily. | **Planned (Phase 2)** |
| SC-13 | CRM exports (CSV/JSON) | File upload. Structured import mapping for common CRM formats (HubSpot, Pipedrive, Salesforce exports). | Client contact details, deal history, communication logs, custom fields. Used to seed client records during migration. | One-time import. Future: webhook integration for real-time sync. | **Planned (Phase 2)** |

### 2.3 Platform-Level Sources

These sources provide cross-cutting data used by the platform itself.

| # | Source Type | Ingestion Method | Data Extracted | Freshness Model | Status |
|---|-----------|-----------------|----------------|-----------------|--------|
| SC-14 | Stripe billing data | Webhook. Stripe sends events to `stripe-webhook` edge function. | Subscription status, plan tier, payment history, usage metrics (if usage-based billing is implemented). | Real-time via webhooks. | **Available** |
| SC-15 | Subject packs | Platform-managed content bundles. Ingested during pack installation by the agency. | Industry playbooks, compliance rules, content frameworks, audience archetypes, voice modifiers, KPI benchmarks. See [subject-inventory](subject-inventory.md). | Versioned. Pack updates pushed to agencies. Agencies control when they upgrade. | **Planned (Phase 1)** |

---

## 3. Data Processing Pipeline

All ingested data flows through a common processing pipeline before it is available to AI agents:

```
Source → Ingestion → Extraction → Validation → Embedding → Storage → Retrieval
```

| Stage | Description |
|-------|-------------|
| **Ingestion** | Raw data enters the system via the source-specific method (upload, API, scrape, form). |
| **Extraction** | Structured data is parsed into typed fields. Unstructured data (documents, web pages) is converted to clean text via OCR/parsing. See [../18-rag-ocr-grading-architecture](../18-rag-ocr-grading-architecture.md). |
| **Validation** | Data is checked for completeness, format correctness, and RLS compliance (correct agency/client scoping). |
| **Embedding** | Text content is embedded using the configured embedding model and stored in pgvector for RAG retrieval. |
| **Storage** | Structured data stored in PostgreSQL tables with RLS. Embeddings stored in pgvector. Files stored in Supabase Storage with RLS. |
| **Retrieval** | AI agents query the agency brain (agency-level data) and client operating record (client-level data) via semantic search and structured queries. |

---

## 4. Freshness Models

| Model | Description | Sources |
|-------|-------------|---------|
| **On-demand** | Data updates only when a human explicitly triggers an update (re-upload, re-scrape, form edit). | SC-01, SC-02, SC-03, SC-06, SC-07 |
| **One-time** | Data is captured once during a specific workflow (onboarding, import) and does not automatically refresh. | SC-05, SC-13 |
| **Scheduled sync** | Data refreshes automatically on a defined schedule (daily, weekly, monthly). | SC-09, SC-10, SC-11, SC-12 (planned) |
| **Real-time** | Data updates immediately when the source changes, via webhooks or streaming. | SC-14 |
| **Versioned** | Data is distributed as versioned bundles. Updates are explicit and agency-controlled. | SC-15 |

---

## 5. Data Retention and Deletion

| Policy | Detail |
|--------|--------|
| **Agency data** | Retained for the lifetime of the agency subscription. Deleted 90 days after subscription cancellation, with 30-day grace period for reactivation. |
| **Client data** | Retained while the client is active. Archived client data retained for 12 months, then permanently deleted unless the agency reactivates the client. |
| **Uploaded files** | Stored in Supabase Storage with RLS. Previous versions retained for 90 days after replacement. |
| **Embeddings** | Re-generated when source data changes. Old embeddings deleted when new ones are created. |
| **Sync data** | Rolling 12-month window for metrics and analytics data. Older data aggregated into summary records. |

---

## 6. Cross-References

| Document | Relevance |
|----------|-----------|
| [../16-technical-architecture](../16-technical-architecture.md) | Infrastructure that supports data ingestion and storage |
| [../17-data-entities-high-level](../17-data-entities-high-level.md) | Data model that source data populates |
| [../18-rag-ocr-grading-architecture](../18-rag-ocr-grading-architecture.md) | Processing pipeline for unstructured documents |
| [subject-inventory](subject-inventory.md) | Subject packs as a data source (SC-15) |
