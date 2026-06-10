# RAG, OCR, and Quality Grading Architecture

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-RAG-018`                                            |
| Status           | **Active**                                                   |
| Owner            | Engineering Team                                             |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [16-technical-architecture](16-technical-architecture.md), [17-data-entities](17-data-entities-high-level.md), [08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md), [07-source-of-truth](07-source-of-truth-and-content-ingestion.md) |

---

## 1. Overview

SMMAHUB uses three interconnected subsystems to ensure AI agents produce accurate,
grounded, and compliant outputs:

1. **RAG (Retrieval-Augmented Generation)**: Retrieves relevant agency and client
   documents to ground AI outputs in real context rather than hallucination.
2. **OCR Pipeline**: Extracts text from uploaded documents (PDFs, images, screenshots)
   to enrich the Client Brain with structured knowledge.
3. **Quality Grading**: Scores AI outputs across multiple dimensions to determine
   whether they can be auto-approved or require human review.

These systems are not user-facing features. They are infrastructure that makes
the governed specialist agents (Layer 6) reliable. See
[16-technical-architecture](16-technical-architecture.md) for how they fit into the
AI pipeline.

---

## 2. RAG Architecture

### 2.1 System Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  DOCUMENT       │     │  CHUNKING &      │     │  VECTOR STORAGE     │
│  INGESTION      │────▶│  EMBEDDING       │────▶│  (pgvector)         │
│                 │     │                  │     │                     │
│  Upload / OCR   │     │  Split → Embed   │     │  agency_id scoped   │
│  Agency docs    │     │  → Store         │     │  client_id scoped   │
│  Client docs    │     │                  │     │  source attributed   │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                            │
                                                            │ Similarity
                                                            │ Search
                                                            ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  AGENT          │     │  CONTEXT         │     │  RETRIEVAL          │
│  EXECUTION      │◀────│  ASSEMBLY        │◀────│  PIPELINE           │
│                 │     │                  │     │                     │
│  Uses merged    │     │  Merge, trim,    │     │  Query → Embed →   │
│  context        │     │  prioritize      │     │  Search → Re-rank  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

### 2.2 Document Chunking Strategy

Documents are split into chunks before embedding. The chunking strategy balances
retrieval precision (smaller chunks) with semantic coherence (larger chunks).

| Parameter              | Value                | Rationale                              |
| ---------------------- | -------------------- | -------------------------------------- |
| Chunk size             | 512 tokens           | Fits within context windows; specific enough for retrieval |
| Chunk overlap          | 64 tokens            | Prevents information loss at boundaries |
| Chunking method        | Recursive text split  | Respects paragraph and sentence boundaries |
| Metadata per chunk     | source_doc_id, chunk_index, agency_id, client_id, doc_type, created_at | Enables filtered retrieval and attribution |
| Maximum chunks per doc | 200                  | Prevents runaway processing on very large documents |

**Document types and chunking adjustments:**

| Document Type          | Chunking Adjustment                                     |
| ---------------------- | ------------------------------------------------------- |
| Brand guide            | Chunk by section headers; preserve full sections where possible |
| Client brief           | Standard recursive split                                |
| Past report            | Chunk by metric/insight sections                        |
| Compliance document    | Chunk by clause/rule; each rule is its own chunk        |
| Meeting notes          | Chunk by topic/agenda item                              |
| Social media content   | Each post is its own chunk (no splitting)               |

### 2.3 Embedding Model

| Parameter          | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Model              | `text-embedding-3-small` (OpenAI) or equivalent          |
| Dimensions         | 1536                                                     |
| Normalization      | L2 normalized at storage time                            |
| Batch size         | 100 chunks per API call                                  |
| Cost               | ~$0.02 per 1M tokens                                     |

Model selection criteria:
1. Low latency (< 200ms per batch for retrieval-time queries).
2. Strong performance on semantic similarity for marketing/business text.
3. Reasonable cost at scale (thousands of documents across all tenants).
4. Available via API (no self-hosting requirement in V1).

### 2.4 Vector Storage (pgvector)

Vectors are stored in PostgreSQL using the `pgvector` extension, co-located with
all other application data in Supabase.

```sql
CREATE TABLE document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES agencies(id),
  client_id     uuid REFERENCES clients(id),         -- NULL for agency-level docs
  source_doc_id uuid NOT NULL,                        -- Reference to uploaded document
  chunk_index   integer NOT NULL,
  content       text NOT NULL,                        -- Raw chunk text
  embedding     vector(1536) NOT NULL,                -- pgvector column
  doc_type      text NOT NULL,                        -- 'brand_guide', 'brief', etc.
  metadata      jsonb DEFAULT '{}',                   -- Additional metadata
  created_at    timestamptz DEFAULT now(),
  deleted_at    timestamptz DEFAULT NULL,

  -- RLS enforced on agency_id
  -- Index for similarity search
  -- Index filtered by agency_id + client_id for scoped retrieval
);

CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_chunks_agency_client ON document_chunks (agency_id, client_id)
  WHERE deleted_at IS NULL;
```

**Why pgvector over a dedicated vector DB (Pinecone, Weaviate)?**
1. Co-location with application data eliminates network hops for filtered queries.
2. RLS policies apply to vectors the same way as all other data.
3. Supabase manages the infrastructure (no additional service to operate).
4. At SMMAHUB's scale (thousands of agencies, not millions), pgvector performance
   is sufficient. IVFFlat indexing provides sub-100ms search for up to ~1M vectors.

### 2.5 Retrieval Pipeline

When an AI agent needs context, the retrieval pipeline executes:

```
Step 1: QUERY CONSTRUCTION
  Input:  Agent type + task description + client context summary
  Output: Natural language query optimized for embedding similarity
  Method: Template-based query construction per agent type
          Example (content agent): "Brand voice and audience for [client_name]
          on [channel] for [content_type]"

Step 2: QUERY EMBEDDING
  Input:  Query text
  Output: 1536-dimensional vector
  Method: Same embedding model used for document chunks
  Latency: ~50ms

Step 3: SIMILARITY SEARCH
  Input:  Query vector + filters (agency_id, optional client_id, optional doc_type)
  Output: Top-K chunks ranked by cosine similarity
  Method: pgvector cosine distance with pre-filtered scope
  K:      20 candidates (before re-ranking)
  Latency: ~30-80ms

  SQL pattern:
    SELECT id, content, metadata, 1 - (embedding <=> query_vector) AS similarity
    FROM document_chunks
    WHERE agency_id = $1
      AND (client_id = $2 OR client_id IS NULL)  -- include agency-level docs
      AND deleted_at IS NULL
    ORDER BY embedding <=> query_vector
    LIMIT 20;

Step 4: RE-RANKING
  Input:  20 candidate chunks
  Output: Top 5-8 chunks re-ranked by relevance + freshness + source priority
  Method: Scoring function applied post-retrieval

  Score = (similarity * 0.6) + (freshness * 0.2) + (source_priority * 0.2)

  Freshness:  Decay function based on document age
              - < 30 days:    1.0
              - 30-90 days:   0.8
              - 90-180 days:  0.6
              - 180-365 days: 0.4
              - > 365 days:   0.2

  Source priority (by doc_type):
              - compliance_rules:  1.0 (always highest priority)
              - brand_guide:       0.9
              - client_brief:      0.8
              - past_strategy:     0.7
              - meeting_notes:     0.5
              - general_doc:       0.3

Step 5: CONTEXT ASSEMBLY
  Input:  Re-ranked chunks + structured data (AgencyBrain, ClientBrain fields)
  Output: Merged context object for prompt construction
  Method: Chunks inserted into the RAG context section of the prompt
          with source attribution markers: [Source: {doc_name}, chunk {n}]
  Limit:  Total RAG context trimmed to agent's max_context_tokens budget
```

### 2.6 Source Attribution

Every AI output that uses RAG context includes source references:

```json
{
  "output": "...",
  "sources": [
    {
      "doc_id": "uuid",
      "doc_name": "Acme Corp Brand Guide 2026",
      "chunk_index": 3,
      "relevance_score": 0.92,
      "excerpt": "First 100 characters of the chunk..."
    }
  ]
}
```

Source attribution serves two purposes:
1. **Trust**: Agency staff can verify what the AI based its output on.
2. **Debugging**: When an output is incorrect, sources reveal whether the problem
   is retrieval (wrong chunks) or generation (right chunks, wrong interpretation).

### 2.7 Agency Brain vs Client Brain Context Merging

When an agent needs both agency-level and client-level context, the merge follows
a precedence hierarchy:

```
Priority (highest to lowest):
1. Client-specific compliance rules  (override agency defaults)
2. Agency compliance rules           (baseline)
3. Client brand guidelines           (specific to client)
4. Agency brand guidelines           (fallback if client has none)
5. Client audience data              (always client-specific)
6. Agency playbooks                  (operational procedures)
7. RAG-retrieved chunks              (supplementary context)
```

Conflicts are resolved by specificity: client-level always wins over agency-level
for the same type of information.

---

## 3. OCR Pipeline

### 3.1 Pipeline Diagram

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   UPLOAD     │──▶│  FILE TYPE   │──▶│  OCR         │──▶│  TEXT        │
│              │   │  DETECTION   │   │  EXTRACTION  │   │  CLEANING   │
└──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                 │
                                                                 ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  CLIENT      │◀──│  STORAGE     │◀──│  CLASSIFI-   │◀──│  ENTITY     │
│  BRAIN       │   │              │   │  CATION      │   │  EXTRACTION │
│  ENRICHMENT  │   │              │   │              │   │             │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### 3.2 Supported File Types

| File Type       | Detection Method         | OCR/Extraction Method                    |
| --------------- | ------------------------ | ---------------------------------------- |
| PDF (text)      | MIME type + text layer check | Direct text extraction (no OCR needed) |
| PDF (scanned)   | MIME type + no text layer | OCR via Tesseract.js or cloud OCR API   |
| PNG/JPG/WEBP    | MIME type                | OCR via cloud vision API                 |
| HEIC            | MIME type → convert to JPG | Convert then OCR                       |
| DOCX            | MIME type                | Text extraction via mammoth.js           |
| XLSX            | MIME type                | Tabular extraction via SheetJS           |
| CSV             | MIME type / extension    | Direct parsing                           |
| Screenshots     | MIME type (image)        | OCR + layout analysis                    |

### 3.3 Extraction Process

**Step 1: Upload and Validation**
```
- File uploaded via Supabase Storage (client-scoped path: /{agency_id}/{client_id}/docs/)
- Validation: file size < 10MB, allowed MIME type, virus scan
- Database record created: source_document with status = "processing"
```

**Step 2: File Type Detection and Routing**
```
- MIME type inspection
- For PDFs: check if text layer exists (text PDF vs scanned PDF)
- Route to appropriate extraction method
```

**Step 3: OCR Extraction**
```
- Text PDFs: extract text directly (fast, high quality)
- Scanned PDFs and images: cloud OCR API call
  - Returns: text content + bounding boxes + confidence scores
  - Pages processed sequentially
  - OCR confidence threshold: 0.7 (below this, flag for human review)
- DOCX/XLSX: programmatic extraction (no OCR needed)
```

**Step 4: Text Cleaning**
```
- Remove OCR artifacts (random characters, broken words)
- Normalize whitespace and line breaks
- Fix common OCR errors (1/l confusion, 0/O confusion)
- Remove headers/footers/page numbers (heuristic-based)
- Preserve table structure where possible
```

**Step 5: Entity Extraction**
```
- LLM-based extraction (edge function call)
- Input: cleaned text
- Output: structured entities extracted from the document

Extracted entity types:
  - Brand elements:    logos, colors, fonts, taglines, tone descriptors
  - Audience segments: demographics, psychographics, platforms
  - Business metrics:  revenue, growth rates, customer counts
  - Competitive info:  competitor names, positioning, market share
  - Compliance items:  legal disclaimers, prohibited claims, required disclosures
  - Contact info:      key people, roles, email, phone
  - Goals:             business objectives, KPIs, timelines
  - Constraints:       budget limits, geographic restrictions, platform rules
```

**Step 6: Classification**
```
- Each document is classified by type:
  brand_guide | client_brief | competitive_analysis | financial_report |
  meeting_notes | compliance_doc | campaign_report | general

- Classification determines:
  - Which ClientBrain fields to update
  - Which chunking strategy to use for RAG
  - Source priority weight for retrieval re-ranking
```

**Step 7: Storage and Brain Enrichment**
```
- Extracted text stored in source_document record
- Entities merged into ClientBrain fields:
  - brand_guide    → ClientBrain.brand
  - audience data  → ClientBrain.audience
  - constraints    → ClientBrain.constraints
  - compliance     → ClientBrain.approved_claims, constraints
  - metrics        → ClientBrain.performance_history
  - competitors    → ClientBrain.competitor_notes

- Document chunked and embedded for RAG (Section 2)
- ClientBrain.last_enriched_at updated
- ClientBrain.document_summaries appended with:
  { doc_id, doc_name, doc_type, summary (LLM-generated), extracted_at }
```

### 3.4 Conflict Resolution

When a new document contains information that contradicts existing ClientBrain data:

```
1. New document data does NOT automatically overwrite existing data.
2. Conflicts are flagged as "pending review" in the ClientBrain update queue.
3. Agency staff see a notification: "New brand guide contains updated color palette
   that differs from current records. Review and confirm."
4. Staff can accept (overwrite), reject (keep current), or merge (manual edit).
5. Accepted updates are versioned: previous values stored in a history array.
```

---

## 4. Quality Grading System

### 4.1 Purpose

Every AI agent output is graded before it reaches the approval decision point.
Grades determine whether the output can be auto-approved or must go through
human review. Grades are also tracked historically to measure agent performance
over time.

### 4.2 Grading Dimensions

| Dimension            | Weight | Description                                          | Score Range |
| -------------------- | ------ | ---------------------------------------------------- | ----------- |
| Relevance            | 0.25   | Does the output address the specific task/brief?     | 0.0 - 1.0  |
| Brand Compliance     | 0.25   | Does it match the client's brand voice and rules?    | 0.0 - 1.0  |
| Factual Grounding    | 0.20   | Are claims supported by provided context/sources?    | 0.0 - 1.0  |
| Actionability        | 0.15   | Can the recipient act on this output without ambiguity? | 0.0 - 1.0 |
| Completeness         | 0.15   | Are all required sections/fields present and substantive? | 0.0 - 1.0 |

**Overall score** = weighted sum of dimension scores.

### 4.3 Grading Method

Grading is performed by a **secondary LLM pass** -- a separate, independent call
to the LLM specifically for evaluation. This is distinct from the primary agent
call that generated the output.

```
Grading Prompt Structure:

System: You are a quality evaluator for a social media marketing agency's
        AI-generated outputs. Score the following output across 5 dimensions.
        Be strict. Marketing outputs that could damage client relationships
        or violate compliance rules must score low.

Context provided:
  - Original task/brief (what was requested)
  - Client brand rules (what compliance looks like)
  - Agency compliance rules
  - The generated output being graded

Output schema:
  {
    "overall_score": 0.00-1.00,
    "dimensions": {
      "relevance":        { "score": 0.00-1.00, "reasoning": "..." },
      "brand_compliance": { "score": 0.00-1.00, "reasoning": "..." },
      "factual_grounding":{ "score": 0.00-1.00, "reasoning": "..." },
      "actionability":    { "score": 0.00-1.00, "reasoning": "..." },
      "completeness":     { "score": 0.00-1.00, "reasoning": "..." }
    },
    "flags": ["list of specific concerns"],
    "suggested_improvements": ["list of actionable fixes"]
  }
```

### 4.4 Grade Thresholds

| Overall Score     | Decision                                                  |
| ----------------- | --------------------------------------------------------- |
| >= 0.85           | Eligible for auto-approval (if agent config allows it)    |
| 0.70 - 0.84      | Requires human review (standard review queue)             |
| 0.50 - 0.69      | Requires senior review (escalated to manager role)        |
| < 0.50            | Rejected automatically; agent retries with feedback       |

**Per-dimension minimums** (any dimension below these thresholds triggers escalation
regardless of overall score):

| Dimension            | Minimum Score | Consequence if Below                    |
| -------------------- | ------------- | --------------------------------------- |
| Brand Compliance     | 0.60          | Mandatory human review                  |
| Factual Grounding    | 0.50          | Mandatory human review + flag           |

### 4.5 Auto-Retry on Low Scores

When an output scores below 0.50 overall:

```
1. Extract suggested_improvements from grading output
2. Construct a retry prompt that includes:
   - Original task context
   - The failed output
   - Specific feedback from grading: "Your output scored 0.42. Issues: [flags].
     Improvements needed: [suggested_improvements]."
3. Re-execute agent with retry prompt (max 2 retries)
4. If still below 0.50 after retries:
   - Log as failed execution
   - Notify assigned team member: "AI was unable to produce acceptable output
     for [task]. Manual creation required."
   - AgentExecution.status = 'failed'
```

### 4.6 Human Feedback Integration

Agency staff can provide feedback on AI outputs through the review interface:

```
Feedback types:
  - Rating:      1-5 stars (maps to 0.2-1.0 for tracking)
  - Category:    "off-brand", "factually wrong", "incomplete", "great", "good enough"
  - Free text:   Specific comments

Feedback is stored in AgentExecution.quality_grade alongside the automated grade:
  {
    "automated": { ... },
    "human": {
      "rating": 4,
      "category": "good enough",
      "comment": "Tone was slightly too casual for this client",
      "reviewer_id": "uuid",
      "reviewed_at": "timestamp"
    }
  }
```

### 4.7 Historical Grade Tracking

Grades are tracked over time to measure agent reliability and identify degradation:

```
Tracked metrics (per agent type, per agency, rolling 30 days):
  - Average overall score
  - Average score per dimension
  - Auto-approval rate (% of executions that met auto-approve threshold)
  - Retry rate (% of executions that required retry)
  - Failure rate (% of executions that failed after retries)
  - Human override rate (% of auto-approved outputs later rejected by humans)

Alerts:
  - If average overall score drops below 0.70 for any agent type → engineering alert
  - If failure rate exceeds 15% → engineering alert
  - If human override rate exceeds 10% → product alert (threshold may be wrong)
```

---

## 5. Content Compliance System

### 5.1 Brand Voice Scoring

Brand voice compliance is evaluated against the client's brand rules stored in
ClientBrain.brand:

```
Evaluation criteria:
  - Tone match:       Does the content match the declared tone?
                      (e.g., "professional and warm" vs "casual and playful")
  - Vocabulary:       Does it use client-approved terminology?
                      Avoids competitor brand names unless explicitly allowed.
  - Sentence style:   Matches length and complexity patterns from brand guide.
  - Emoji usage:      Follows client's emoji policy (none, minimal, liberal).
  - Call-to-action:   Uses approved CTA patterns from brand guide.

Scoring: 0.0-1.0 mapped to the brand_compliance dimension in quality grading.
```

### 5.2 Claim Verification

Content claims are checked against the ClientBrain.approved_claims list:

```
Process:
  1. Extract claims from generated content (LLM-based extraction).
  2. For each claim, check if it appears in (or is semantically similar to)
     an approved claim in ClientBrain.approved_claims.
  3. Scoring:
     - All claims approved:         1.0
     - Some claims unverified:      0.6 (flagged for review)
     - Claims contradict approved:  0.2 (flagged, likely rejected)

Examples of claims:
  - "#1 rated agency in the Southeast"  → must be in approved_claims
  - "Save up to 30% on ad spend"        → must be in approved_claims
  - "Our team has 10 years of experience" → must be in approved_claims
  - "Boost your engagement"             → generic, no verification needed
```

### 5.3 Tone Consistency

For multi-piece campaigns, tone consistency is checked across all content pieces:

```
Method:
  1. First content piece approved sets the tone baseline.
  2. Subsequent pieces are compared against the baseline using
     embedding similarity on tone-descriptive features.
  3. Consistency score: cosine similarity between tone embeddings.
  4. Threshold: > 0.80 for consistency (below triggers a flag).
```

### 5.4 Audience Appropriateness

Content is checked for audience appropriateness based on ClientBrain.audience:

```
Checks:
  - Language complexity:  Matches audience education/sophistication level.
  - Cultural sensitivity: Flagged terms checked against sensitivity list.
  - Platform norms:       Instagram vs LinkedIn vs TikTok tone expectations.
  - Age appropriateness:  If audience includes minors, stricter content rules.
  - Regulated industries: Extra checks for finance, health, alcohol, etc.
```

---

## 6. Performance and Cost Considerations

### 6.1 RAG Performance Targets

| Operation                  | Target Latency | Current Measured |
| -------------------------- | -------------- | ---------------- |
| Query embedding            | < 100ms        | ~50ms            |
| Similarity search (pgvector) | < 100ms      | ~30-80ms         |
| Re-ranking (20 candidates) | < 10ms         | ~5ms             |
| Total retrieval pipeline   | < 250ms        | ~100-150ms       |

### 6.2 OCR Processing Targets

| Operation                  | Target Time    | Notes                           |
| -------------------------- | -------------- | ------------------------------- |
| Text PDF (< 20 pages)     | < 5 seconds    | Direct extraction, no OCR       |
| Scanned PDF (< 20 pages)  | < 30 seconds   | Cloud OCR API call              |
| Image OCR                  | < 10 seconds   | Single image, cloud API         |
| Entity extraction          | < 15 seconds   | LLM call on extracted text      |
| Total pipeline             | < 60 seconds   | Including chunking + embedding  |

### 6.3 Quality Grading Cost

| Component                  | Cost per Execution                          |
| -------------------------- | ------------------------------------------- |
| Grading LLM call           | ~$0.005-0.02 (depends on output length)     |
| Claim verification pass    | ~$0.003-0.01 (if claims present)            |
| Total grading overhead     | ~$0.01-0.03 per agent execution             |
| As % of total AI cost      | ~10-15% overhead on top of primary agent call|

This overhead is acceptable because it prevents low-quality outputs from reaching
clients, which is significantly more costly than the grading LLM call.

---

## 7. Future Enhancements

| Enhancement                     | Priority | Dependency                        |
| ------------------------------- | -------- | --------------------------------- |
| Hybrid search (keyword + vector)| High     | pg_trgm extension in Supabase     |
| Multi-modal RAG (image search)  | Medium   | CLIP embeddings + image storage   |
| Fine-tuned embedding model      | Low      | Sufficient training data (6+ months)|
| Real-time document streaming    | Medium   | Supabase Realtime on document_chunks |
| Agent-specific re-ranking models| Low      | Per-agent retrieval quality data   |
| Automated claim database updates| Medium   | Client approval workflow for claims|
| Cross-client anonymized benchmarks | Low   | Privacy review + aggregation layer |

---

*For the AI pipeline that consumes RAG context, see
[16-technical-architecture](16-technical-architecture.md), Section 4.
For AI trust and safety governance, see
[08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md).
For entity definitions of AgentExecution and quality_grade fields, see
[17-data-entities](17-data-entities-high-level.md).*
